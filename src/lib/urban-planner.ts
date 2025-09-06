// src/lib/urban-planner.ts
import * as turf from '@turf/turf';
import { 
  ProceduralSettings, 
  DensityLevel, 
  LayoutPattern, 
  BuildingShape, 
  GreenSpaceType 
} from './procedural-types';

export interface GeneratedLayout {
  buildings: turf.FeatureCollection;
  greenSpaces: turf.FeatureCollection;
  roads: turf.FeatureCollection;
}

export class UrbanPlanner {
  private boundary: turf.Feature<turf.Polygon | turf.MultiPolygon>;
  private settings: ProceduralSettings;
  private boundaryArea: number;
  private rand: () => number;
  private readonly MAX_PLACEMENT_ATTEMPTS = 15000;

  constructor(boundaryInput: any, settings: ProceduralSettings) {
    this.boundary = this.normalizeBoundary(boundaryInput);
    this.settings = this.applyDensityDefaults(settings);
    this.boundaryArea = turf.area(this.boundary);
    this.rand = settings.seed 
      ? this.mulberry32(this.hashCode(settings.seed))
      : Math.random;
  }

  private applyDensityDefaults(settings: ProceduralSettings): ProceduralSettings {
    // Apply density-based defaults if not explicitly set
    const densityDefaults = {
      'low': { minBuildingSize: 150, maxBuildingSize: 600, spacing: 15 },
      'medium': { minBuildingSize: 100, maxBuildingSize: 500, spacing: 10 },
      'high': { minBuildingSize: 80, maxBuildingSize: 400, spacing: 8 },
      'very-high': { minBuildingSize: 60, maxBuildingSize: 300, spacing: 5 }
    };

    const defaults = densityDefaults[settings.density] || densityDefaults['medium'];
    
    return {
      ...defaults,
      ...settings,
      // Ensure required fields have values
      siteSetback: settings.siteSetback ?? 5,
      roadSetback: settings.roadSetback ?? 6, // Not used but kept for schema compatibility
      minBuildingSize: settings.minBuildingSize ?? defaults.minBuildingSize,
      maxBuildingSize: settings.maxBuildingSize ?? defaults.maxBuildingSize,
      spacing: settings.spacing ?? defaults.spacing,
      buildingShape: settings.buildingShape ?? 'mixed',
      greenSpaceType: settings.greenSpaceType ?? 'central'
    };
  }

  private hashCode(str: string): number {
    if (typeof str !== 'string') str = String(str);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  private mulberry32(a: number): () => number {
    return function() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private normalizeBoundary(input: any): turf.Feature<turf.Polygon | turf.MultiPolygon> {
    let feat = null;
    if (!input) throw new Error('No boundary provided');
    
    // Handle array of coordinates (from your boundary prop)
    if (Array.isArray(input)) {
      // Convert lat/lng array to GeoJSON polygon
      const coords = input.map(coord => [coord.lng, coord.lat]);
      // Ensure the polygon is closed
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || 
          coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0]);
      }
      feat = turf.polygon([coords]);
    } else if (input.type === 'Feature') {
      feat = input;
    } else if (input.type === 'FeatureCollection') {
      const poly = input.features.find((f: any) =>
        f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      );
      if (!poly) throw new Error('FeatureCollection contains no Polygon/MultiPolygon');
      feat = poly;
    } else if (input.type === 'Polygon' || input.type === 'MultiPolygon') {
      feat = turf.feature(input);
    } else {
      throw new Error('Unsupported GeoJSON type for boundary');
    }
    
    return turf.cleanCoords(feat) as turf.Feature<turf.Polygon | turf.MultiPolygon>;
  }

  public generateLayout(): GeneratedLayout {
    const { buildableArea, greenSpaces } = this.generateGreenSpacesAndBuildable();
    const buildings = this.generateBuildings(buildableArea);
    const roads = this.generateRoads(buildings);
    
    return {
      buildings: turf.featureCollection(buildings),
      greenSpaces: turf.featureCollection(greenSpaces),
      roads: turf.featureCollection(roads)
    };
  }

  private generateGreenSpacesAndBuildable(): {
    buildableArea: turf.Feature<turf.Polygon | turf.MultiPolygon>;
    greenSpaces: turf.Feature[];
  } {
    const s = this.settings;
    let base = this.boundary;

    // Apply site setback
    if (s.siteSetback && s.siteSetback > 0) {
      const shrunk = turf.buffer(base, -s.siteSetback, { units: 'meters' });
      if (shrunk && shrunk.geometry && 
          ((shrunk.geometry as any).coordinates?.length || 
           (shrunk.geometry as any).geometries?.length)) {
        base = shrunk as turf.Feature<turf.Polygon | turf.MultiPolygon>;
      }
    }

    let greenSpaces: turf.Feature[] = [];
    let buildableArea = base;

    switch (s.greenSpaceType) {
      case 'central': {
        const center = turf.center(base);
        const scaled = turf.transformScale(base, 0.4, { origin: center });
        if (scaled) {
          const clipped = turf.intersect(scaled, base) || scaled;
          clipped.properties = { type: 'green-space' };
          greenSpaces.push(clipped);
          const diff = turf.difference(base, clipped);
          if (diff) buildableArea = diff as turf.Feature<turf.Polygon | turf.MultiPolygon>;
        }
        break;
      }
      case 'perimeter': {
        const inner = turf.buffer(base, -40, { units: 'meters' });
        if (inner) {
          const ring = turf.difference(base, inner);
          if (ring) {
            ring.properties = { type: 'green-space' };
            greenSpaces.push(ring);
          }
          buildableArea = inner as turf.Feature<turf.Polygon | turf.MultiPolygon>;
        }
        break;
      }
      case 'distributed': {
        const numParks = Math.max(1, Math.floor(this.boundaryArea / 30000));
        for (let i = 0; i < numParks; i++) {
          const bbox = turf.bbox(buildableArea);
          let pt;
          let tries = 0;
          do {
            pt = turf.randomPoint(1, { bbox }).features[0];
            tries++;
          } while (!turf.booleanPointInPolygon(pt, buildableArea) && tries < 100);

          if (tries < 100) {
            const radius = 15 + this.rand() * 25;
            const park = turf.buffer(pt, radius, { units: 'meters' });
            const clipped = turf.intersect(park, buildableArea);
            if (clipped) {
              clipped.properties = { type: 'green-space' };
              greenSpaces.push(turf.cleanCoords(clipped));
              const diff = turf.difference(buildableArea, clipped);
              if (diff) buildableArea = diff as turf.Feature<turf.Polygon | turf.MultiPolygon>;
            }
          }
        }
        break;
      }
      case 'none':
      default:
        // No green space generation
        break;
    }

    return {
      buildableArea: turf.cleanCoords(buildableArea) as turf.Feature<turf.Polygon | turf.MultiPolygon>,
      greenSpaces
    };
  }

  private generateCandidatePoints(
    buildableArea: turf.Feature<turf.Polygon | turf.MultiPolygon>, 
    targetCount: number
  ): turf.Feature<turf.Point>[] {
    const { layout, spacing } = this.settings;
    const bbox = turf.bbox(buildableArea);
    const pts: turf.Feature<turf.Point>[] = [];
    const inside = (pt: turf.Feature<turf.Point>) => turf.booleanPointInPolygon(pt, buildableArea);
    const avgArea = Math.max(1, this.boundaryArea / Math.max(1, targetCount));
    const spacingMeters = Math.max(spacing || 10, Math.sqrt(avgArea) * 0.8);
    const center = turf.center(buildableArea);

    switch (layout) {
      case 'grid': {
        const cellKm = Math.max(0.02, spacingMeters / 1000);
        const grid = turf.pointGrid(bbox, cellKm, {
          units: 'kilometers',
          mask: buildableArea
        });
        pts.push(...grid.features);
        break;
      }
      case 'radial': {
        const diagMeters = turf.distance(
          turf.point([bbox[0], bbox[1]]),
          turf.point([bbox[2], bbox[3]]),
          { units: 'kilometers' }
        ) * 1000;
        const rMax = Math.max(50, diagMeters * 0.35);
        const rings = Math.max(2, Math.round(Math.sqrt(targetCount)));
        
        for (let i = 1; i <= rings; i++) {
          const r = (rMax / rings) * i;
          const perRing = Math.max(6, Math.round((2 * Math.PI * r) / spacingMeters));
          for (let k = 0; k < perRing; k++) {
            const bearing = (360 / perRing) * k + (this.rand() * 20 - 10);
            const pt = turf.destination(center, r / 1000, bearing, { units: 'kilometers' });
            if (inside(pt)) pts.push(pt);
          }
        }
        break;
      }
      case 'cul-de-sac':
      case 'linear':
      case 'cluster':
      case 'organic':
      case 'mixed':
      default: {
        // Poisson-like disk sampling for organic layouts
        const target = Math.max(targetCount, Math.round(targetCount * 1.5));
        const minNN = Math.max(2, spacing || 10);
        const accepted: turf.Feature<turf.Point>[] = [];
        const maxAttempts = target * 30;
        let attempts = 0;
        
        while (accepted.length < target && attempts < maxAttempts) {
          const rp = turf.randomPoint(1, { bbox }).features[0];
          attempts++;
          if (!inside(rp)) continue;
          
          let ok = true;
          for (const a of accepted) {
            if (turf.distance(rp, a, { units: 'meters' }) < minNN) {
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

  private generateBuildings(buildableArea: turf.Feature<turf.Polygon | turf.MultiPolygon>): turf.Feature[] {
    const densities: Record<DensityLevel, number> = { 
      'low': 7, 
      'medium': 20, 
      'high': 40, 
      'very-high': 70 
    };
    const hectares = this.boundaryArea / 10000;
    const targetCount = Math.floor(hectares * (densities[this.settings.density] || 20));
    
    if (targetCount === 0) return [];

    const candidates = this.generateCandidatePoints(buildableArea, targetCount);
    const placed: turf.Feature[] = [];
    const placedBuffers: turf.Feature[] = [];
    let attempts = 0;
    let i = 0;

    while (placed.length < targetCount && attempts < this.MAX_PLACEMENT_ATTEMPTS) {
      const sourcePt = candidates[i % candidates.length] || turf.center(buildableArea);
      i++;
      attempts++;

      const jitterM = (this.settings.spacing || 10) * 0.5;
      const angle = this.rand() * 360;
      const dist = this.rand() * jitterM;
      const pt = dist 
        ? turf.destination(sourcePt, dist / 1000, angle, { units: 'kilometers' })
        : sourcePt;

      if (!turf.booleanPointInPolygon(pt, buildableArea)) continue;

      const candidateBuilding = this.createBuilding(
        pt.geometry.coordinates as number[],
        placed.length
      );
      
      if (!candidateBuilding || !this.isContained(buildableArea, candidateBuilding)) continue;

      let isOverlapping = false;
      const spacing = this.settings.spacing || 10;
      const candidateBuffer = turf.buffer(candidateBuilding, spacing / 2.0, { units: 'meters' });
      
      if (!candidateBuffer) continue;

      for (let b of placedBuffers) {
        if (b && !turf.booleanDisjoint(candidateBuffer, b)) {
          isOverlapping = true;
          break;
        }
      }

      if (!isOverlapping) {
        placed.push(candidateBuilding);
        placedBuffers.push(candidateBuffer);
      }
    }
    
    return placed.map(f => turf.cleanCoords(f));
  }

  private metersToDegrees(meters: number, latitude: number): { lat: number; lng: number } {
    const lat = meters / 111320;
    const lng = meters / (111320 * Math.cos((latitude * Math.PI) / 180));
    return { lat, lng };
  }

  private isContained(container: turf.Feature, feature: turf.Feature): boolean {
    if (!container || !feature || !container.geometry) return false;
    const containerType = container.geometry.type;

    if (containerType === 'Polygon') {
      try {
        return turf.booleanContains(container, feature);
      } catch (e) {
        console.warn('Error during booleanContains, returning false.', e);
        return false;
      }
    } else if (containerType === 'MultiPolygon') {
      for (const polyCoords of (container.geometry as turf.MultiPolygon).coordinates) {
        const poly = turf.polygon(polyCoords);
        if (turf.booleanContains(poly, feature)) {
          return true;
        }
      }
    }
    return false;
  }

  private createBuilding(center: number[], id: number): turf.Feature<turf.Polygon> | null {
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
    const [xmin, ymin, xmax, ymax] = [cx - halfW, cy - halfH, cx + halfW, cy + halfH];

    let shape = buildingShape || 'mixed';
    if (shape === 'mixed') {
      const shapes: BuildingShape[] = ['rectangle', 'l-shape', 't-shape'];
      shape = shapes[Math.floor(this.rand() * shapes.length)];
    }

    let coords;
    if (shape === 'l-shape') {
      const xmid = xmin + (xmax - xmin) * (0.4 + this.rand() * 0.2);
      const ymid = ymin + (ymax - ymin) * (0.4 + this.rand() * 0.2);
      coords = [[
        [xmin, ymin], [xmax, ymin], [xmax, ymid], [xmid, ymid],
        [xmid, ymax], [xmin, ymax], [xmin, ymin]
      ]];
    } else if (shape === 't-shape') {
      const xmid1 = xmin + (xmax - xmin) * 0.25;
      const xmid2 = xmin + (xmax - xmin) * 0.75;
      const ymid = ymin + (ymax - ymin) * 0.5;
      coords = [[
        [xmin, ymax], [xmax, ymax], [xmax, ymid], [xmid2, ymid],
        [xmid2, ymin], [xmid1, ymin], [xmid1, ymid], [xmin, ymid],
        [xmin, ymax]
      ]];
    } else {
      coords = [[
        [xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]
      ]];
    }

    const building = turf.polygon(coords, {
      id: `b_${id}`,
      type: 'building'
    });
    
    const rotated = turf.transformRotate(building, this.rand() * 360, { pivot: center });
    rotated.properties = {
      ...rotated.properties,
      area: Math.round(turf.area(rotated))
    };
    
    return rotated;
  }

  private generateRoads(buildings: turf.Feature[]): turf.Feature[] {
    if (buildings.length < 2) return [];
    
    // Determine number of road connections based on layout type
    let roadNeighbors = 2; // Default
    
    switch (this.settings.layout) {
      case 'grid':
        roadNeighbors = 4;
        break;
      case 'radial':
      case 'organic':
        roadNeighbors = 3;
        break;
      case 'cul-de-sac':
      case 'linear':
        roadNeighbors = 2;
        break;
      case 'cluster':
        roadNeighbors = 3;
        break;
      case 'mixed':
        roadNeighbors = Math.floor(2 + this.rand() * 2);
        break;
    }
    
    const centers = buildings.map(b => turf.center(b));
    const edges = new Set<string>();
    const lines: turf.Feature<turf.LineString>[] = [];

    for (let i = 0; i < centers.length; i++) {
      const dists = centers
        .map((c, j) => ({
          j,
          d: i === j ? Infinity : turf.distance(centers[i], c)
        }))
        .sort((a, b) => a.d - b.d);

      for (let k = 0; k < Math.min(roadNeighbors, dists.length); k++) {
        const j = dists[k].j;
        const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
        if (!edges.has(key)) {
          edges.add(key);
          lines.push(
            turf.lineString([
              centers[i].geometry.coordinates,
              centers[j].geometry.coordinates
            ], { type: 'road' })
          );
        }
      }
    }
    
    return lines.map(l => turf.cleanCoords(l));
  }
}
