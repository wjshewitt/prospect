'use server';
/**
 * @fileOverview Deterministic procedural generation for solar panel layouts on a roof polygon.
 * Replaces prompt-driven AI with geometry-safe, density-aware algorithm.
 */

import { z } from 'zod';
import { defineFlow } from 'genkit/flow';

// -----------------------------
// Schemas (unchanged)
// -----------------------------
const PointSchema = z.object({
  lat: z.number().describe('Latitude coordinate of a point.'),
  lng: z.number().describe('Longitude coordinate of a point.'),
});

const SolarPanelSchema = z.object({
  footprint: z.array(PointSchema).describe('The four corner points of the solar panel footprint.'),
  rotation: z.number().describe('The rotation of the panel in degrees from North (0-360).'),
});

const GenerateSolarLayoutInputSchema = z.object({
  roofPolygon: z.array(PointSchema).describe('An array of points defining the boundary of the roof to place panels on.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the solar panel layout.'),
});
export type GenerateSolarLayoutInput = z.infer<typeof GenerateSolarLayoutInputSchema>;

const GenerateSolarLayoutOutputSchema = z.object({
  panels: z.array(SolarPanelSchema).describe('An array of generated solar panel objects.'),
});
export type GenerateSolarLayoutOutput = z.infer<typeof GenerateSolarLayoutOutputSchema>;

/**
 * Exported wrapper calling the flow
 */
export async function generateSolarLayout(input: GenerateSolarLayoutInput): Promise<GenerateSolarLayoutOutput> {
  return generateSolarLayoutFlow(input);
}

// -----------------------------
// Internal math / geometry utils (same style as buildings flow)
// -----------------------------
type LatLng = { lat: number; lng: number };
type XY = { x: number; y: number };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function metersPerDegreeLat(): number {
  return 111_320; // average
}
function metersPerDegreeLng(latDeg: number): number {
  return 111_320 * Math.cos(latDeg * DEG2RAD);
}

function centroidLatLng(poly: LatLng[]): LatLng {
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
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}
function onSegment(a: XY, b: XY, c: XY): boolean {
  const minx = Math.min(a.x, c.x) - 1e-9;
  const maxx = Math.max(a.x, c.x) + 1e-9;
  const miny = Math.min(a.y, c.y) - 1e-9;
  const maxy = Math.max(a.y, c.y) + 1e-9;
  return b.x >= minx && b.x <= maxx && b.y >= miny && b.y <= maxy;
}
function segmentsIntersect(p1: XY, q1: XY, p2: XY, q2: XY): boolean {
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
function rectangleInsidePolygon(rect: XY[], poly: XY[]): boolean {
  for (const r of rect) {
    if (!pointInPolygonXY(r, poly)) return false;
  }
  const eRect = polygonEdges(rect);
  const ePoly = polygonEdges(poly);
  for (const [r1, r2] of eRect) {
    for (const [p1, p2] of ePoly) {
      if (segmentsIntersect(r1, r2, p1, p2)) {
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
  return best;
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

// -----------------------------
// Flow implementation
// -----------------------------
const generateSolarLayoutFlow = defineFlow(
  {
    name: 'generateSolarLayoutFlow',
    inputSchema: GenerateSolarLayoutInputSchema,
    outputSchema: GenerateSolarLayoutOutputSchema,
  },
  async (input) => {
    const { roofPolygon, density } = input;

    if (!roofPolygon || roofPolygon.length < 3) {
      return { panels: [] };
    }

    // Projection helpers
    const origin = centroidLatLng(roofPolygon);
    const { toXY, toLatLng } = projectToXYFactory(origin);
    const roofXY = polygonToXY(roofPolygon, toXY);

    // Orientation aligned with longest roof edge
    const baseAngle = longestEdgeOrientation(roofXY);
    const ex: XY = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) }; // along panel length
    const ey: XY = { x: -Math.sin(baseAngle), y: Math.cos(baseAngle) }; // along panel width

    // Density tuning (meters)
    // Panels ~ 1.7m x 1.0m (length x width). Small uniform gap per density and roof-edge margin.
    const params = {
      low:    { gap: 0.25, margin: 0.70 },
      medium: { gap: 0.18, margin: 0.45 },
      high:   { gap: 0.12, margin: 0.30 },
    } as const;

    const { gap, margin } = params[density];

    const panelL = 1.7; // along ex
    const panelW = 1.0; // along ey
    const stepU = panelL + gap;
    const stepV = panelW + gap;

    // Oriented extents
    const { minU, maxU, minV, maxV } = projectOntoOrientedAxes(roofXY, ex, ey);

    // Start/End with margins
    const startU = Math.floor((minU + margin) / stepU) * stepU;
    const startV = Math.floor((minV + margin) / stepV) * stepV;
    const endU = maxU - margin;
    const endV = maxV - margin;

    const panels: Array<z.infer<typeof SolarPanelSchema>> = [];

    for (let v = startV; v <= endV; v += stepV) {
      for (let u = startU; u <= endU; u += stepU) {
        // Center point in world XY
        const center = addXY(scaleXY(ex, u), scaleXY(ey, v));
        // Build rectangle footprint
        const rect = rectCornersXY(center, panelW, panelL, baseAngle); // width across ey, length along ex
        if (!rectangleInsidePolygon(rect, roofXY)) continue;

        const footprint = rect.map(toLatLng);
        panels.push({
          footprint,
          rotation: angleFromNorthDegrees(baseAngle),
        });
      }
    }

    return { panels };
  }
);

export { generateSolarLayoutFlow };
