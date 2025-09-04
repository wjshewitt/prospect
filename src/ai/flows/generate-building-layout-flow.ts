
'use server';
/**
 * @fileOverview Enhanced UK-specific procedural generation for building layouts and roads.
 * @version 2.0.0
 * @description Implements a robust "Plot-First" generation methodology to ensure reliable and
 * realistic layouts based on defined development styles. This version fixes generation
 * failures, provides direct control over layout patterns, and improves overall realism.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// -----------------------------
// SCHEMAS (ENHANCED FOR CONTROL)
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
  hasCycleLane: z.boolean().optional(),
});

// NEW: Schema for Open Spaces
const OpenSpaceSchema = z.object({
  type: z.enum(['park', 'playground', 'green_belt']).describe('Type of public open space.'),
  polygon: z.array(PointSchema).describe('The boundary of the open space.'),
});

const ParkingAreaSchema = z.object({
  type: z.enum(['on_street', 'driveway', 'parking_court', 'garage']),
  polygon: z.array(PointSchema),
  spaces: z.number(),
});

// ENHANCED: Input schema with user-selectable layout styles
const GenerateBuildingLayoutInputSchema = z.object({
  zonePolygon: z.array(PointSchema).describe('An array of points defining the boundary of the zone.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the building layout.'),
  characterArea: z.enum(['victorian', 'suburban', 'modern', 'rural', 'town_center']).optional(),
  // NEW: The user's primary control for the generation style.
  layoutStyle: z.enum([
    'suburban_cul_de_sac',
    'urban_grid',
    'organic_winding'
  ]).default('suburban_cul_de_sac').describe('The overall street layout pattern for the development.'),
});
export type GenerateBuildingLayoutInput = z.infer<typeof GenerateBuildingLayoutInputSchema>;

// ENHANCED: Output schema to include open spaces
const GenerateBuildingLayoutOutputSchema = z.object({
  buildings: z.array(BuildingSchema).describe('An array of generated building objects.'),
  roads: z.array(RoadSegmentSchema).describe('Generated road network.'),
  parking: z.array(ParkingAreaSchema).describe('Parking areas.'),
  openSpaces: z.array(OpenSpaceSchema).describe('Generated public open spaces like parks.'), // NEW
});
export type GenerateBuildingLayoutOutput = z.infer<typeof GenerateBuildingLayoutOutputSchema>;


// -----------------------------
// UK CONSTANTS & SPECIFICATIONS
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

const UK_SPACING_RULES = {
  windowToWindow: 21,
  backToBack: 10.5,
  sideSpacing: 1,
  cornerVisibility: 2.4,
  minGardenDepth: { low: 10, medium: 6, high: 3 }
};

const UK_PARKING_REQUIREMENTS = {
  low: 2.0,
  medium: 1.5,
  high: 1.0
};

const UK_ROAD_SPECS = {
  primary: { width: 7.3, footpathWidth: 2, cycleLane: true },
  secondary: { width: 6.0, footpathWidth: 1.8, cycleLane: false },
  residential: { width: 5.5, footpathWidth: 1.5, cycleLane: false },
  cul_de_sac: { width: 5.0, footpathWidth: 1.2, cycleLane: false },
  mews: { width: 4.0, footpathWidth: 0, cycleLane: false },
};


// -----------------------------
// GEOMETRY UTILITIES (Complete & Unchanged)
// -----------------------------
type LatLng = { lat: number; lng: number };
type XY = { x: number; y: number };

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function metersPerDegreeLat(): number { return 111_320; }
function metersPerDegreeLng(latDeg: number): number { return 111_320 * Math.cos(latDeg * DEG2RAD); }

function centroidLatLng(poly: LatLng[]): LatLng {
  const n = poly.length;
  let lat = 0, lng = 0;
  for (const p of poly) { lat += p.lat; lng += p.lng; }
  return { lat: lat / n, lng: lng / n };
}

function projectToXYFactory(origin: LatLng) {
  const mLat = metersPerDegreeLat();
  const mLng = metersPerDegreeLng(origin.lat);
  return {
    toXY: (p: LatLng): XY => ({ x: (p.lng - origin.lng) * mLng, y: (p.lat - origin.lat) * mLat }),
    toLatLng: (p: XY): LatLng => ({ lat: origin.lat + p.y / mLat, lng: origin.lng + p.x / mLng }),
  };
}

function polygonToXY(poly: LatLng[], toXY: (p: LatLng) => XY): XY[] { return poly.map(toXY); }

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
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function orientation(a: XY, b: XY, c: XY): number { return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y); }

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
  const dx = w / 2, dy = h / 2;
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
  const local: XY[] = [{ x: -dx, y: -dy }, { x: +dx, y: -dy }, { x: +dx, y: +dy }, { x: -dx, y: +dy }];
  return local.map((p) => ({ x: center.x + p.x * cos - p.y * sin, y: center.y + p.x * sin + p.y * cos }));
}

function polygonEdges(poly: XY[]): Array<[XY, XY]> {
  const edges: Array<[XY, XY]> = [];
  for (let i = 0; i < poly.length; i++) { edges.push([poly[i], poly[(i + 1) % poly.length]]); }
  return edges;
}

function polygonIntersectsPolygon(a: XY[], b: XY[]): boolean {
  const ea = polygonEdges(a), eb = polygonEdges(b);
  for (const [p1, q1] of ea) {
    for (const [p2, q2] of eb) { if (segmentsIntersect(p1, q1, p2, q2)) return true; }
  }
  if (pointInPolygonXY(a[0], b)) return true;
  if (pointInPolygonXY(b[0], a)) return true;
  return false;
}

function rectangleInsidePolygon(rect: XY[], poly: XY[]): boolean {
  for (const r of rect) { if (!pointInPolygonXY(r, poly)) return false; }
  return true;
}

function angleFromNorthDegrees(angleFromXRad: number): number {
  let deg = (90 - angleFromXRad * RAD2DEG) % 360;
  if (deg < 0) deg += 360;
  return deg;
}

function distance(a: XY, b: XY): number { return Math.hypot(b.x - a.x, b.y - a.y); }
function normalize(v: XY): XY { const len = Math.hypot(v.x, v.y); if (len < 1e-9) return { x: 1, y: 0 }; return { x: v.x / len, y: v.y / len }; }
function perpendicular(v: XY): XY { return { x: -v.y, y: v.x }; }
function addXY(a: XY, b: XY): XY { return { x: a.x + b.x, y: a.y + b.y }; }
function scaleXY(a: XY, s: number): XY { return { x: a.x * s, y: a.y * s }; }
function offsetLine(p1: XY, p2: XY, offset: number): [XY, XY] {
  const dir = normalize({ x: p2.x - p1.x, y: p2.y - p1.y });
  const perp = perpendicular(dir);
  const offsetVec = scaleXY(perp, offset);
  return [addXY(p1, offsetVec), addXY(p2, offsetVec)];
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
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

function randRange(rng: () => number, min: number, max: number): number { return min + (max - min) * rng(); }
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

// ----------------------------------------------------
// NEW: PLOT-FIRST GENERATION ENGINE (CORE LOGIC)
// ----------------------------------------------------

/**
 * NEW: A dedicated class to manage the state of the generation process.
 * This encapsulates all the data and makes the main flow cleaner.
 */
class GenerationContext {
  public projection: { toXY: (p: LatLng) => XY; toLatLng: (p: XY) => LatLng; };
  public rng: () => number;
  public zoneXY: XY[];
  public buildings: Array<Omit<z.infer<typeof BuildingSchema>, 'footprint' | 'gardenSpace'> & { footprint: XY[], gardenSpace?: XY[] }> = [];
  public roads: Array<Omit<z.infer<typeof RoadSegmentSchema>, 'centerline'> & { centerline: XY[] }> = [];
  public parking: Array<Omit<z.infer<typeof ParkingAreaSchema>, 'polygon'> & { polygon: XY[] }> = [];
  public openSpaces: Array<Omit<z.infer<typeof OpenSpaceSchema>, 'polygon'> & { polygon: XY[] }> = [];

  constructor(public input: GenerateBuildingLayoutInput) {
    const origin = centroidLatLng(input.zonePolygon);
    this.projection = projectToXYFactory(origin);
    this.zoneXY = polygonToXY(input.zonePolygon, this.projection.toXY);

    const seedStr = JSON.stringify(input.zonePolygon) + '|' + input.density + '|' + input.layoutStyle;
    this.rng = mulberry32(hashSeed(seedStr));
  }

  finalizeOutput(): GenerateBuildingLayoutOutput {
    const { toLatLng } = this.projection;
    return {
      buildings: this.buildings.map(b => ({ ...b, footprint: b.footprint.map(toLatLng), gardenSpace: b.gardenSpace?.map(toLatLng) })),
      roads: this.roads.map(r => ({ ...r, centerline: r.centerline.map(toLatLng) })),
      parking: this.parking.map(p => ({ ...p, polygon: p.polygon.map(toLatLng) })),
      openSpaces: this.openSpaces.map(o => ({ ...o, polygon: o.polygon.map(toLatLng) })),
    };
  }
}

/**
 * NEW: Step 1 - Generate the road network based on the chosen layout style.
 */
function generateRoadNetwork(ctx: GenerationContext) {
  const { layoutStyle, density } = ctx.input;
  let roadNetwork: { segments: any[], intersections: XY[] };

  switch (layoutStyle) {
    case 'urban_grid':
      roadNetwork = generateGridRoads_Strategy(ctx.zoneXY, density === 'high' ? 40 : 55);
      break;
    case 'organic_winding':
      roadNetwork = generateCulDeSacRoads_Strategy(ctx.zoneXY, 70, ctx.rng, true);
      break;
    case 'suburban_cul_de_sac':
    default:
      roadNetwork = generateCulDeSacRoads_Strategy(ctx.zoneXY, 80, ctx.rng, false);
      break;
  }
  ctx.roads = roadNetwork.segments.map(s => ({ ...s, hasFootpath: s.type !== 'mews', hasCycleLane: s.type === 'primary' }));
}

/**
 * NEW: Step 2 - Take the road network and define the plots for development. This is the core of the new reliable system.
 */
function generatePlotsAndBuildings(ctx: GenerationContext) {
    const { density, characterArea = 'suburban' } = ctx.input;
    const buildingTypes = selectBuildingTypes(density, characterArea, ctx.rng);
    const plotFrontage = density === 'high' ? 8 : (density === 'medium' ? 12 : 18);
    const plotDepth = density === 'high' ? 15 : (density === 'medium' ? 22 : 30);

    for (const road of ctx.roads) {
        if (road.centerline.length < 2 || road.type === 'primary') continue;

        for (const side of [-1, 1]) {
            const roadLength = distance(road.centerline[0], road.centerline[road.centerline.length -1]);
            const numPlots = Math.floor(roadLength / plotFrontage);
            if (numPlots <= 0) continue;

            const roadDir = normalize({ x: road.centerline[1].x - road.centerline[0].x, y: road.centerline[1].y - road.centerline[0].y });
            const perpDir = scaleXY(perpendicular(roadDir), side);

            for (let i = 0; i < numPlots; i++) {
                const t = (i + 0.5) / numPlots;
                const roadMidpoint = {
                    x: road.centerline[0].x + t * (road.centerline[1].x - road.centerline[0].x),
                    y: road.centerline[0].y + t * (road.centerline[1].y - road.centerline[0].y)
                };

                const plotOffset = road.width / 2;
                const p1 = addXY(addXY(roadMidpoint, scaleXY(roadDir, -plotFrontage / 2)), scaleXY(perpDir, plotOffset));
                const p2 = addXY(addXY(roadMidpoint, scaleXY(roadDir, +plotFrontage / 2)), scaleXY(perpDir, plotOffset));
                const p3 = addXY(p2, scaleXY(perpDir, plotDepth));
                const p4 = addXY(p1, scaleXY(perpDir, plotDepth));
                const plotPolygon = [p1, p2, p3, p4];

                if (!rectangleInsidePolygon(plotPolygon, ctx.zoneXY)) continue;
                
                const buildingType = buildingTypes[Math.floor(ctx.rng() * buildingTypes.length)];
                const spec = getBuildingSpec(buildingType, ctx.rng);
                
                const setback = spec.setback;
                const buildingCenter = addXY(roadMidpoint, scaleXY(perpDir, plotOffset + setback + spec.length / 2));
                const angle = Math.atan2(roadDir.y, roadDir.x);
                const footprint = rectCornersXY(buildingCenter, spec.width, spec.length, angle);
                
                if (!rectangleInsidePolygon(footprint, plotPolygon)) continue;
                if (ctx.buildings.some(b => polygonIntersectsPolygon(footprint, b.footprint))) continue;
                
                const garden = [footprint[2], footprint[3], p3, p4];

                ctx.buildings.push({
                  type: buildingType as any,
                  footprint,
                  floors: spec.floors,
                  rotation: angleFromNorthDegrees(angle),
                  gardenSpace: garden,
                  parkingSpaces: UK_PARKING_REQUIREMENTS[density],
                  groundFloorUse: characterArea === 'town_center' && ctx.rng() > 0.5 ? 'retail' : 'residential'
                });

                if (density !== 'high') {
                  const driveway = generateDriveway(footprint, 6, 3, perpDir);
                  if(driveway && rectangleInsidePolygon(driveway, plotPolygon)) {
                    ctx.parking.push({ type: 'driveway', polygon: driveway, spaces: 2 });
                  }
                }
            }
        }
    }
}


// -----------------------------
// MAIN FLOW IMPLEMENTATION (REWRITTEN)
// -----------------------------
const generateBuildingLayoutFlow = ai.defineFlow(
  {
    name: 'generateBuildingLayoutFlow',
    inputSchema: GenerateBuildingLayoutInputSchema,
    outputSchema: GenerateBuildingLayoutOutputSchema,
  },
  async (input) => {
    if (!input.zonePolygon || input.zonePolygon.length < 3) {
      return { buildings: [], roads: [], parking: [], openSpaces: [] };
    }
    const ctx = new GenerationContext(input);
    generateRoadNetwork(ctx);
    generatePlotsAndBuildings(ctx);
    if (input.layoutStyle === 'urban_grid' || input.density === 'high') {
      const onStreetParking = generateOnStreetParking(ctx.roads, ctx.buildings.length, ctx.rng);
      ctx.parking.push(...onStreetParking);
    }
    return ctx.finalizeOutput();
  }
);


// -----------------------------
// HELPER & STRATEGY FUNCTIONS
// -----------------------------

// MODIFIED: getBuildingSpec now includes randomized dimensions for variety
function getBuildingSpec(type: string, rng: () => number) {
  const specs = { ...UK_BUILDING_TYPES.residential, ...UK_BUILDING_TYPES.mixed };
  const baseSpec = specs[type as keyof typeof specs] || UK_BUILDING_TYPES.residential.detached;
  const widthVariance = 1 + randRange(rng, -0.1, 0.1);
  const lengthVariance = 1 + randRange(rng, -0.1, 0.1);
  return { ...baseSpec, width: baseSpec.width * widthVariance, length: baseSpec.length * lengthVariance };
}

function selectBuildingTypes(density: string, characterArea: string, rng: () => number): string[] {
  if (characterArea === 'victorian') return ['terraced', 'terraced', 'semi_detached'];
  if (characterArea === 'suburban') return density === 'low' ? ['detached', 'detached', 'bungalow'] : ['semi_detached', 'semi_detached', 'terraced'];
  if (characterArea === 'modern') return ['flat_block', 'maisonette', 'detached'];
  if (characterArea === 'town_center') return ['mixed_use', 'flat_block', 'maisonette'];
  return ['detached', 'bungalow'];
}

function generateDriveway(buildingFootprint: XY[], length: number, width: number, perpDir: XY): XY[] | null {
  const frontLeft = buildingFootprint[3]; // Assuming counter-clockwise from bottom-left
  const frontRight = buildingFootprint[2];
  const sideDir = normalize({ x: frontRight.x - frontLeft.x, y: frontRight.y - frontLeft.y });
  const drivewayStart = addXY(frontLeft, scaleXY(sideDir, -width - 0.5)); // Start driveway to the left of the house
  const p1 = drivewayStart;
  const p2 = addXY(p1, scaleXY(sideDir, width));
  const p3 = addXY(p2, scaleXY(perpDir, -length));
  const p4 = addXY(p1, scaleXY(perpDir, -length));
  return [p1,p2,p3,p4];
}

function generateOnStreetParking(roads: Array<{ centerline: XY[], width: number, type: string }>, spacesNeeded: number, rng: () => number) {
    const parking: Array<{ type: 'on_street', polygon: XY[], spaces: number }> = [];
    let spacesAllocated = 0;
    for (const road of roads) {
        if (spacesAllocated >= spacesNeeded || road.type === 'mews' || road.type === 'cul_de_sac' || road.centerline.length < 2) continue;
        const roadLength = distance(road.centerline[0], road.centerline[1]);
        const possibleSpaces = Math.floor(roadLength / 5.0);
        if (possibleSpaces <= 0) continue;
        const start = road.centerline[0], end = road.centerline[1];
        const roadDir = normalize({ x: end.x - start.x, y: end.y - start.y });
        const perpDir = perpendicular(roadDir);
        const offset = road.width / 2;
        const p1 = addXY(start, scaleXY(perpDir, offset));
        const p2 = addXY(end, scaleXY(perpDir, offset));
        const p3 = addXY(p2, scaleXY(perpDir, 2.0));
        const p4 = addXY(p1, scaleXY(perpDir, 2.0));
        parking.push({ type: 'on_street', polygon: [p1,p2,p3,p4], spaces: possibleSpaces });
        spacesAllocated += possibleSpaces;
    }
    return parking;
}

// -----------------------------
// ROAD NETWORK STRATEGIES
// -----------------------------

function findPrimaryStreetEdge(poly: XY[]): [XY, XY] {
  let bestEdge: [XY, XY] = [poly[0], poly[1]];
  let maxLength = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const len = distance(poly[i], poly[j]);
    if (len > maxLength) { maxLength = len; bestEdge = [poly[i], poly[j]]; }
  }
  return bestEdge;
}

function generateMainRoad(edge: [XY, XY], zoneXY: XY[]): XY[] {
  const [p1, p2] = offsetLine(edge[0], edge[1], 10);
  return (pointInPolygonXY(p1, zoneXY) && pointInPolygonXY(p2, zoneXY)) ? [p1, p2] : [edge[0], edge[1]];
}

function generatePerpendicularRoads(mainRoad: XY[], zoneXY: XY[], spacing: number, rng: () => number, organic: boolean): XY[][] {
    const roads: XY[][] = [];
    const [start, end] = mainRoad;
    const mainLength = distance(start, end);
    const mainDir = normalize({ x: end.x - start.x, y: end.y - start.y });
    const perpDir = perpendicular(mainDir);
    const numRoads = Math.floor(mainLength / spacing);
    if (numRoads <= 0) return [];
    
    for (let i = 1; i <= numRoads; i++) {
        const t = i / (numRoads + 1);
        const basePoint = { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) };
        const jitter = randRange(rng, -spacing * 0.2, spacing * 0.2);
        const roadStart = addXY(basePoint, scaleXY(mainDir, jitter));

        let roadEnd = roadStart;
        for (let ext = 5; ext <= 200; ext += 5) {
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

function generateTurningCircle(center: XY, radius: number, segments: number): XY[] {
    const points: XY[] = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    }
    return points;
}

function generateCulDeSacRoads_Strategy(zoneXY: XY[], spacing: number, rng: () => number, organic: boolean) {
    const network: { segments: any[], intersections: XY[] } = { segments: [], intersections: [] };
    const mainRoad = generateMainRoad(findPrimaryStreetEdge(zoneXY), zoneXY);
    network.segments.push({ type: 'secondary', centerline: mainRoad, width: UK_ROAD_SPECS.secondary.width });

    const perpRoads = generatePerpendicularRoads(mainRoad, zoneXY, spacing, rng, organic);
    perpRoads.forEach(road => {
        network.segments.push({ type: 'cul_de_sac', centerline: road, width: UK_ROAD_SPECS.cul_de_sac.width });
        const endPoint = road[road.length-1];
        const turningCircle = generateTurningCircle(endPoint, 9, 8);
        network.segments.push({ type: 'cul_de_sac', centerline: turningCircle, width: UK_ROAD_SPECS.cul_de_sac.width });
        network.intersections.push(road[0]);
    });
    return network;
}

function generateGridRoads_Strategy(zoneXY: XY[], spacing: number) {
    const network: { segments: any[], intersections: XY[] } = { segments: [], intersections: [] };
    const bounds = getPolygonBounds(zoneXY);
    const roads: XY[][] = [];

    for (let y = bounds.minY + spacing; y < bounds.maxY; y += spacing) {
        const start = {x: bounds.minX, y};
        const end = {x: bounds.maxX, y};
        if(pointInPolygonXY(addXY(start, {x: spacing, y:0}), zoneXY) || pointInPolygonXY(addXY(end, {x: -spacing, y:0}), zoneXY)) roads.push([start, end]);
    }
    for (let x = bounds.minX + spacing; x < bounds.maxX; x += spacing) {
        const start = {x, y: bounds.minY};
        const end = {x, y: bounds.maxY};
        if(pointInPolygonXY(addXY(start, {x: 0, y: spacing}), zoneXY) || pointInPolygonXY(addXY(end, {x: 0, y: -spacing}), zoneXY)) roads.push([start, end]);
    }

    roads.forEach((road, i) => {
        network.segments.push({
            type: i < 2 ? 'primary' : 'residential',
            centerline: road,
            width: UK_ROAD_SPECS[i < 2 ? 'primary' : 'residential'].width
        });
    });
    return network;
}

// -----------------------------
// EXPORTS
// -----------------------------
export { generateBuildingLayoutFlow };
export async function generateBuildingLayout(input: GenerateBuildingLayoutInput): Promise<GenerateBuildingLayoutOutput> {
  return generateBuildingLayoutFlow(input);
}
