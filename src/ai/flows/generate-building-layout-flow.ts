
'use server';
/**
 * @fileOverview Enhanced UK-specific procedural generation for building layouts and roads.
 * Implements UK planning patterns, building types, and street networks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// -----------------------------
// Enhanced Schemas for UK
// -----------------------------
const PointSchema = z.object({
  lat: z.number().describe('Latitude coordinate of a point.'),
  lng: z.number().describe('Longitude coordinate of a point.'),
});

const BuildingSchema = z.object({
  type: z.enum([
    'terraced', 'semi_detached', 'detached', 'bungalow', 
    'maisonette', 'flat_block', 'corner_shop', 'mews', 'mixed_use'
  ]).describe("Type of UK building."),
  footprint: z.array(PointSchema).describe('The four corner points of the building footprint.'),
  floors: z.number().describe('Number of floors in the building.'),
  rotation: z.number().describe('The rotation of the building in degrees from North (0-360).'),
  partyWalls: z.enum(['left', 'right', 'both', 'none']).optional(),
  groundFloorUse: z.enum(['residential', 'retail', 'commercial']).optional(),
  gardenSpace: z.array(PointSchema).optional().describe('Garden/amenity space polygon.'),
  parkingSpaces: z.number().optional(),
});

const RoadSegmentSchema = z.object({
  type: z.enum(['primary', 'secondary', 'residential', 'cul_de_sac', 'mews']),
  centerline: z.array(PointSchema).describe('Points defining road centerline.'),
  width: z.number().describe('Road width in meters.'),
  hasFootpath: z.boolean(),
  hasCycleane: z.boolean().optional(),
});

const ParkingAreaSchema = z.object({
  type: z.enum(['on_street', 'driveway', 'parking_court', 'garage']),
  polygon: z.array(PointSchema),
  spaces: z.number(),
});

const GenerateBuildingLayoutInputSchema = z.object({
  zonePolygon: z.array(PointSchema).describe('An array of points defining the boundary of the zone.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the building layout.'),
  characterArea: z.enum(['victorian', 'suburban', 'modern', 'rural', 'town_center']).optional(),
});
export type GenerateBuildingLayoutInput = z.infer<typeof GenerateBuildingLayoutInputSchema>;

const GenerateBuildingLayoutOutputSchema = z.object({
  buildings: z.array(BuildingSchema).describe('An array of generated building objects.'),
  roads: z.array(RoadSegmentSchema).describe('Generated road network.'),
  parking: z.array(ParkingAreaSchema).describe('Parking areas.'),
});
export type GenerateBuildingLayoutOutput = z.infer<typeof GenerateBuildingLayoutOutputSchema>;

// -----------------------------
// UK Building Types Database
// -----------------------------
const UK_BUILDING_TYPES = {
  residential: {
    terraced: { width: 5, length: 8, floors: 2, setback: 2 },
    semi_detached: { width: 7, length: 9, floors: 2, setback: 3 },
    detached: { width: 10, length: 12, floors: 2, setback: 4 },
    bungalow: { width: 12, length: 10, floors: 1, setback: 4 },
    maisonette: { width: 6, length: 8, floors: 2, setback: 2 },
    flat_block: { width: 15, length: 20, floors: 4, setback: 5 },
  },
  mixed: {
    corner_shop: { width: 8, length: 10, floors: 2, setback: 0 },
    mews: { width: 6, length: 7, floors: 2, setback: 1 },
    mixed_use: { width: 8, length: 12, floors: 3, setback: 0 },
  }
} as const;

// UK Planning spacing requirements
const UK_SPACING_RULES = {
  windowToWindow: 21,     // 21m minimum between facing windows
  backToBack: 10.5,       // 10.5m minimum back-to-back gardens
  sideSpacing: 1,         // 1m minimum to boundary
  cornerVisibility: 2.4,  // Visibility splay at corners
  minGardenDepth: {
    low: 10,
    medium: 6,
    high: 3
  }
};

// UK Parking requirements
const UK_PARKING_REQUIREMENTS = {
  low: 2.0,    // 2 spaces per dwelling
  medium: 1.5, // 1.5 spaces per dwelling
  high: 1.0    // 1 space per dwelling
};

// Road specifications
const UK_ROAD_SPECS = {
  primary: { width: 7.3, footpathWidth: 2, cycleLane: true },
  secondary: { width: 6.0, footpathWidth: 1.8, cycleLane: false },
  residential: { width: 5.5, footpathWidth: 1.5, cycleLane: false },
  cul_de_sac: { width: 5.0, footpathWidth: 1.2, cycleLane: false },
  mews: { width: 4.0, footpathWidth: 0, cycleLane: false },
};

// -----------------------------
// Geometry utilities (extended)
// -----------------------------
type LatLng = { lat: number; lng: number };
type XY = { x: number; y: number };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function metersPerDegreeLat(): number {
  return 111_320;
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

function polygonAreaXY(poly: XY[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygonXY(pt: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
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

function polygonIntersectsPolygon(a: XY[], b: XY[]): boolean {
  const ea = polygonEdges(a);
  const eb = polygonEdges(b);
  for (const [p1, q1] of ea) {
    for (const [p2, q2] of eb) {
      if (segmentsIntersect(p1, q1, p2, q2)) return true;
    }
  }
  if (pointInPolygonXY(a[0], b)) return true;
  if (pointInPolygonXY(b[0], a)) return true;
  return false;
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

function distance(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalize(v: XY): XY {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function perpendicular(v: XY): XY {
  return { x: -v.y, y: v.x };
}

function addXY(a: XY, b: XY): XY {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleXY(a: XY, s: number): XY {
  return { x: a.x * s, y: a.y * s };
}

function offsetLine(p1: XY, p2: XY, offset: number): [XY, XY] {
  const dir = normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
  const perp = perpendicular(dir);
  const offsetVec = scaleXY(perp, offset);
  return [addXY(p1, offsetVec), addXY(p2, offsetVec)];
}

// Seeded PRNG
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
// Road Generation
// -----------------------------
interface RoadNetwork {
  segments: Array<{
    type: 'primary' | 'secondary' | 'residential' | 'cul_de_sac' | 'mews';
    centerline: XY[];
    width: number;
  }>;
  intersections: XY[];
}

function generateRoadNetwork(
  zoneXY: XY[], 
  density: string,
  rng: () => number
): RoadNetwork {
  const zoneArea = polygonAreaXY(zoneXY);
  const zoneBounds = getPolygonBounds(zoneXY);
  const zoneWidth = zoneBounds.maxX - zoneBounds.minX;
  const zoneHeight = zoneBounds.maxY - zoneBounds.minY;
  
  const segments: RoadNetwork['segments'] = [];
  const intersections: XY[] = [];
  
  // Find primary street edge (longest edge facing likely street)
  const primaryEdge = findPrimaryStreetEdge(zoneXY);
  
  if (density === 'low' || density === 'medium') {
    // Suburban pattern: main road with perpendicular residential streets
    const mainRoad = generateMainRoad(primaryEdge, zoneXY);
    segments.push({
      type: density === 'low' ? 'secondary' : 'primary',
      centerline: mainRoad,
      width: UK_ROAD_SPECS[density === 'low' ? 'secondary' : 'primary'].width
    });
    
    // Add perpendicular residential streets
    const perpSpacing = density === 'low' ? 60 : 40;
    const perpRoads = generatePerpendicularRoads(mainRoad, zoneXY, perpSpacing, rng);
    
    perpRoads.forEach(road => {
      // Some roads are cul-de-sacs
      const isCulDeSac = density === 'low' && rng() > 0.5;
      segments.push({
        type: isCulDeSac ? 'cul_de_sac' : 'residential',
        centerline: road,
        width: UK_ROAD_SPECS[isCulDeSac ? 'cul_de_sac' : 'residential'].width
      });
      
      // Add turning circle for cul-de-sacs
      if (isCulDeSac && road.length > 1) {
        const endPoint = road[road.length - 1];
        const turningCircle = generateTurningCircle(endPoint, 9, 8); // 9m radius
        segments.push({
          type: 'cul_de_sac',
          centerline: turningCircle,
          width: UK_ROAD_SPECS.cul_de_sac.width
        });
      }
      
      // Record intersection
      intersections.push(road[0]);
    });
    
  } else {
    // High density: grid or perimeter block pattern
    const gridSpacing = 30;
    const grid = generateGridRoads(zoneXY, gridSpacing);
    
    grid.forEach((road, i) => {
      segments.push({
        type: i < 2 ? 'primary' : 'residential',
        centerline: road,
        width: UK_ROAD_SPECS[i < 2 ? 'primary' : 'residential'].width
      });
    });
    
    // Find intersections
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const intersection = findLineIntersection(
          segments[i].centerline,
          segments[j].centerline
        );
        if (intersection && pointInPolygonXY(intersection, zoneXY)) {
          intersections.push(intersection);
        }
      }
    }
  }
  
  // Add mews lanes for character areas
  if (rng() > 0.7 && density !== 'low') {
    const mewsLanes = generateMewsLanes(segments, zoneXY, rng);
    mewsLanes.forEach(lane => {
      segments.push({
        type: 'mews',
        centerline: lane,
        width: UK_ROAD_SPECS.mews.width
      });
    });
  }
  
  return { segments, intersections };
}

function findPrimaryStreetEdge(poly: XY[]): [XY, XY] {
  let bestEdge: [XY, XY] = [poly[0], poly[1]];
  let maxLength = 0;
  
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const len = distance(poly[i], poly[j]);
    if (len > maxLength) {
      maxLength = len;
      bestEdge = [poly[i], poly[j]];
    }
  }
  
  return bestEdge;
}

function generateMainRoad(edge: [XY, XY], zoneXY: XY[]): XY[] {
  // Offset road inside from zone edge
  const offset = 8; // 8m from boundary
  const [p1, p2] = offsetLine(edge[0], edge[1], offset);
  
  // Ensure road is inside zone
  if (!pointInPolygonXY(p1, zoneXY) || !pointInPolygonXY(p2, zoneXY)) {
    // Use original edge
    return [edge[0], edge[1]];
  }
  
  return [p1, p2];
}

function generatePerpendicularRoads(
  mainRoad: XY[],
  zoneXY: XY[],
  spacing: number,
  rng: () => number
): XY[][] {
  const roads: XY[][] = [];
  const [start, end] = mainRoad;
  const mainLength = distance(start, end);
  const mainDir = normalize({ x: end.x - start.x, y: end.y - start.y });
  const perpDir = perpendicular(mainDir);
  
  const numRoads = Math.floor(mainLength / spacing);
  
  for (let i = 1; i < numRoads; i++) {
    const t = i / numRoads;
    const basePoint = {
      x: start.x + t * (end.x - start.x),
      y: start.y + t * (end.y - start.y)
    };
    
    // Add some variation
    const jitter = randRange(rng, -spacing * 0.2, spacing * 0.2);
    const roadStart = addXY(basePoint, scaleXY(mainDir, jitter));
    
    // Extend perpendicular into zone
    const maxExtension = 100;
    let roadEnd = roadStart;
    
    for (let ext = 10; ext <= maxExtension; ext += 10) {
      const testPoint = addXY(roadStart, scaleXY(perpDir, ext));
      if (!pointInPolygonXY(testPoint, zoneXY)) break;
      roadEnd = testPoint;
    }
    
    if (distance(roadStart, roadEnd) > 20) {
      roads.push([roadStart, roadEnd]);
    }
  }
  
  return roads;
}

function generateGridRoads(zoneXY: XY[], spacing: number): XY[][] {
  const roads: XY[][] = [];
  const bounds = getPolygonBounds(zoneXY);
  
  // Horizontal roads
  for (let y = bounds.minY + spacing; y < bounds.maxY; y += spacing) {
    const points: XY[] = [];
    for (let x = bounds.minX; x <= bounds.maxX; x += 5) {
      const p = { x, y };
      if (pointInPolygonXY(p, zoneXY)) {
        if (points.length === 0 || distance(points[points.length - 1], p) > 15) {
          points.push(p);
        }
      }
    }
    if (points.length >= 2) roads.push(points);
  }
  
  // Vertical roads
  for (let x = bounds.minX + spacing; x < bounds.maxX; x += spacing) {
    const points: XY[] = [];
    for (let y = bounds.minY; y <= bounds.maxY; y += 5) {
      const p = { x, y };
      if (pointInPolygonXY(p, zoneXY)) {
        if (points.length === 0 || distance(points[points.length - 1], p) > 15) {
          points.push(p);
        }
      }
    }
    if (points.length >= 2) roads.push(points);
  }
  
  return roads;
}

function generateTurningCircle(center: XY, radius: number, segments: number): XY[] {
  const points: XY[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  return points;
}

function generateMewsLanes(
  mainRoads: RoadNetwork['segments'],
  zoneXY: XY[],
  rng: () => number
): XY[][] {
  const mews: XY[][] = [];
  
  // Add narrow lanes behind main roads
  mainRoads.slice(0, 2).forEach(road => {
    if (road.centerline.length < 2) return;
    
    const [p1, p2] = road.centerline;
    const offset = 25 + randRange(rng, -5, 5); // Behind buildings
    const [m1, m2] = offsetLine(p1, p2, offset);
    
    if (pointInPolygonXY(m1, zoneXY) && pointInPolygonXY(m2, zoneXY)) {
      mews.push([m1, m2]);
    }
  });
  
  return mews;
}

function getPolygonBounds(poly: XY[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  return { minX, maxX, minY, maxY };
}

function findLineIntersection(line1: XY[], line2: XY[]): XY | null {
  if (line1.length < 2 || line2.length < 2) return null;
  
  const [p1, q1] = line1;
  const [p2, q2] = line2;
  
  const d = (q1.x - p1.x) * (q2.y - p2.y) - (q1.y - p1.y) * (q2.x - p2.x);
  if (Math.abs(d) < 1e-9) return null;
  
  const t = ((p2.x - p1.x) * (q2.y - p2.y) - (p2.y - p1.y) * (q2.x - p2.x)) / d;
  
  if (t >= 0 && t <= 1) {
    return {
      x: p1.x + t * (q1.x - p1.x),
      y: p1.y + t * (q1.y - p1.y)
    };
  }
  
  return null;
}

// -----------------------------
// Building Generation Functions
// -----------------------------
function generateTerracedRow(
  startPoint: XY,
  direction: XY,
  houseCount: number,
  houseType: typeof UK_BUILDING_TYPES.residential.terraced,
  angle: number
): Array<{
  type: string;
  footprint: XY[];
  floors: number;
  rotation: number;
  partyWalls: 'left' | 'right' | 'both' | 'none';
}> {
  const buildings = [];
  
  for (let i = 0; i < houseCount; i++) {
    const center = {
      x: startPoint.x + (i * houseType.width * direction.x),
      y: startPoint.y + (i * houseType.width * direction.y)
    };
    
    let partyWalls: 'left' | 'right' | 'both' | 'none' = 'none';
    if (i > 0 && i < houseCount - 1) partyWalls = 'both';
    else if (i > 0) partyWalls = 'left';
    else if (i < houseCount - 1) partyWalls = 'right';
    
    buildings.push({
      type: 'terraced',
      footprint: rectCornersXY(center, houseType.width - 0.3, houseType.length, angle),
      floors: houseType.floors,
      rotation: angleFromNorthDegrees(angle),
      partyWalls
    });
  }
  
  return buildings;
}

function generateGardenSpace(
  building: { footprint: XY[]; rotation: number },
  depth: number,
  direction: XY
): XY[] {
  // Calculate garden polygon behind building
  const backEdge = [building.footprint[2], building.footprint[3]];
  const gardenCorners: XY[] = [
    backEdge[0],
    backEdge[1],
    addXY(backEdge[1], scaleXY(direction, depth)),
    addXY(backEdge[0], scaleXY(direction, depth))
  ];
  
  return gardenCorners;
}

function alignToStreetGrid(
  buildingCenter: XY,
  nearestRoad: XY[],
  setback: number,
  buildingSpec: typeof UK_BUILDING_TYPES.residential.terraced
): { center: XY; angle: number } {
  if (nearestRoad.length < 2) return { center: buildingCenter, angle: 0 };
  
  const [r1, r2] = nearestRoad;
  const roadDir = normalize({ x: r2.x - r1.x, y: r2.y - r1.y });
  const perpDir = perpendicular(roadDir);
  
  // Find closest point on road to building center
  const t = clamp(
    ((buildingCenter.x - r1.x) * roadDir.x + (buildingCenter.y - r1.y) * roadDir.y) /
    (roadDir.x * roadDir.x + roadDir.y * roadDir.y),
    0, 1
  );
  
  const closestPoint = {
    x: r1.x + t * (r2.x - r1.x),
    y: r1.y + t * (r2.y - r1.y)
  };
  
  // Position building at setback distance from road
  const alignedCenter = addXY(closestPoint, scaleXY(perpDir, setback + buildingSpec.length / 2));
  const angle = Math.atan2(roadDir.y, roadDir.x);
  
  return { center: alignedCenter, angle };
}

function generateParking(
  buildings: Array<{ footprint: XY[]; type: string }>,
  density: string,
  roads: RoadNetwork,
  rng: () => number
): Array<{
  type: 'on_street' | 'driveway' | 'parking_court' | 'garage';
  polygon: XY[];
  spaces: number;
}> {
  const parking = [];
  const spacesNeeded = Math.ceil(buildings.length * UK_PARKING_REQUIREMENTS[density as keyof typeof UK_PARKING_REQUIREMENTS]);
  
  if (density === 'low') {
    // Driveways for each house
    buildings.forEach(building => {
      const driveway = generateDriveway(building.footprint, 5.5, 3);
      if (driveway) {
        parking.push({
          type: 'driveway' as const,
          polygon: driveway,
          spaces: 2
        });
      }
    });
  } else if (density === 'medium') {
    // Mix of on-street and driveways
    const onStreetSpaces = Math.floor(spacesNeeded * 0.5);
    const onStreetParking = generateOnStreetParking(roads, onStreetSpaces);
    parking.push(...onStreetParking);
    
    // Some driveways
    buildings.slice(0, Math.floor(buildings.length * 0.5)).forEach(building => {
      const driveway = generateDriveway(building.footprint, 5, 2.5);
      if (driveway) {
        parking.push({
          type: 'driveway' as const,
          polygon: driveway,
          spaces: 1
        });
      }
    });
  } else {
    // High density: parking courts and on-street
    const onStreetSpaces = Math.floor(spacesNeeded * 0.3);
    const onStreetParking = generateOnStreetParking(roads, onStreetSpaces);
    parking.push(...onStreetParking);
    
    // Parking courts
    const courtSpaces = spacesNeeded - onStreetSpaces;
    const parkingCourts = generateParkingCourts(buildings, courtSpaces, rng);
    parking.push(...parkingCourts);
  }
  
  return parking;
}

function generateDriveway(buildingFootprint: XY[], length: number, width: number): XY[] | null {
  // Generate driveway to the side of building
  const front = buildingFootprint[0];
  const side = buildingFootprint[1];
  const dir = normalize({ x: side.x - front.x, y: side.y - front.y });
  const perpDir = perpendicular(dir);
  
  const driveway: XY[] = [
    front,
    addXY(front, scaleXY(dir, width)),
    addXY(addXY(front, scaleXY(dir, width)), scaleXY(perpDir, -length)),
    addXY(front, scaleXY(perpDir, -length))
  ];
  
  return driveway;
}

function generateOnStreetParking(
  roads: RoadNetwork,
  spacesNeeded: number
): Array<{
  type: 'on_street';
  polygon: XY[];
  spaces: number;
}> {
  const parking = [];
  const spaceLength = 5; // 5m per parallel parking space
  const spaceWidth = 2; // 2m width
  
  let spacesAllocated = 0;
  
  for (const segment of roads.segments) {
    if (spacesAllocated >= spacesNeeded) break;
    if (segment.type === 'mews') continue; // No parking on mews
    
    const [start, end] = segment.centerline;
    if (!start || !end) continue;
    
    const roadLength = distance(start, end);
    const possibleSpaces = Math.floor(roadLength / spaceLength);
    const spacesToAdd = Math.min(possibleSpaces, spacesNeeded - spacesAllocated);
    
    if (spacesToAdd > 0) {
      const dir = normalize({ x: end.x - start.x, y: end.y - start.y });
      const perpDir = perpendicular(dir);
      const offset = segment.width / 2 + spaceWidth / 2;
      
      // Create parking strip along road
      const parkingStrip: XY[] = [
        addXY(start, scaleXY(perpDir, offset)),
        addXY(end, scaleXY(perpDir, offset)),
        addXY(end, scaleXY(perpDir, offset + spaceWidth)),
        addXY(start, scaleXY(perpDir, offset + spaceWidth))
      ];
      
      parking.push({
        type: 'on_street' as const,
        polygon: parkingStrip,
        spaces: spacesToAdd
      });
      
      spacesAllocated += spacesToAdd;
    }
  }
  
  return parking;
}

function generateParkingCourts(
  buildings: Array<{ footprint: XY[] }>,
  spacesNeeded: number,
  rng: () => number
): Array<{
  type: 'parking_court';
  polygon: XY[];
  spaces: number;
}> {
  const courts = [];
  const spacesPerCourt = 10;
  const courtWidth = 15;
  const courtLength = 20;
  
  const numCourts = Math.ceil(spacesNeeded / spacesPerCourt);
  
  for (let i = 0; i < numCourts && i < 3; i++) {
    // Place courts between building groups
    const idx = Math.floor(rng() * buildings.length);
    const nearBuilding = buildings[idx];
    if (!nearBuilding) continue;
    
    const buildingCenter = centroidXY(nearBuilding.footprint);
    const offset = 25 + randRange(rng, -5, 5);
    const angle = randRange(rng, 0, Math.PI * 2);
    
    const courtCenter = {
      x: buildingCenter.x + offset * Math.cos(angle),
      y: buildingCenter.y + offset * Math.sin(angle)
    };
    
    const courtPolygon = rectCornersXY(courtCenter, courtWidth, courtLength, angle);
    
    courts.push({
      type: 'parking_court' as const,
      polygon: courtPolygon,
      spaces: Math.min(spacesPerCourt, spacesNeeded - i * spacesPerCourt)
    });
  }
  
  return courts;
}

function centroidXY(poly: XY[]): XY {
  let x = 0, y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

function checkBuildingSeparation(
  building1: XY[],
  building2: XY[],
  rules: typeof UK_SPACING_RULES
): boolean {
  // Check window-to-window distance (simplified as centroid distance)
  const c1 = centroidXY(building1);
  const c2 = centroidXY(building2);
  const dist = distance(c1, c2);
  
  // Check if buildings face each other (simplified)
  if (dist < rules.windowToWindow) {
    // More detailed check would consider actual window positions
    return false;
  }
  
  // Check minimum side spacing
  for (const p1 of building1) {
    for (const p2 of building2) {
      if (distance(p1, p2) < rules.sideSpacing) {
        return false;
      }
    }
  }
  
  return true;
}

// -----------------------------
// Main Flow Implementation
// -----------------------------
const generateBuildingLayoutFlow = ai.defineFlow(
  {
    name: 'generateBuildingLayoutFlow',
    inputSchema: GenerateBuildingLayoutInputSchema,
    outputSchema: GenerateBuildingLayoutOutputSchema,
  },
  async (input) => {
    const { zonePolygon, density, characterArea = 'suburban' } = input;

    if (!zonePolygon || zonePolygon.length < 3) {
      return { buildings: [], roads: [], parking: [] };
    }

    // Projection helpers
    const origin = centroidLatLng(zonePolygon);
    const { toXY, toLatLng } = projectToXYFactory(origin);
    const zoneXY = polygonToXY(zonePolygon, toXY);
    const zoneArea = polygonAreaXY(zoneXY);

    // Seeded RNG
    const seedStr = JSON.stringify(zonePolygon) + '|' + density + '|' + characterArea;
    const rng = mulberry32(hashSeed(seedStr));

    // Generate road network first
    const roadNetwork = generateRoadNetwork(zoneXY, density, rng);

    // Select building types based on density and character
    const buildingTypes = selectBuildingTypes(density, characterArea, rng);

    // Density parameters with UK patterns
    const densityParams = {
      low: {
        pattern: 'cul_de_sac',
        margin: 10,
        plotDepth: 30,
        frontage: 12,
        targetDensity: 20, // dwellings per hectare
      },
      medium: {
        pattern: 'linear',
        margin: 6,
        plotDepth: 20,
        frontage: 6,
        targetDensity: 40,
      },
      high: {
        pattern: 'perimeter',
        margin: 3.5,
        plotDepth: 15,
        frontage: 8,
        targetDensity: 60,
      },
    } as const;

    const params = densityParams[density];
    const targetBuildings = Math.floor((zoneArea / 10000) * params.targetDensity);

    // Generate buildings
    const buildings: Array<z.infer<typeof BuildingSchema>> = [];
    const placedRectsXY: XY[][] = [];

    // Grid or scattered placement for all densities
    for (const segment of roadNetwork.segments) {
      if (buildings.length >= targetBuildings) break;

      const placementPoints = generatePlacementPoints(segment, params.frontage, rng);

      for (const point of placementPoints) {
        if (buildings.length >= targetBuildings) break;
        if (!pointInPolygonXY(point, zoneXY)) continue;

        const buildingType = buildingTypes[Math.floor(rng() * buildingTypes.length)];
        const spec = getBuildingSpec(buildingType);

        // Align to nearest road
        const aligned = alignToStreetGrid(point, segment.centerline, spec.setback, spec);
        const footprint = rectCornersXY(aligned.center, spec.width, spec.length, aligned.angle);

        if (rectangleInsidePolygon(footprint, zoneXY)) {
          let canPlace = true;

          // Check separation rules
          for (const existing of placedRectsXY) {
            if (!checkBuildingSeparation(footprint, existing, UK_SPACING_RULES)) {
              canPlace = false;
              break;
            }
          }

          if (canPlace) {
            // Generate garden
            const gardenDepth = UK_SPACING_RULES.minGardenDepth[density];
            const gardenDir = perpendicular(normalize({ 
              x: segment.centerline[1].x - segment.centerline[0].x,
              y: segment.centerline[1].y - segment.centerline[0].y
            }));
            const garden = generateGardenSpace(
              { footprint, rotation: angleFromNorthDegrees(aligned.angle) },
              gardenDepth,
              gardenDir
            );

            buildings.push({
              type: buildingType as any,
              footprint: footprint.map(toLatLng),
              floors: spec.floors,
              rotation: angleFromNorthDegrees(aligned.angle),
              gardenSpace: garden.map(toLatLng),
              parkingSpaces: UK_PARKING_REQUIREMENTS[density],
              groundFloorUse: characterArea === 'town_center' && rng() > 0.5 ? 'retail' : 'residential'
            });

            placedRectsXY.push(footprint);
          }
        }
      }
    }


    // Generate parking areas
    const parkingXY = generateParking(
      placedRectsXY.map(rect => ({ footprint: rect, type: 'generic' })),
      density,
      roadNetwork,
      rng
    );

    // Convert to lat/lng
    const roads = roadNetwork.segments.map(segment => ({
      type: segment.type,
      centerline: segment.centerline.map(toLatLng),
      width: segment.width,
      hasFootpath: segment.type !== 'mews',
      hasCycleLane: segment.type === 'primary'
    }));

    const parking = parkingXY.map(p => ({
      type: p.type,
      polygon: p.polygon.map(toLatLng),
      spaces: p.spaces
    }));

    return { buildings, roads, parking };
  }
);

// Helper functions
function selectBuildingTypes(
  density: string,
  characterArea: string,
  rng: () => number
): string[] {
  const types: string[] = [];

  if (characterArea === 'victorian') {
    types.push('terraced', 'terraced', 'semi_detached');
  } else if (characterArea === 'suburban') {
    if (density === 'low') {
      types.push('detached', 'detached', 'bungalow');
    } else {
      types.push('semi_detached', 'semi_detached', 'terraced');
    }
  } else if (characterArea === 'modern') {
    types.push('flat_block', 'maisonette', 'detached');
  } else if (characterArea === 'town_center') {
    types.push('mixed_use', 'flat_block', 'maisonette');
  } else {
    types.push('detached', 'bungalow');
  }

  return types;
}

function getBuildingSpec(type: string) {
  const specs = { ...UK_BUILDING_TYPES.residential, ...UK_BUILDING_TYPES.mixed };
  return specs[type as keyof typeof specs] || UK_BUILDING_TYPES.residential.detached;
}

function generatePlacementPoints(
  road: { centerline: XY[]; width: number },
  spacing: number,
  rng: () => number
): XY[] {
  const points: XY[] = [];
  if (road.centerline.length < 2) return points;

  const [start, end] = road.centerline;
  const roadLength = distance(start, end);
  const numPoints = Math.floor(roadLength / spacing);

  for (let i = 0; i < numPoints; i++) {
    const t = (i + 0.5) / numPoints;
    const basePoint = {
      x: start.x + t * (end.x - start.x),
      y: start.y + t * (end.y - start.y)
    };

    // Add jitter
    const jitter = randRange(rng, -spacing * 0.2, spacing * 0.2);
    const dir = normalize({ x: end.x - start.x, y: end.y - start.y });
    points.push(addXY(basePoint, scaleXY(dir, jitter)));
  }

  return points;
}

export { generateBuildingLayoutFlow };
export async function generateBuildingLayout(input: GenerateBuildingLayoutInput): Promise<GenerateBuildingLayoutOutput> {
  return generateBuildingLayoutFlow(input);
}
