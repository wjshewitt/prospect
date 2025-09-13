// src/lib/urban-planner.ts
const turf = require("@turf/turf");
import {
  ProceduralSettings,
  DensityLevel,
  BuildingShape,
  GreenSpaceType,
} from "./procedural-types";
import type {
  ZoneKind,
  BuildingPlacementValidation,
} from "../services/zoning/rules";
import { validateBuildingPlacement } from "../services/zoning/rules";
import type {
  Feature,
  Polygon,
  MultiPolygon,
  FeatureCollection,
  Point,
  LineString,
} from "@turf/helpers";

export interface GeneratedLayout {
  buildings: FeatureCollection;
  greenSpaces: FeatureCollection;
  roads: FeatureCollection;
}

export class UrbanPlanner {
  private boundary: Feature<Polygon | MultiPolygon>;
  private settings: ProceduralSettings;
  private zones: Array<{ ring: Polygon; kind: ZoneKind }>;
  private boundaryArea: number;
  private rand: () => number;
  private readonly MAX_PLACEMENT_ATTEMPTS = 15000;

  constructor(
    boundaryInput: any,
    settings: ProceduralSettings,
    zones: Array<{ ring: Polygon; kind: ZoneKind }> = []
  ) {
    this.boundary = this.normalizeBoundary(boundaryInput);
    this.settings = this.applyDensityDefaults(settings);
    this.zones = zones;
    this.boundaryArea = turf.area(this.boundary);
    this.rand = settings.seed
      ? this.mulberry32(this.hashCode(settings.seed))
      : Math.random;
  }

  private applyDensityDefaults(
    settings: ProceduralSettings
  ): ProceduralSettings {
    // Apply density-based defaults if not explicitly set
    const densityDefaults = {
      low: { minBuildingSize: 150, maxBuildingSize: 600, spacing: 15 },
      medium: { minBuildingSize: 100, maxBuildingSize: 500, spacing: 10 },
      high: { minBuildingSize: 80, maxBuildingSize: 400, spacing: 8 },
      "very-high": { minBuildingSize: 60, maxBuildingSize: 300, spacing: 5 },
    };

    const defaults =
      densityDefaults[settings.density] || densityDefaults["medium"];

    return {
      ...defaults,
      ...settings,
      // Ensure required fields have values
      siteSetback: settings.siteSetback ?? 5,
      roadSetback: settings.roadSetback ?? 6, // Not used but kept for schema compatibility
      minBuildingSize: settings.minBuildingSize ?? defaults.minBuildingSize,
      maxBuildingSize: settings.maxBuildingSize ?? defaults.maxBuildingSize,
      spacing: settings.spacing ?? defaults.spacing,
      buildingShape: settings.buildingShape ?? "mixed",
      greenSpaceType: settings.greenSpaceType ?? "central",
    };
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

  private normalizeBoundary(input: any): Feature<Polygon | MultiPolygon> {
    let feat = null;
    if (!input) throw new Error("No boundary provided");

    // Handle array of coordinates (from your boundary prop)
    if (Array.isArray(input)) {
      // Convert lat/lng array to GeoJSON polygon
      const coords = input.map((coord) => [coord.lng, coord.lat]);
      // Ensure the polygon is closed
      if (
        coords.length > 0 &&
        (coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1])
      ) {
        coords.push(coords[0]);
      }
      feat = turf.polygon([coords]);
    } else if (input.type === "Feature") {
      feat = input;
    } else if (input.type === "FeatureCollection") {
      const poly = input.features.find(
        (f: any) =>
          f.geometry &&
          (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
      );
      if (!poly)
        throw new Error("FeatureCollection contains no Polygon/MultiPolygon");
      feat = poly;
    } else if (input.type === "Polygon" || input.type === "MultiPolygon") {
      feat = turf.feature(input);
    } else {
      throw new Error("Unsupported GeoJSON type for boundary");
    }

    return turf.cleanCoords(feat) as Feature<Polygon | MultiPolygon>;
  }

  public generateLayout(): GeneratedLayout {
    let { buildableArea, greenSpaces } = this.generateGreenSpacesAndBuildable();

    // Filter buildable area to compatible zones (assuming residential for procedural)
    if (this.zones.length > 0) {
      const compatibleZones = this.zones.filter(
        (z) => z.kind === "residential"
      );
      if (compatibleZones.length > 0) {
        let compatibleAreas = compatibleZones.map((z) =>
          turf.feature(z.ring as any)
        );
        let compatibleArea = turf.union(...compatibleAreas);
        if (compatibleArea) {
          compatibleArea = turf.intersect(
            buildableArea as any,
            compatibleArea as Feature<Polygon>
          );
          if (compatibleArea) {
            buildableArea = compatibleArea as Feature<Polygon | MultiPolygon>;
            console.log(
              "Procedural generation filtered to residential zones:",
              turf.area(buildableArea as any)
            ); // Logging
          } else {
            console.warn(
              "No buildable area in compatible zones; using original."
            ); // Logging
          }
        }
      }
    }

    const buildings = this.generateBuildings(buildableArea);
    const roads = this.generateRoads(buildings);

    return {
      buildings: turf.featureCollection(buildings as any),
      greenSpaces: turf.featureCollection(greenSpaces as any),
      roads: turf.featureCollection(roads as any),
    };
  }

  private generateGreenSpacesAndBuildable(): {
    buildableArea: Feature<Polygon | MultiPolygon>;
    greenSpaces: Feature[];
  } {
    const s = this.settings;
    let base = this.boundary;

    // Apply site setback
    if (s.siteSetback && s.siteSetback > 0) {
      const shrunk = turf.buffer(base, -s.siteSetback, {
        units: "meters",
      } as any);
      if (
        shrunk &&
        shrunk.geometry &&
        ((shrunk.geometry as any).coordinates?.length ||
          (shrunk.geometry as any).geometries?.length)
      ) {
        base = shrunk as Feature<Polygon | MultiPolygon>;
      }
    }

    let greenSpaces: Feature[] = [];
    let buildableArea = base;

    switch (s.greenSpaceType) {
      case "central": {
        const center = turf.center(base as any);
        const scaled = turf.transformScale(base, 0.4, {
          origin: center,
        });
        if (scaled) {
          const clipped =
            (turf.intersect(scaled, base as any) as Feature<
              Polygon | MultiPolygon
            >) || scaled;
          clipped.properties = { type: "green-space" };
          greenSpaces.push(clipped);
          const diff = turf.difference(
            base as any,
            clipped as Feature<Polygon>
          ) as Feature<Polygon | MultiPolygon> | null;
          if (diff) buildableArea = diff;
        }
        break;
      }
      case "perimeter": {
        const inner = turf.buffer(base, -40, {
          units: "meters",
        } as any) as Feature<Polygon | MultiPolygon>;
        if (inner) {
          const ring = turf.difference(base as any, inner as Feature<Polygon>);
          if (ring) {
            ring.properties = { type: "green-space" };
            greenSpaces.push(ring);
          }
          buildableArea = inner;
        }
        break;
      }
      case "distributed": {
        const numParks = Math.max(1, Math.floor(this.boundaryArea / 30000));
        for (let i = 0; i < numParks; i++) {
          const bbox = turf.bbox(buildableArea as any);
          let pt;
          let tries = 0;
          do {
            pt = turf.randomPoint(1, { bbox }).features[0];
            tries++;
          } while (
            !turf.booleanPointInPolygon(pt, buildableArea as any) &&
            tries < 100
          );

          if (tries < 100) {
            const radius = 15 + this.rand() * 25;
            const park = turf.buffer(pt, radius, {
              units: "meters",
            } as any) as Feature<Polygon>;
            const clipped = turf.intersect(
              park,
              buildableArea as any
            ) as Feature<Polygon> | null;
            if (clipped) {
              clipped.properties = { type: "green-space" };
              greenSpaces.push(turf.cleanCoords(clipped as any));
              const diff = turf.difference(
                buildableArea as any,
                clipped
              ) as Feature<Polygon | MultiPolygon> | null;
              if (diff) buildableArea = diff;
            }
          }
        }
        break;
      }
      case "none":
      default:
        // No green space generation
        break;
    }

    return {
      buildableArea: turf.cleanCoords(buildableArea as any) as Feature<
        Polygon | MultiPolygon
      >,
      greenSpaces,
    };
  }

  private generateCandidatePoints(
    buildableArea: Feature<Polygon | MultiPolygon>,
    targetCount: number
  ): Feature<Point>[] {
    const { layout, spacing } = this.settings;
    const bbox = turf.bbox(buildableArea as any);
    const pts: Feature<Point>[] = [];
    const inside = (pt: Feature<Point>) =>
      turf.booleanPointInPolygon(pt, buildableArea as any);
    const avgArea = Math.max(1, this.boundaryArea / Math.max(1, targetCount));
    const spacingMeters = Math.max(spacing || 10, Math.sqrt(avgArea) * 0.8);
    const center = turf.center(buildableArea as any);

    switch (layout) {
      case "grid": {
        const cellKm = Math.max(0.02, spacingMeters / 1000);
        const grid = turf.pointGrid(bbox, cellKm, {
          units: "kilometers" as any,
          mask: buildableArea as any,
        });
        pts.push(...grid.features);
        break;
      }
      case "radial": {
        const diagMeters =
          turf.distance(
            turf.point([bbox[0], bbox[1]]),
            turf.point([bbox[2], bbox[3]]),
            { units: "kilometers" as any }
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
            const bearing = (360 / perRing) * k + (this.rand() * 20 - 10);
            const pt = turf.destination(center, r / 1000, bearing, {
              units: "kilometers" as any,
            });
            if (inside(pt)) pts.push(pt);
          }
        }
        break;
      }
      case "cul-de-sac":
      case "linear":
      case "cluster":
      case "organic":
      case "mixed":
      default: {
        // Poisson-like disk sampling for organic layouts
        const target = Math.max(targetCount, Math.round(targetCount * 1.5));
        const minNN = Math.max(2, spacing || 10);
        const accepted: Feature<Point>[] = [];
        const maxAttempts = target * 30;
        let attempts = 0;

        while (accepted.length < target && attempts < maxAttempts) {
          const rp = turf.randomPoint(1, { bbox }).features[0];
          attempts++;
          if (!inside(rp)) continue;

          let ok = true;
          for (const a of accepted) {
            if (turf.distance(rp, a, { units: "meters" as any }) < minNN) {
              ok = false;
              break;
            }
          }
          if (ok) accepted.push(rp);
        }
        pts.push(...accepted);
        break;
      }
    }

    return pts.sort(() => this.rand() - 0.5); // Shuffle
  }

  private generateBuildings(
    buildableArea: Feature<Polygon | MultiPolygon>
  ): Feature[] {
    const densities: Record<DensityLevel, number> = {
      low: 7,
      medium: 20,
      high: 40,
      "very-high": 70,
    };
    const hectares = this.boundaryArea / 10000;
    const targetCount = Math.floor(
      hectares * (densities[this.settings.density] || 20)
    );

    if (targetCount === 0) return [];

    const candidates = this.generateCandidatePoints(buildableArea, targetCount);
    const placed: Feature[] = [];
    const placedBuffers: Feature[] = [];
    let attempts = 0;
    let i = 0;

    while (
      placed.length < targetCount &&
      attempts < this.MAX_PLACEMENT_ATTEMPTS
    ) {
      const sourcePt =
        candidates[i % candidates.length] || turf.center(buildableArea as any);
      i++;
      attempts++;

      const jitterM = (this.settings.spacing || 10) * 0.5;
      const angle = this.rand() * 360;
      const dist = this.rand() * jitterM;
      const pt = dist
        ? turf.destination(sourcePt, dist / 1000, angle, {
            units: "kilometers" as any,
          })
        : sourcePt;

      if (!turf.booleanPointInPolygon(pt, buildableArea as any)) continue;

      const candidateBuilding = this.createBuilding(
        pt.geometry.coordinates as number[],
        placed.length
      );

      if (
        !candidateBuilding ||
        !this.isContained(buildableArea, candidateBuilding)
      )
        continue;

      // Zone validation
      const validation = this.validateBuildingInZones(candidateBuilding);
      if (!validation.isValid) {
        console.log(
          "Building rejected by zone validation:",
          validation.reasons
        ); // Logging
        continue;
      }

      let isOverlapping = false;
      const spacing = this.settings.spacing || 10;
      const candidateBuffer = turf.buffer(candidateBuilding, spacing / 2.0, {
        units: "meters",
      } as any) as Feature<Polygon>;

      if (!candidateBuffer) continue;

      for (let b of placedBuffers) {
        if (b && !turf.booleanDisjoint(candidateBuffer, b as any)) {
          isOverlapping = true;
          break;
        }
      }

      if (!isOverlapping) {
        placed.push(candidateBuilding);
        placedBuffers.push(candidateBuffer);
      }
    }

    return placed.map((f) => turf.cleanCoords(f as any));
  }

  private validateBuildingInZones(
    building: Feature<Polygon>,
    buildingType: string = "house_detached"
  ): BuildingPlacementValidation {
    // Convert building to PolygonRing format for validation
    const ring = building.geometry.coordinates[0].map(([lng, lat]: any) => ({
      lat,
      lng,
    }));
    const zoneRings = this.zones.map((z) => ({
      ring: z.ring.coordinates[0].map(([lng, lat]: any) => ({
        lat,
        lng,
      })) as any,
      kind: z.kind,
    }));
    return validateBuildingPlacement(ring as any, buildingType, zoneRings);
  }

  private metersToDegrees(
    meters: number,
    latitude: number
  ): { lat: number; lng: number } {
    const lat = meters / 111320;
    const lng = meters / (111320 * Math.cos((latitude * Math.PI) / 180));
    return { lat, lng };
  }

  private isContained(container: Feature, feature: Feature): boolean {
    if (!container || !feature || !container.geometry) return false;
    const containerType = container.geometry.type;

    if (containerType === "Polygon") {
      try {
        return turf.booleanContains(container as any, feature);
      } catch (e) {
        console.warn("Error during booleanContains, returning false.", e);
        return false;
      }
    } else if (containerType === "MultiPolygon") {
      for (const polyCoords of (container.geometry as MultiPolygon)
        .coordinates) {
        const poly = turf.polygon(polyCoords);
        if (turf.booleanContains(poly, feature as any)) {
          return true;
        }
      }
    }
    return false;
  }

  private createBuilding(
    center: number[],
    id: number
  ): Feature<Polygon> | null {
    const { minBuildingSize, maxBuildingSize, buildingShape } = this.settings;
    const minSize = minBuildingSize || 100;
    const maxSize = maxBuildingSize || 500;
    const area = minSize + this.rand() * (maxSize - minSize);
    const ratio = 0.6 + this.rand() * 0.8;
    const width = Math.sqrt(area * ratio);
    const height = area / width;

    const halfW = this.metersToDegrees(width / 2, center[1]).lng;
    const halfH = this.metersToDegrees(height / 2, center[1]).lat;
    const [cx, cy] = center;
    const [xmin, ymin, xmax, ymax] = [
      cx - halfW,
      cy - halfH,
      cx + halfW,
      cy + halfH,
    ];

    let shape = buildingShape || "mixed";
    if (shape === "mixed") {
      const shapes: BuildingShape[] = ["rectangle", "l-shape", "t-shape"];
      shape = shapes[Math.floor(this.rand() * shapes.length)];
    }

    let coords;
    if (shape === "l-shape") {
      const xmid = xmin + (xmax - xmin) * (0.4 + this.rand() * 0.2);
      const ymid = ymin + (ymax - ymin) * (0.4 + this.rand() * 0.2);
      coords = [
        [
          [xmin, ymin],
          [xmax, ymin],
          [xmax, ymid],
          [xmid, ymid],
          [xmid, ymax],
          [xmin, ymax],
          [xmin, ymin],
        ],
      ];
    } else if (shape === "t-shape") {
      const xmid1 = xmin + (xmax - xmin) * 0.25;
      const xmid2 = xmin + (xmax - xmin) * 0.75;
      const ymid = ymin + (ymax - ymin) * 0.5;
      coords = [
        [
          [xmin, ymax],
          [xmax, ymax],
          [xmax, ymid],
          [xmid2, ymid],
          [xmid2, ymin],
          [xmid1, ymin],
          [xmid1, ymid],
          [xmin, ymid],
          [xmin, ymax],
        ],
      ];
    } else {
      coords = [
        [
          [xmin, ymin],
          [xmax, ymin],
          [xmax, ymax],
          [xmin, ymax],
          [xmin, ymin],
        ],
      ];
    }

    const building = turf.polygon(coords, {
      id: `b_${id}`,
      type: "building",
    });

    const rotated = turf.transformRotate(building, this.rand() * 360, {
      pivot: center,
    });
    rotated.properties = {
      ...rotated.properties,
      area: Math.round(turf.area(rotated as any)),
    };

    return rotated;
  }

  private generateRoads(buildings: Feature[]): Feature[] {
    if (buildings.length < 2) return [];

    // Determine number of road connections based on layout type
    let roadNeighbors = 2; // Default

    switch (this.settings.layout) {
      case "grid":
        roadNeighbors = 4;
        break;
      case "radial":
      case "organic":
        roadNeighbors = 3;
        break;
      case "cul-de-sac":
      case "linear":
        roadNeighbors = 2;
        break;
      case "cluster":
        roadNeighbors = 3;
        break;
      case "mixed":
        roadNeighbors = Math.floor(2 + this.rand() * 2);
        break;
    }

    const centers = buildings.map((b) => turf.center(b as any));
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

    return lines.map((l) => turf.cleanCoords(l as any));
  }
}
