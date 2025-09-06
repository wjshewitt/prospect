
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating procedural site layouts.
 * It contains the core logic for generating roads, parcels, and buildings based on
 * a set of user-defined parameters.
 */

import { ai } from '@/ai/genkit';
import * as turf from '@turf/turf';
import * as turfRandom from '@turf/random';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
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
  const boundary = boundaryToPolygon(input.boundary);
  const planner = new UrbanPlanner(boundary, input);
  const { buildings, greenSpaces, roads } = planner.generateLayout();
  
  // The planner returns FeatureCollections, but the parcels are implicitly defined.
  // For now, we will return an empty FeatureCollection for parcels.
  // A future enhancement could be to calculate parcels from the space between roads.
  const parcels = turf.featureCollection([]);

  return {
    roads,
    parcels,
    greenSpaces,
    buildings,
  };
}

export default proceduralGenerateLayout;


/* -----------------------------------------------------------------------------
   Urban Planner Class and Logic
   Adapted from the user-provided HTML file.
----------------------------------------------------------------------------- */

const MAX_PLACEMENT_ATTEMPTS = 15000;

class UrbanPlanner {
  private boundary: Feature<Polygon | MultiPolygon>;
  private settings: ProceduralGenerateLayoutInput;
  private boundaryArea: number;
  private rand: () => number;

  constructor(boundaryInput: Feature<Polygon | MultiPolygon>, settings: ProceduralGenerateLayoutInput) {
    this.boundary = this.normalizeBoundary(boundaryInput);
    this.settings = settings;
    this.boundaryArea = turf.area(this.boundary);
    this.rand = settings.seed
      ? this.mulberry32(this.hashCode(settings.seed))
      : Math.random;
  }

  private hashCode(str: string): number {
    if (typeof str !== "string") str = String(str);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  private mulberry32(a: number): () => number {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private normalizeBoundary(input: Feature<Polygon | MultiPolygon>): Feature<Polygon | MultiPolygon> {
    if (!input) throw new Error("No boundary provided");
    return turf.cleanCoords(input);
  }

  public generateLayout() {
    const { buildableArea, greenSpaces } = this.generateGreenSpacesAndBuildable();
    const buildings = this.generateBuildings(buildableArea);
    const roads = this.generateRoads(buildings);
    return {
      buildings: turf.featureCollection(buildings),
      greenSpaces: turf.featureCollection(greenSpaces),
      roads: turf.featureCollection(roads),
    };
  }

  private generateGreenSpacesAndBuildable(): { buildableArea: Feature<Polygon | MultiPolygon>, greenSpaces: Feature<Polygon | MultiPolygon>[] } {
    const s = this.settings;
    let base: Feature<Polygon | MultiPolygon> = this.boundary;

    if (s.siteSetback > 0) {
      const shrunk = turf.buffer(base, -s.siteSetback, { units: "meters" });
      if (
        shrunk &&
        shrunk.geometry &&
        (shrunk.geometry.coordinates?.length)
      ) {
        base = shrunk;
      }
    }

    let greenSpaces: Feature<Polygon | MultiPolygon>[] = [];
    let buildableArea: Feature<Polygon | MultiPolygon> = base;

    switch (s.greenSpaceType) {
      case "central": {
        const centerPoint = turf.center(base);
        const scaled = turf.transformScale(base, 0.4, { origin: centerPoint });
        if (scaled) {
          const clipped = turf.intersect(scaled, base) || scaled;
          clipped.properties = { type: "green-space" };
          greenSpaces.push(clipped as Feature<Polygon | MultiPolygon>);
          const diff = turf.difference(base, clipped);
          if (diff) buildableArea = diff;
        }
        break;
      }
      case "perimeter": {
        const inner = turf.buffer(base, -40, { units: "meters" });
        if (inner) {
          const ring = turf.difference(base, inner);
          if (ring) {
            ring.properties = { type: "green-space" };
            greenSpaces.push(ring);
          }
          buildableArea = inner;
        }
        break;
      }
      case "distributed": {
        const numParks = Math.max(
          1,
          Math.floor(this.boundaryArea / 30000)
        );
        for (let i = 0; i < numParks; i++) {
          const bboxFeat = turf.bbox(buildableArea);
          let pt;
          let tries = 0;
          do {
            pt = turfRandom.randomPoint(1, { bbox: bboxFeat }).features[0];
            tries++;
          } while (
            !turf.booleanPointInPolygon(pt, buildableArea) &&
            tries < 100
          );

          if (tries < 100) {
            const radius = 15 + this.rand() * 25;
            const park = turf.buffer(pt, radius, { units: "meters" });
            const clipped = turf.intersect(park, buildableArea);
            if (clipped) {
              clipped.properties = { type: "green-space" };
              greenSpaces.push(turf.cleanCoords(clipped as Feature<Polygon | MultiPolygon>));
              const diff = turf.difference(buildableArea, clipped);
              if (diff) buildableArea = diff;
            }
          }
        }
        break;
      }
    }
    return {
      buildableArea: turf.cleanCoords(buildableArea),
      greenSpaces,
    };
  }
  
  private generateCandidatePoints(buildableArea: Feature<Polygon | MultiPolygon>, targetCount: number): Feature<Point>[] {
    const { layout, spacing } = this.settings;
    const bboxFeat = turf.bbox(buildableArea);
    const pts: Feature<Point>[] = [];
    const inside = (pt: Feature<Point>) => turf.booleanPointInPolygon(pt, buildableArea);
    const avgArea = Math.max(
      1,
      this.boundaryArea / Math.max(1, targetCount)
    );
    const spacingMeters = Math.max(spacing, Math.sqrt(avgArea) * 0.8);
    const centerPoint = turf.center(buildableArea);

    if (layout === "grid") {
      const cellKm = Math.max(0.02, spacingMeters / 1000);
      const grid = turf.pointGrid(bboxFeat, cellKm, {
        units: "kilometers",
        mask: buildableArea,
      });
      pts.push(...grid.features);
    } else if (layout === "radial") {
      const diagMeters =
        turf.distance(
          turf.point([bboxFeat[0], bboxFeat[1]]),
          turf.point([bboxFeat[2], bboxFeat[3]]),
          { units: "kilometers" }
        ) * 1000;
      const rMax = Math.max(50, diagMeters * 0.35);
      const rings = Math.max(2, Math.round(Math.sqrt(targetCount)));
      for (let i = 1; i <= rings; i++) {
        const r = (rMax / rings) * i;
        const perRing = Math.max(
          6,
          Math.round((2 * Math.PI * r) / spacingMeters)
        );
        for (let k = 0; k < perRing; k++) {
          const bearingVal = (360 / perRing) * k + (this.rand() * 20 - 10);
          const pt = turf.destination(centerPoint, r / 1000, bearingVal, {
            units: "kilometers",
          });
          if (inside(pt)) pts.push(pt);
        }
      }
    } else {
      // Fallback for organic, cluster, linear, etc. - Poisson-like disk sampling
      const target = Math.max(targetCount, Math.round(targetCount * 1.5));
      const minNN = Math.max(2, spacing);
      const accepted: Feature<Point>[] = [];
      const maxAttempts = target * 30;
      let attempts = 0;
      while (accepted.length < target && attempts < maxAttempts) {
        const rp = turfRandom.randomPoint(1, { bbox: bboxFeat }).features[0];
        attempts++;
        if (!inside(rp)) continue;
        let ok = true;
        for (const a of accepted) {
          if (turf.distance(rp, a, { units: "meters" }) < minNN) {
            ok = false;
            break;
          }
        }
        if (ok) accepted.push(rp);
      }
      pts.push(...accepted);
    }
    return pts.sort(() => this.rand() - 0.5); // Shuffle
  }

  private generateBuildings(buildableArea: Feature<Polygon | MultiPolygon>): Feature<Polygon>[] {
    const densities = { low: 7, medium: 20, high: 40, "very-high": 70 };
    const hectares = this.boundaryArea / 10000;
    const targetCount = Math.floor(
      hectares * (densities[this.settings.density] || 20)
    );
    if (targetCount === 0) return [];

    const candidates = this.generateCandidatePoints(
      buildableArea,
      targetCount
    );
    const placed: Feature<Polygon>[] = [];
    const placedBuffers: Feature<Polygon>[] = [];
    let attempts = 0;
    let i = 0;

    while (
      placed.length < targetCount &&
      attempts < MAX_PLACEMENT_ATTEMPTS
    ) {
      const sourcePt =
        candidates[i % candidates.length] || turf.center(buildableArea);
      i++;
      attempts++;

      const jitterM = this.settings.spacing * 0.5;
      const angle = this.rand() * 360;
      const dist = this.rand() * jitterM;
      const pt = dist
        ? turf.destination(sourcePt, dist / 1000, angle, {
            units: "kilometers",
          })
        : sourcePt;

      if (!turf.booleanPointInPolygon(pt, buildableArea)) continue;

      const candidateBuilding = this.createBuilding(
        pt.geometry.coordinates,
        placed.length
      );
      if (
        !candidateBuilding ||
        !this.isContained(buildableArea, candidateBuilding)
      )
        continue;

      let isOverlapping = false;
      const spacing = this.settings.spacing;
      const candidateBuffer = turf.buffer(
        candidateBuilding,
        spacing / 2.0,
        { units: "meters" }
      );
      if (!candidateBuffer) continue;

      for (let b of placedBuffers) {
        if (!turf.booleanDisjoint(candidateBuffer, b)) {
          isOverlapping = true;
          break;
        }
      }

      if (!isOverlapping) {
        placed.push(candidateBuilding);
        placedBuffers.push(candidateBuffer as Feature<Polygon>);
      }
    }
    return placed.map((f) => turf.cleanCoords(f) as Feature<Polygon>);
  }

  private metersToDegrees(meters: number, latitude: number): { lat: number, lng: number } {
    const lat = meters / 111320;
    const lng = meters / (111320 * Math.cos((latitude * Math.PI) / 180));
    return { lat, lng };
  }

  private isContained(container: Feature<Polygon | MultiPolygon>, feature: Feature<Polygon>): boolean {
    if (!container || !feature || !container.geometry) return false;
    const containerType = container.geometry.type;

    if (containerType === "Polygon") {
      try {
        return turf.booleanContains(container, feature);
      } catch (e) {
        console.warn("Error during booleanContains, returning false.", e);
        return false;
      }
    } else if (containerType === "MultiPolygon") {
      for (const polyCoords of container.geometry.coordinates) {
        const poly = turf.polygon(polyCoords);
        if (turf.booleanContains(poly, feature)) {
          return true;
        }
      }
      return false;
    }
    return false;
  }

  private createBuilding(centerCoords: Position, id: number): Feature<Polygon> | null {
    const { minBuildingSize, maxBuildingSize, buildingShape } = this.settings;
    const buildingArea = minBuildingSize + this.rand() * (maxBuildingSize - minBuildingSize);
    const ratio = 0.6 + this.rand() * 0.8;
    const width = Math.sqrt(buildingArea * ratio);
    const height = buildingArea / width;

    const halfW = this.metersToDegrees(width / 2, centerCoords[1]).lng;
    const halfH = this.metersToDegrees(height / 2, centerCoords[1]).lat;
    const [cx, cy] = centerCoords;
    const [xmin, ymin, xmax, ymax] = [
      cx - halfW,
      cy - halfH,
      cx + halfW,
      cy + halfH,
    ];

    let shape = buildingShape;
    if (shape === "mixed") {
      const shapes = ["rectangle", "l-shape", "t-shape"];
      shape = shapes[Math.floor(this.rand() * shapes.length)];
    }

    let coords;
    if (shape === "l-shape") {
      const xmid = xmin + (xmax - xmin) * (0.4 + this.rand() * 0.2);
      const ymid = ymin + (ymax - ymin) * (0.4 + this.rand() * 0.2);
      coords = [
        [
          [xmin, ymin], [xmax, ymin], [xmax, ymid], [xmid, ymid],
          [xmid, ymax], [xmin, ymax], [xmin, ymin],
        ],
      ];
    } else if (shape === "t-shape") {
      const xmid1 = xmin + (xmax - xmin) * 0.25;
      const xmid2 = xmin + (xmax - xmin) * 0.75;
      const ymid = ymin + (ymax - ymin) * 0.5;
      coords = [
        [
          [xmin, ymax], [xmax, ymax], [xmax, ymid], [xmid2, ymid],
          [xmid2, ymin], [xmid1, ymin], [xmid1, ymid], [xmin, ymid],
          [xmin, ymax],
        ],
      ];
    } else { // rectangle
      coords = [
        [
          [xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin],
        ],
      ];
    }

    const bldg = turf.polygon(coords, {
      id: `b_${id}`,
      type: "building",
    });
    const rotated = turf.transformRotate(bldg, this.rand() * 360, {
      pivot: centerCoords,
    });
    rotated.properties!.area = Math.round(turf.area(rotated));
    return rotated;
  }

  private generateRoads(buildings: Feature<Polygon>[]): Feature<LineString>[] {
    if (buildings.length < 2) return [];
    const roadNeighbors = (this.settings as any).roadNeighbors || 2; // Fallback
    const centers = buildings.map((b) => turf.center(b));
    const edges = new Set<string>();
    const lines: Feature<LineString>[] = [];

    for (let i = 0; i < centers.length; i++) {
      const dists = centers
        .map((c, j) => ({
          j,
          d: i === j ? Infinity : turf.distance(centers[i], c),
        }))
        .sort((a, b) => a.d - b.d);

      for (let k = 0; k < Math.min(roadNeighbors, dists.length); k++) {
        const j = dists[k].j;
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!edges.has(key)) {
          edges.add(key);
          lines.push(
            turf.lineString(
              [
                centers[i].geometry.coordinates,
                centers[j].geometry.coordinates,
              ],
              { type: "road" }
            )
          );
        }
      }
    }
    return lines.map((l) => turf.cleanCoords(l) as Feature<LineString>);
  }
}

/* -----------------------------------------------------------------------------
   Utilities
----------------------------------------------------------------------------- */

function boundaryToPolygon(boundary: {lat: number, lng: number}[]): Feature<Polygon> {
  if (!Array.isArray(boundary) || boundary.length < 3) throw new Error('Invalid boundary');
  const coords: Position[] = boundary.map((p) => [p.lng, p.lat]);
  if (!positionsEqual(coords[0], coords[coords.length - 1])) {
    coords.push(coords[0]);
  }
  return turf.polygon([coords]);
}

function positionsEqual(a: Position, b: Position, eps = 1e-9): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

    