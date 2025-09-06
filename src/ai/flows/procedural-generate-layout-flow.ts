'use server';

/**
 * src/ai/flows/procedural-generate-layout-flow.ts
 *
 * This module MUST export:
 * - proceduralGenerateLayout (named)
 * - proceduralGenerateLayoutFlow (named)
 * - default export = proceduralGenerateLayout
 *
 * If you still see "module has no exports", restart the dev server to clear Turbopack cache.
 */

import {ai} from '@/ai/genkit';
import * as turf from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson';

import {
  ProceduralGenerateLayoutInputSchema,
  ProceduralGenerateLayoutOutputSchema,
  type ProceduralGenerateLayoutInput,
  type ProceduralGenerateLayoutOutput,
} from '@/lib/procedural-types';

/* -----------------------------------------------------------------------------
   Flow definition
----------------------------------------------------------------------------- */

export const proceduralGenerateLayoutFlow = ai.defineFlow(
  {
    name: 'proceduralGenerateLayoutFlow',
    inputSchema: ProceduralGenerateLayoutInputSchema,
    outputSchema: ProceduralGenerateLayoutOutputSchema,
  },
  async (input: ProceduralGenerateLayoutInput): Promise<ProceduralGenerateLayoutOutput> => {
    return proceduralGenerateLayout(input);
  }
);

/* -----------------------------------------------------------------------------
   Public API (named + default export)
----------------------------------------------------------------------------- */

export async function proceduralGenerateLayout(
  input: ProceduralGenerateLayoutInput
): Promise<ProceduralGenerateLayoutOutput> {
  const cfg = normalizeSettings(input);

  // Boundary normalization
  const boundary = boundaryToPolygon(input.boundary);
  const seed = cfg.seed ? Number(cfg.seed) : hashBoundaryAndSettings(input.boundary, cfg);
  const rng = mulberry32(seed);

  // Local projector (meters) centered at site centroid
  const center = (turf.centroid(boundary).geometry.coordinates as [number, number]) ?? [0, 0];
  const projector = new LocalProjector(center);

  // 1) Roads (space-colonization-like growth toward random in-boundary attractors)
  const roadGen = generateRoadNetwork(boundary, cfg, rng, projector);

  // 2) Blocks = boundary minus buffered road corridors
  const blocks = computeBlocks(boundary, roadGen.roads, cfg);

  // 3) Parcels = Voronoi subdivision per block; bias seeds closer to roads
  const parcels = subdivideBlocksToParcels(blocks, roadGen.roads, cfg, rng);

  // 4) Green Spaces = select most accessible parcels until target ratio
  const { greenSpaces, developableParcels } = allocateGreenSpaces(parcels, roadGen.attractors, cfg);

  // 5) Buildings = one rule-based footprint per developable parcel
  const buildings = placeBuildings(developableParcels, roadGen.roads, cfg, rng);

  return {
    roads: roadGen.roads,
    parcels,
    greenSpaces,
    buildings,
  };
}

export default proceduralGenerateLayout;

/* -----------------------------------------------------------------------------
   Settings
----------------------------------------------------------------------------- */

type Density = 'low' | 'medium' | 'high' | 'very-high';
type Layout = 'grid' | 'organic' | string;

type NormalizedSettings = {
  seed?: number;
  density: Density;
  layout: Layout;

  // Roads
  roadWidthM: number;
  majorSegmentLenM: number;
  majorInfluenceRadiusM: number;
  majorKillDistanceM: number;

  // Parcels
  minParcelAreaM2: number;
  targetParcelAreaM2: number;

  // Buildings
  setbackM: number;
  minBldgWidthM: number;
  maxBldgWidthM: number;
  minBldgDepthM: number;
  maxBldgDepthM: number;

  // Green space
  greenspaceRatio: number;

  // Performance/preview
  simplifyToleranceM: number;
};

function normalizeSettings(input: ProceduralGenerateLayoutInput): NormalizedSettings {
  const anyInput = input as any;
  const density: Density = (anyInput.density ?? 'medium') as Density;
  const layout: Layout = (anyInput.layout ?? 'organic') as Layout;

  const densityParams: Record<Density, Partial<NormalizedSettings>> = {
    low: {
      roadWidthM: 12,
      majorSegmentLenM: 80,
      majorInfluenceRadiusM: 220,
      majorKillDistanceM: 45,
      minParcelAreaM2: 450,
      targetParcelAreaM2: 1200,
      setbackM: 6,
      minBldgWidthM: 8,
      maxBldgWidthM: 18,
      minBldgDepthM: 8,
      maxBldgDepthM: 15,
      greenspaceRatio: 0.18,
      simplifyToleranceM: 0.8,
    },
    medium: {
      roadWidthM: 14,
      majorSegmentLenM: 65,
      majorInfluenceRadiusM: 200,
      majorKillDistanceM: 40,
      minParcelAreaM2: 350,
      targetParcelAreaM2: 900,
      setbackM: 4.5,
      minBldgWidthM: 8,
      maxBldgWidthM: 22,
      minBldgDepthM: 9,
      maxBldgDepthM: 20,
      greenspaceRatio: 0.15,
      simplifyToleranceM: 0.6,
    },
    high: {
      roadWidthM: 16,
      majorSegmentLenM: 55,
      majorInfluenceRadiusM: 180,
      majorKillDistanceM: 35,
      minParcelAreaM2: 260,
      targetParcelAreaM2: 650,
      setbackM: 3.5,
      minBldgWidthM: 10,
      maxBldgWidthM: 28,
      minBldgDepthM: 10,
      maxBldgDepthM: 26,
      greenspaceRatio: 0.14,
      simplifyToleranceM: 0.5,
    },
    'very-high': {
      roadWidthM: 18,
      majorSegmentLenM: 48,
      majorInfluenceRadiusM: 160,
      majorKillDistanceM: 30,
      minParcelAreaM2: 200,
      targetParcelAreaM2: 480,
      setbackM: 2.5,
      minBldgWidthM: 12,
      maxBldgWidthM: 34,
      minBldgDepthM: 12,
      maxBldgDepthM: 32,
      greenspaceRatio: 0.13,
      simplifyToleranceM: 0.4,
    },
  };

  const base = densityParams[density];

  const cfg: NormalizedSettings = {
    seed: anyInput.seed ? Number(anyInput.seed) : undefined,
    density,
    layout,

    roadWidthM: Number(anyInput.roadWidthM ?? base.roadWidthM),
    majorSegmentLenM: Number(anyInput.majorSegmentLenM ?? base.majorSegmentLenM),
    majorInfluenceRadiusM: Number(anyInput.majorInfluenceRadiusM ?? base.majorInfluenceRadiusM),
    majorKillDistanceM: Number(anyInput.majorKillDistanceM ?? base.majorKillDistanceM),

    minParcelAreaM2: Number(anyInput.minParcelAreaM2 ?? base.minParcelAreaM2),
    targetParcelAreaM2: Number(anyInput.targetParcelAreaM2 ?? base.targetParcelAreaM2),

    setbackM: Number(anyInput.setbackM ?? base.setbackM),
    minBldgWidthM: Number(anyInput.minBldgWidthM ?? base.minBldgWidthM),
    maxBldgWidthM: Number(anyInput.maxBldgWidthM ?? base.maxBldgWidthM),
    minBldgDepthM: Number(anyInput.minBldgDepthM ?? base.minBldgDepthM),
    maxBldgDepthM: Number(anyInput.maxBldgDepthM ?? base.maxBldgDepthM),

    greenspaceRatio: Number(anyInput.greenspaceRatio ?? base.greenspaceRatio),
    simplifyToleranceM: Number(anyInput.simplifyToleranceM ?? base.simplifyToleranceM),
  };

  if (layout === 'grid') {
    cfg.majorSegmentLenM *= 1.15;
    cfg.majorInfluenceRadiusM *= 1.1;
  } else if (layout === 'organic') {
    cfg.majorSegmentLenM *= 0.95;
    cfg.majorInfluenceRadiusM *= 0.95;
  }

  return cfg;
}

/* -----------------------------------------------------------------------------
   Road generation (space-colonization-like)
----------------------------------------------------------------------------- */

type RoadNode = { x: number; y: number; lng: number; lat: number };
type RoadEdge = { a: number; b: number };

type RoadGenResult = {
  roads: FeatureCollection<LineString>;
  attractors: FeatureCollection<Point>;
  nodes: RoadNode[];
  edges: RoadEdge[];
};

function generateRoadNetwork(
  boundary: Feature<Polygon | MultiPolygon>,
  cfg: NormalizedSettings,
  rng: RNG,
  projector: LocalProjector
): RoadGenResult {
  // Attractors uniformly inside boundary
  const siteArea = turf.area(boundary);
  const densityToAreaFactor: Record<Density, number> = {
    low: 50000,
    medium: 30000,
    high: 20000,
    'very-high': 15000,
  };
  const targetAttractors = Math.max(150, Math.floor(siteArea / densityToAreaFactor[cfg.density]));
  const attractorsArr: { x: number; y: number; lng: number; lat: number; consumed?: boolean }[] = [];

  for (let i = 0, tries = 0; i < targetAttractors && tries < targetAttractors * 20; tries++) {
    const pt = randomPointInPolygon(boundary, rng);
    if (!pt) break;
    const [lng, lat] = pt.geometry.coordinates as [number, number];
    const [x, y] = projector.project([lng, lat]);
    attractorsArr.push({ x, y, lng, lat });
    i++;
  }

  const attractors = turf.featureCollection(
    attractorsArr.map((a) => turf.point([a.lng, a.lat]))
  ) as FeatureCollection<Point>;

  // Seed roads at centroid + small spokes
  const cLL = (turf.centroid(boundary).geometry.coordinates as [number, number]) ?? [0, 0];
  const [cx, cy] = projector.project(cLL);
  const nodes: RoadNode[] = [{ x: cx, y: cy, lng: cLL[0], lat: cLL[1] }];

  const spokes = 3;
  for (let i = 0; i < spokes; i++) {
    const brg = (360 / spokes) * i + 15;
    const p = turf.destination(turf.point(cLL), cfg.majorSegmentLenM / 1000 / 2, brg, { units: 'kilometers' });
    if (turf.booleanPointInPolygon(p, boundary)) {
      const [lng, lat] = p.geometry.coordinates as [number, number];
      const [x, y] = projector.project([lng, lat]);
      nodes.push({ x, y, lng, lat });
    }
  }

  const edges: RoadEdge[] = [];
  const step = cfg.majorSegmentLenM;
  const R = cfg.majorInfluenceRadiusM;
  const kill = cfg.majorKillDistanceM;

  for (let iter = 0; iter < 1500; iter++) {
    // Assign attractors to nearest node within influence radius
    const pulls = new Map<number, { vx: number; vy: number }>();
    let anyPull = false;
    for (const A of attractorsArr) {
      if (A.consumed) continue;

      // nearest node
      let best = -1;
      let bestD2 = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const dx = A.x - nodes[i].x;
        const dy = A.y - nodes[i].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = i;
        }
      }
      const d = Math.sqrt(bestD2);
      if (d <= R) {
        anyPull = true;
        const acc = pulls.get(best) ?? { vx: 0, vy: 0 };
        acc.vx += (A.x - nodes[best].x) / (d || 1);
        acc.vy += (A.y - nodes[best].y) / (d || 1);
        pulls.set(best, acc);
      }
    }
    if (!anyPull) break;

    const newIdxs: number[] = [];
    for (const [idx, acc] of pulls.entries()) {
      const mag = Math.hypot(acc.vx, acc.vy) || 1;
      const dirx = acc.vx / mag;
      const diry = acc.vy / mag;
      const newX = nodes[idx].x + dirx * step;
      const newY = nodes[idx].y + diry * step;
      const [lng, lat] = projector.unproject([newX, newY]);
      const end = turf.point([lng, lat]);
      if (!turf.booleanPointInPolygon(end, boundary)) continue;

      // avoid duplicates
      let tooClose = false;
      for (const n of nodes) {
        const dx = n.x - newX;
        const dy = n.y - newY;
        if (dx * dx + dy * dy < (step * 0.3) ** 2) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const newIdx = nodes.length;
      nodes.push({ x: newX, y: newY, lng, lat });
      edges.push({ a: idx, b: newIdx });
      newIdxs.push(newIdx);
    }

    // consume nearby attractors
    for (const ni of newIdxs) {
      for (const A of attractorsArr) {
        if (A.consumed) continue;
        const d = Math.hypot(A.x - nodes[ni].x, A.y - nodes[ni].y);
        if (d < kill) A.consumed = true;
      }
    }

    const remaining = attractorsArr.reduce((k, a) => k + (a.consumed ? 0 : 1), 0);
    if (remaining < Math.max(30, targetAttractors * 0.03)) break;
  }

  const roads = turf.featureCollection(
    edges.map((e) =>
      turf.lineString([
        [nodes[e.a].lng, nodes[e.a].lat],
        [nodes[e.b].lng, nodes[e.b].lat],
      ])
    )
  ) as FeatureCollection<LineString>;

  return { roads, attractors, nodes, edges };
}

/* -----------------------------------------------------------------------------
   Blocks (boundary - union(buffer(roads)))
----------------------------------------------------------------------------- */

function computeBlocks(
  boundary: Feature<Polygon | MultiPolygon>,
  roads: FeatureCollection<LineString>,
  cfg: NormalizedSettings
): FeatureCollection<Polygon> {
  if (!roads.features.length) {
    return turf.featureCollection(
      (turf.flatten(boundary).features as Feature<Polygon>[]).filter((f) => turf.area(f) > 1)
    );
  }

  const buffers: Array<Feature<Polygon | MultiPolygon>> = [];
  for (const line of roads.features) {
    try {
      const simple = turf.simplify(line, {
        tolerance: cfg.simplifyToleranceM / 1000,
        highQuality: false,
        mutate: false,
        units: 'kilometers',
      });
      const buff = turf.buffer(simple, cfg.roadWidthM / 2 / 1000, { units: 'kilometers', steps: 6 });
      if (buff) buffers.push(buff as any);
    } catch {
      // ignore
    }
  }

  const unioned = binaryUnion(buffers);
  if (!unioned) {
    return turf.featureCollection(
      (turf.flatten(boundary).features as Feature<Polygon>[]).filter((f) => turf.area(f) > 1)
    );
  }

  let blocks: Feature<Polygon | MultiPolygon> | null = null;
  try {
    blocks = turf.difference(boundary, unioned) as any;
  } catch {
    const simpleBoundary = turf.simplify(boundary as any, {
      tolerance: cfg.simplifyToleranceM / 800,
      mutate: false,
    }) as any;
    try {
      blocks = turf.difference(simpleBoundary, unioned) as any;
    } catch {
      blocks = null;
    }
  }

  if (!blocks) {
    return turf.featureCollection(
      (turf.flatten(boundary).features as Feature<Polygon>[]).filter((f) => turf.area(f) > 1)
    );
  }

  const flat = turf.flatten(blocks);
  const features = (flat.features as Feature<Polygon>[]).filter(
    (f) => turf.area(f) > Math.max(2 * cfg.minParcelAreaM2, 200)
  );
  return turf.featureCollection(features);
}

/* -----------------------------------------------------------------------------
   Parcels (Voronoi; seeds biased near roads)
----------------------------------------------------------------------------- */

function subdivideBlocksToParcels(
  blocks: FeatureCollection<Polygon>,
  roads: FeatureCollection<LineString>,
  cfg: NormalizedSettings,
  rng: RNG
): FeatureCollection<Polygon> {
  const parcels: Feature<Polygon>[] = [];
  const roadsCombined: Feature<any> =
    roads.features.length === 1 ? roads.features[0] : (turf.combine(roads).features[0] as any);

  for (const block of blocks.features) {
    const A = turf.area(block);
    if (A < cfg.minParcelAreaM2 * 2) continue;

    const targetCells = Math.max(1, Math.round(A / cfg.targetParcelAreaM2));
    const seeds = sampleWeightedPointsInPolygon(block, roadsCombined, targetCells, rng);
    if (!seeds.features.length) {
      parcels.push(block);
      continue;
    }

    const bbox = turf.bbox(block);
    const vor = turf.voronoi(seeds, { bbox }) as FeatureCollection<Polygon> | null;
    if (!vor || !vor.features.length) {
      parcels.push(block);
      continue;
    }

    for (const cell of vor.features) {
      try {
        const clipped = turf.intersect(block, cell);
        if (!clipped) continue;
        if (clipped.geometry.type === 'Polygon') {
          if (turf.area(clipped) >= cfg.minParcelAreaM2) parcels.push(clipped as Feature<Polygon>);
        } else if (clipped.geometry.type === 'MultiPolygon') {
          const flat = turf.flatten(clipped);
          for (const f of flat.features as Feature<Polygon>[]) {
            if (turf.area(f) >= cfg.minParcelAreaM2) parcels.push(f);
          }
        }
      } catch {
        // ignore degenerate cells
      }
    }
  }

  return turf.featureCollection(parcels);
}

function sampleWeightedPointsInPolygon(
  poly: Feature<Polygon>,
  roadsCombined: Feature<any>,
  count: number,
  rng: RNG
): FeatureCollection<Point> {
  const pts: Feature<Point>[] = [];
  const maxTries = count * 80;
  let tries = 0;
  const maxInfluenceM = 200; // closer to roads -> higher acceptance -> smaller parcels

  while (pts.length < count && tries < maxTries) {
    tries++;
    const pt = randomPointInPolygon(poly, rng);
    if (!pt) break;

    const dKm = turf.pointToLineDistance(pt, roadsCombined as any, { units: 'kilometers' });
    const dM = dKm * 1000;
    const prob = clamp(1 - dM / maxInfluenceM, 0.15, 0.95);
    if (rng() < prob) pts.push(pt);
  }

  while (pts.length < Math.max(3, count)) {
    const pt = randomPointInPolygon(poly, rng);
    if (!pt) break;
    pts.push(pt);
  }

  return turf.featureCollection(pts);
}

/* -----------------------------------------------------------------------------
   Green spaces
----------------------------------------------------------------------------- */

function allocateGreenSpaces(
  parcels: FeatureCollection<Polygon>,
  attractors: FeatureCollection<Point>,
  cfg: NormalizedSettings
): { greenSpaces: FeatureCollection<Polygon>; developableParcels: FeatureCollection<Polygon> } {
  if (!parcels.features.length) {
    return { greenSpaces: turf.featureCollection([]), developableParcels: turf.featureCollection([]) };
  }

  const total = parcels.features.reduce((acc, f) => acc + turf.area(f), 0);
  const target = total * clamp(cfg.greenspaceRatio, 0, 0.9);

  const walkM = 300;
  const scored = parcels.features.map((f) => {
    const c = turf.centroid(f).geometry.coordinates as [number, number];
    let near = 0;
    for (const a of attractors.features) {
      const dKm = turf.distance(turf.point(c), a, { units: 'kilometers' });
      if (dKm * 1000 <= walkM) near++;
    }
    const score = near + Math.sqrt(turf.area(f)) / 30;
    return { f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const greens: Feature<Polygon>[] = [];
  const dev: Feature<Polygon>[] = [];
  let accArea = 0;

  for (const s of scored) {
    const a = turf.area(s.f);
    if (accArea < target) {
      greens.push(s.f);
      accArea += a;
    } else {
      dev.push(s.f);
    }
  }

  return {
    greenSpaces: turf.featureCollection(greens),
    developableParcels: turf.featureCollection(dev),
  };
}

/* -----------------------------------------------------------------------------
   Buildings
----------------------------------------------------------------------------- */

function placeBuildings(
  parcels: FeatureCollection<Polygon>,
  roads: FeatureCollection<LineString>,
  cfg: NormalizedSettings,
  rng: RNG
): FeatureCollection<Polygon> {
  const buildings: Feature<Polygon>[] = [];
  const roadsCombined: Feature<any> =
    roads.features.length === 1 ? roads.features[0] : (turf.combine(roads).features[0] as any);

  for (const parcel of parcels.features) {
    let buildable: Feature<Polygon | MultiPolygon> | null = null;
    try {
      buildable = turf.buffer(parcel, -cfg.setbackM / 1000, { units: 'kilometers', steps: 8 }) as any;
    } catch {
      buildable = null;
    }

    let buildablePoly: Feature<Polygon> | null = null;
    if (buildable) {
      if (buildable.geometry.type === 'Polygon') {
        buildablePoly = buildable as Feature<Polygon>;
      } else if (buildable.geometry.type === 'MultiPolygon') {
        let best: Feature<Polygon> | null = null;
        let bestA = 0;
        for (const f of turf.flatten(buildable).features as Feature<Polygon>[]) {
          const A = turf.area(f);
          if (A > bestA) {
            bestA = A;
            best = f;
          }
        }
        buildablePoly = best;
      }
    }
    if (!buildablePoly) {
      try {
        const scaled = turf.transformScale(parcel, 0.92, { mutate: false }) as Feature<any>;
        if (scaled.geometry.type === 'Polygon') {
          buildablePoly = scaled as Feature<Polygon>;
        } else {
          const flat = turf.flatten(scaled);
          if (flat.features.length) buildablePoly = flat.features[0] as Feature<Polygon>;
        }
      } catch {
        buildablePoly = parcel;
      }
    }
    if (!buildablePoly) continue;

    const c = (turf.centroid(buildablePoly).geometry.coordinates as [number, number]) ?? [0, 0];
    const snapped = turf.nearestPointOnLine(roadsCombined as any, turf.point(c), { units: 'kilometers' }) as any;
    const brg = turf.bearing(turf.point(c), snapped);

    const w = lerp(cfg.minBldgWidthM, cfg.maxBldgWidthM, rng());
    const d = lerp(cfg.minBldgDepthM, cfg.maxBldgDepthM, rng());

    let rect = orientedRectangle(c, w, d, brg);
    let tries = 0;
    while (tries < 8) {
      tries++;
      const inter = safeIntersect(buildablePoly, rect);
      if (inter && almostEqualArea(inter as any, rect, 0.85)) {
        rect = inter as Feature<Polygon>;
        break;
      }
      try {
        rect = turf.transformScale(rect, 0.92, { mutate: false }) as Feature<Polygon>;
      } catch {
        break;
      }
    }

    if (rect && turf.booleanIntersects(rect, buildablePoly)) {
      buildings.push(rect);
    }
  }

  return turf.featureCollection(buildings);
}

/* -----------------------------------------------------------------------------
   Utilities
----------------------------------------------------------------------------- */

// Deterministic RNG
type RNG = () => number;
function mulberry32(a: number): RNG {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashBoundaryAndSettings(boundary: any[], cfg: NormalizedSettings): number {
  const str = JSON.stringify(boundary).slice(0, 4096) + '|' + JSON.stringify(cfg);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function positionsEqual(a: Position, b: Position, eps = 1e-9): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

function boundaryToPolygon(boundary: any[]): Feature<Polygon> {
  if (!Array.isArray(boundary) || boundary.length < 3) throw new Error('Invalid boundary');
  const coords: Position[] = boundary.map((p) => toLonLat(p));
  if (!positionsEqual(coords[0], coords[coords.length - 1])) coords.push(coords[0]);
  return turf.polygon([coords]);
}

function toLonLat(p: any): Position {
  if (Array.isArray(p) && p.length >= 2) {
    const a = Number(p[0]);
    const b = Number(p[1]);
    if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return [a, b];
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [b, a];
  } else if (p && typeof p === 'object') {
    if ('lng' in p && 'lat' in p) return [Number(p.lng), Number(p.lat)];
    if ('longitude' in p && 'latitude' in p) return [Number(p.longitude), Number(p.latitude)];
  }
  throw new Error('Unknown boundary coordinate format');
}

function randomPointInPolygon(poly: Feature<Polygon | MultiPolygon>, rng: RNG): Feature<Point> | null {
  const bb = turf.bbox(poly);
  for (let i = 0; i < 2000; i++) {
    const pt = turf.point([lerp(bb[0], bb[2], rng()), lerp(bb[1], bb[3], rng())]);
    if (turf.booleanPointInPolygon(pt, poly)) return pt;
  }
  return null;
}

class LocalProjector {
  private lng0: number;
  private lat0: number;
  private cosLat0: number;

  constructor(originLngLat: [number, number]) {
    this.lng0 = originLngLat[0];
    this.lat0 = originLngLat[1];
    this.cosLat0 = Math.cos((this.lat0 * Math.PI) / 180);
  }

  project(lngLat: [number, number]): [number, number] {
    const dx = (lngLat[0] - this.lng0) * (111320 * this.cosLat0);
    const dy = (lngLat[1] - this.lat0) * 110540;
    return [dx, dy];
  }

  unproject(xy: [number, number]): [number, number] {
    const lng = this.lng0 + xy[0] / (111320 * this.cosLat0);
    const lat = this.lat0 + xy[1] / 110540;
    return [lng, lat];
  }
}

function orientedRectangle(center: [number, number], widthM: number, depthM: number, bearingDeg: number): Feature<Polygon> {
  const halfWkm = widthM / 2 / 1000;
  const halfDkm = depthM / 2 / 1000;

  const p1 = turf.destination(turf.destination(turf.point(center), +halfWkm, bearingDeg, { units: 'kilometers' }), +halfDkm, bearingDeg + 90, { units: 'kilometers' });
  const p2 = turf.destination(turf.destination(turf.point(center), -halfWkm, bearingDeg, { units: 'kilometers' }), +halfDkm, bearingDeg + 90, { units: 'kilometers' });
  const p3 = turf.destination(turf.destination(turf.point(center), -halfWkm, bearingDeg, { units: 'kilometers' }), -halfDkm, bearingDeg + 90, { units: 'kilometers' });
  const p4 = turf.destination(turf.destination(turf.point(center), +halfWkm, bearingDeg, { units: 'kilometers' }), -halfDkm, bearingDeg + 90, { units: 'kilometers' });

  const coords: Position[] = [
    p1.geometry.coordinates as Position,
    p2.geometry.coordinates as Position,
    p3.geometry.coordinates as Position,
    p4.geometry.coordinates as Position,
    p1.geometry.coordinates as Position,
  ];
  return turf.polygon([coords]);
}

function translateAlongBearing(poly: Feature<Polygon>, bearingDeg: number, offsetM: number): Feature<Polygon> {
  const offsetKm = offsetM / 1000;
  return turf.transformTranslate(poly, offsetKm, bearingDeg, { units: 'kilometers', mutate: false }) as Feature<Polygon>;
}

function booleanWithinSafe(a: Feature<Polygon>, b: Feature<Polygon>): boolean {
  try {
    return turf.booleanWithin(a, b);
  } catch {
    const inter = safeIntersect(a, b);
    if (!inter) return false;
    const aA = turf.area(a);
    const iA = turf.area(inter as any);
    return iA > aA * 0.98;
  }
}

function safeIntersect(a: Feature<Polygon>, b: Feature<Polygon>): Feature<Polygon | MultiPolygon> | null {
  try {
    return turf.intersect(a, b) as any;
  } catch {
    return null;
  }
}

function almostEqualArea(a: Feature<any>, b: Feature<any>, thresholdRatio = 0.9): boolean {
  try {
    const aA = turf.area(a as any);
    const bA = turf.area(b as any);
    if (aA === 0 || bA === 0) return false;
    const r = Math.min(aA, bA) / Math.max(aA, bA);
    return r >= thresholdRatio;
  } catch {
    return false;
  }
}

function binaryUnion(polys: Feature<Polygon | MultiPolygon>[]): Feature<Polygon | MultiPolygon> | null {
  if (!polys.length) return null;
  const work = polys.map((p) => {
    try {
      return turf.simplify(p as any, {
        tolerance: 0.0005,
        highQuality: false,
        mutate: false,
        units: 'kilometers',
      }) as Feature<Polygon | MultiPolygon>;
    } catch {
      return p;
    }
  });
  function rec(list: Feature<Polygon | MultiPolygon>[]): Feature<Polygon | MultiPolygon> {
    if (list.length === 1) return list[0];
    const mid = Math.floor(list.length / 2);
    const L = rec(list.slice(0, mid));
    const R = rec(list.slice(mid));
    try {
      const u = turf.union(L as any, R as any);
      if (u) return u as any;
    } catch {
      // fallback
    }
    return L;
  }
  return rec(work);
}
