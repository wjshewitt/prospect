'use server';
/**
 * @fileOverview Deterministic procedural generation for building layouts within a zone.
 * Replaces prompt-driven AI with geometry-safe, density-aware algorithm.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// -----------------------------
// Schemas (unchanged)
// -----------------------------
const PointSchema = z.object({
  lat: z.number().describe('Latitude coordinate of a point.'),
  lng: z.number().describe('Longitude coordinate of a point.'),
});

const BuildingSchema = z.object({
  type: z.string().describe("Type of the building (e.g., 'house_detached', 'flat_block')."),
  footprint: z.array(PointSchema).describe('The four corner points of the building footprint.'),
  floors: z.number().describe('Number of floors in the building.'),
  rotation: z.number().describe('The rotation of the building in degrees from North (0-360).'),
});

const GenerateBuildingLayoutInputSchema = z.object({
  zonePolygon: z.array(PointSchema).describe('An array of points defining the boundary of the zone to place buildings in.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the building layout.'),
});
export type GenerateBuildingLayoutInput = z.infer<typeof GenerateBuildingLayoutInputSchema>;

const GenerateBuildingLayoutOutputSchema = z.object({
  buildings: z.array(BuildingSchema).describe('An array of generated building objects.'),
});
export type GenerateBuildingLayoutOutput = z.infer<typeof GenerateBuildingLayoutOutputSchema>;

/**
 * Exported wrapper calling the flow
 */
export async function generateBuildingLayout(input: GenerateBuildingLayoutInput): Promise<GenerateBuildingLayoutOutput> {
  return generateBuildingLayoutFlow(input);
}

// -----------------------------
// Internal math / geometry utils
// -----------------------------
type LatLng = { lat: number; lng: number };
type XY = { x: number; y: number };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Approximate meters per degree at a given latitude
function metersPerDegreeLat(): number {
  return 111_320; // average
}
function metersPerDegreeLng(latDeg: number): number {
  return 111_320 * Math.cos(latDeg * DEG2RAD);
}

function centroidLatLng(poly: LatLng[]): LatLng {
  // Arithmetic mean centroid; adequate for small polygons
  const n = poly.length;
  let lat = 0;
  let lng = 0;
  for (const p of poly) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / n, lng: lng / n };
}

function projectToXYFactory(origin: LatLng) {
  const mLat = metersPerDegreeLat();
  const mLng = metersPerDegreeLng(origin.lat);
  return {
    toXY: (p: LatLng): XY => ({
      x: (p.lng - origin.lng) * mLng,
      y: (p.lat - origin.lat) * mLat,
    }),
    toLatLng: (p: XY): LatLng => ({
      lat: origin.lat + p.y / mLat,
      lng: origin.lng + p.x / mLng,
    }),
  };
}

function polygonToXY(poly: LatLng[], toXY: (p: LatLng) => XY): XY[] {
  return poly.map(toXY);
}

function polygonAreaXY(poly: XY[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygonXY(pt: XY, poly: XY[]): boolean {
  // Ray casting
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function orientation(a: XY, b: XY, c: XY): number {
  // cross product z-component
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a: XY, b: XY, c: XY): boolean {
  // b on segment a-c
  const minx = Math.min(a.x, c.x) - 1e-9;
  const maxx = Math.max(a.x, c.x) + 1e-9;
  const miny = Math.min(a.y, c.y) - 1e-9;
  const maxy = Math.max(a.y, c.y) + 1e-9;
  return b.x >= minx && b.x <= maxx && b.y >= miny && b.y <= maxy;
}

function segmentsIntersect(p1: XY, q1: XY, p2: XY, q2: XY): boolean {
  // Robust general segment intersection (includes colinear overlap)
  const o1 = Math.sign(orientation(p1, q1, p2));
  const o2 = Math.sign(orientation(p1, q1, q2));
  const o3 = Math.sign(orientation(p2, q2, p1));
  const o4 = Math.sign(orientation(p2, q2, q1));

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

function rectCornersXY(center: XY, w: number, h: number, angleRad: number): XY[] {
  // Return 4 corners in order (clockwise), rectangle centered at center
  const dx = w / 2;
  const dy = h / 2;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const local: XY[] = [
    { x: -dx, y: -dy },
    { x: +dx, y: -dy },
    { x: +dx, y: +dy },
    { x: -dx, y: +dy },
  ];
  return local.map((p) => ({
    x: center.x + p.x * cos - p.y * sin,
    y: center.y + p.x * sin + p.y * cos,
  }));
}

function polygonEdges(poly: XY[]): Array<[XY, XY]> {
  const edges: Array<[XY, XY]> = [];
  for (let i = 0; i < poly.length; i++) {
    edges.push([poly[i], poly[(i + 1) % poly.length]]);
  }
  return edges;
}

function polygonIntersectsPolygon(a: XY[], b: XY[]): boolean {
  // Edge intersections
  const ea = polygonEdges(a);
  const eb = polygonEdges(b);
  for (const [p1, q1] of ea) {
    for (const [p2, q2] of eb) {
      if (segmentsIntersect(p1, q1, p2, q2)) return true;
    }
  }
  // Containment (one inside another)
  if (pointInPolygonXY(a[0], b)) return true;
  if (pointInPolygonXY(b[0], a)) return true;
  return false;
}

function rectangleInsidePolygon(rect: XY[], poly: XY[]): boolean {
  // All corners inside AND no edge intersection
  for (const r of rect) {
    if (!pointInPolygonXY(r, poly)) return false;
  }
  const eRect = polygonEdges(rect);
  const ePoly = polygonEdges(poly);
  for (const [r1, r2] of eRect) {
    for (const [p1, p2] of ePoly) {
      if (segmentsIntersect(r1, r2, p1, p2)) {
        // If a rectangle edge touches the boundary, consider it not strictly inside
        return false;
      }
    }
  }
  return true;
}

function angleFromNorthDegrees(angleFromXRad: number): number {
  let deg = (90 - angleFromXRad * RAD2DEG) % 360;
  if (deg < 0) deg += 360;
  return deg;
}

function longestEdgeOrientation(poly: XY[]): number {
  let best = 0;
  let maxLen2 = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 > maxLen2) {
      maxLen2 = len2;
      best = Math.atan2(dy, dx);
    }
  }
  return best; // radians, measured from +X (East), CCW
}

function dot(a: XY, b: XY) {
  return a.x * b.x + a.y * b.y;
}

function projectOntoOrientedAxes(poly: XY[], ex: XY, ey: XY) {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const p of poly) {
    const u = dot(p, ex);
    const v = dot(p, ey);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return { minU, maxU, minV, maxV };
}

function addXY(a: XY, b: XY): XY {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleXY(a: XY, s: number): XY {
  return { x: a.x * s, y: a.y * s };
}

// Simple seeded PRNG for reproducibility
function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

// -----------------------------
// Flow implementation (deterministic, geometry-safe)
// -----------------------------
const generateBuildingLayoutFlow = ai.defineFlow(
  {
    name: 'generateBuildingLayoutFlow',
    inputSchema: GenerateBuildingLayoutInputSchema,
    outputSchema: GenerateBuildingLayoutOutputSchema,
  },
  async (input) => {
    const { zonePolygon, density } = input;

    if (!zonePolygon || zonePolygon.length < 3) {
      return { buildings: [] };
    }

    // Projection helpers
    const origin = centroidLatLng(zonePolygon);
    const { toXY, toLatLng } = projectToXYFactory(origin);
    const zoneXY = polygonToXY(zonePolygon, toXY);
    const zoneArea = polygonAreaXY(zoneXY); // m^2

    // Base building dimensions (meters)
    const houseW = 8;  // across-width
    const houseL = 10; // along-length

    // Density tuning
    const densityParams = {
      low: {
        margin: 10,
        gapU: 8,
        gapV: 8,
        rotationJitterDeg: 8,
        clusterRadius: 70,
        clusterFactor: 0.0006, // clusters per m^2
      },
      medium: {
        margin: 6,
        gapU: 5.5,
        gapV: 5.5,
        rotationJitterDeg: 6,
        clusterRadius: 50,
        clusterFactor: 0.0009,
      },
      high: {
        margin: 3.5,
        gapU: 3.5,
        gapV: 3.5,
        rotationJitterDeg: 4,
        clusterRadius: 35,
        clusterFactor: 0.0014,
      },
    } as const;

    const params = densityParams[density];

    // Orientation aligned to longest edge of polygon
    const baseAngle = longestEdgeOrientation(zoneXY);
    const ex: XY = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
    const ey: XY = { x: -Math.sin(baseAngle), y: Math.cos(baseAngle) };

    // Oriented bbox extents
    const { minU, maxU, minV, maxV } = projectOntoOrientedAxes(zoneXY, ex, ey);

    // Seeded RNG for reproducible layouts
    const seedStr = JSON.stringify(zonePolygon) + '|' + density;
    const rng = mulberry32(hashSeed(seedStr));

    // Generate cluster centers
    const desiredClusters = clamp(Math.round(zoneArea * params.clusterFactor), 1, 20);
    const clusters: XY[] = [];
    const bboxMin: XY = addXY(scaleXY(ex, minU), scaleXY(ey, minV));
    const bboxMax: XY = addXY(scaleXY(ex, maxU), scaleXY(ey, maxV));

    // Sample inside oriented bbox until we have desired cluster centers inside polygon and sufficiently separated
    let attempts = 0;
    while (clusters.length < desiredClusters && attempts < desiredClusters * 200) {
      attempts++;
      const u = randRange(rng, minU, maxU);
      const v = randRange(rng, minV, maxV);
      const p = addXY(scaleXY(ex, u), scaleXY(ey, v));
      if (!pointInPolygonXY(p, zoneXY)) continue;
      let farEnough = true;
      for (const c of clusters) {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        if (Math.hypot(dx, dy) < params.clusterRadius * 0.8) {
          farEnough = false;
          break;
        }
      }
      if (farEnough) clusters.push(p);
    }
    if (clusters.length === 0) {
      // Fallback: use polygon centroid
      clusters.push({ x: 0, y: 0 }); // origin is polygon centroid in XY
    }

    // Grid stepping in oriented axes
    const stepU = houseL + params.gapU;
    const stepV = houseW + params.gapV;

    const startU = Math.floor((minU + params.margin) / stepU) * stepU;
    const startV = Math.floor((minV + params.margin) / stepV) * stepV;
    const endU = maxU - params.margin;
    const endV = maxV - params.margin;

    const placedRectsXY: XY[][] = [];
    const buildings: Array<z.infer<typeof BuildingSchema>> = [];

    function placeCandidate(center: XY, rotRad: number): boolean {
      const rect = rectCornersXY(center, houseW, houseL, rotRad);
      if (!rectangleInsidePolygon(rect, zoneXY)) return false;

      // Avoid overlaps with previously placed houses
      for (const existing of placedRectsXY) {
        if (polygonIntersectsPolygon(rect, existing)) return false;
      }

      placedRectsXY.push(rect);
      const footprintLL = rect.map(toLatLng);
      const rotationDegFromNorth = angleFromNorthDegrees(rotRad);
      buildings.push({
        type: 'house_detached',
        footprint: footprintLL,
        floors: 2,
        rotation: rotationDegFromNorth,
      });
      return true;
    }

    // Scan oriented grid, accept if within a cluster influence and fits
    let rowIndex = 0;
    for (let v = startV; v <= endV; v += stepV) {
      // Slight checkerboard/offset for naturalism
      const rowOffset = (rowIndex % 2 === 0) ? 0 : stepU * 0.35;
      for (let u = startU + rowOffset; u <= endU; u += stepU) {
        // Candidate in oriented space -> world XY
        const baseCenter = addXY(scaleXY(ex, u), scaleXY(ey, v));

        // Only accept points that are within a cluster radius
        let inAnyCluster = false;
        for (const c of clusters) {
          const dx = baseCenter.x - c.x;
          const dy = baseCenter.y - c.y;
          const d = Math.hypot(dx, dy);
          if (d <= params.clusterRadius) {
            inAnyCluster = true;
            break;
          }
        }
        if (!inAnyCluster) continue;

        // Small positional jitter within safe bounds
        const jitterU = randRange(rng, -0.25, 0.25) * params.gapU;
        const jitterV = randRange(rng, -0.25, 0.25) * params.gapV;
        const candidate = addXY(baseCenter, addXY(scaleXY(ex, jitterU), scaleXY(ey, jitterV)));

        // Rotation jitter around the base orientation
        const jitterDeg = randRange(rng, -params.rotationJitterDeg, params.rotationJitterDeg);
        const rotRad = baseAngle + jitterDeg * DEG2RAD;

        placeCandidate(candidate, rotRad);
      }
      rowIndex++;
    }

    return { buildings };
  }
);

export { generateBuildingLayoutFlow };