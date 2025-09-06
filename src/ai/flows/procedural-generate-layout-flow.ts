
'use server';
/**
 * @fileOverview Procedural generation for urban layouts.
 * This file contains the core logic for generating roads, parcels, and buildings based on a set of rules.
 * It is adapted from a standalone HTML/JS implementation.
 */
import { ai } from '@/ai/genkit';
import { ProceduralGenerateLayoutInputSchema, ProceduralGenerateLayoutOutputSchema, ProceduralGenerateLayoutInput, ProceduralGenerateLayoutOutput } from '@/lib/procedural-types';
import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, FeatureCollection } from '@turf/turf';


// --- Main exported function ---
export async function proceduralGenerateLayout(input: ProceduralGenerateLayoutInput): Promise<ProceduralGenerateLayoutOutput> {
    return proceduralGenerateLayoutFlow(input);
}

// --- Helper Functions ---
function hashCode(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

function mulberry32(a: number) {
    return function() {
        a |= 0;
        a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- Core Urban Planning Logic ---
class UrbanPlanner {
  private boundary: Feature<Polygon>;
  private settings: ProceduralGenerateLayoutInput;
  private rand: () => number;
  private boundaryArea: number;

  constructor(boundaryInput: LatLng[], settings: ProceduralGenerateLayoutInput) {
    this.settings = settings;
    this.boundary = this.normalizeBoundary(boundaryInput);
    this.boundaryArea = turf.area(this.boundary);
    this.rand = settings.seed ? mulberry32(hashCode(settings.seed)) : Math.random;
  }

  private normalizeBoundary(input: LatLng[]): Feature<Polygon> {
    if (!input || input.length < 3) throw new Error("Boundary must have at least 3 points");
    const coords = input.map(p => [p.lng, p.lat]);
    // Ensure the polygon is closed for Turf.js
    const firstPoint = coords[0];
    const lastPoint = coords[coords.length - 1];
    if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
        coords.push(firstPoint);
    }
    return turf.polygon([coords]);
  }
  
  generateLayout(): ProceduralGenerateLayoutOutput {
    const { buildableArea, greenSpaces } = this.generateGreenSpacesAndBuildable();
    const roads = this.generateRoads(buildableArea);
    const parcels = this.generateParcels(buildableArea, roads);
    const buildings = this.generateBuildings(parcels, roads);
    
    const cleanedGreen = this.cleanGreenSpaces(greenSpaces, buildings);

    return {
        buildings,
        greenSpaces: turf.featureCollection(cleanedGreen),
        roads,
        parcels,
    };
  }

  private generateGreenSpacesAndBuildable(): { buildableArea: Feature<Polygon>, greenSpaces: Feature<Polygon>[] } {
      let base = this.boundary;
      if (this.settings.siteSetback > 0) {
          const shrunk = turf.buffer(base, -this.settings.siteSetback, { units: 'meters' });
          if (shrunk) base = shrunk as Feature<Polygon>;
      }
      
      let greenSpaces: Feature<Polygon>[] = [];
      let buildableArea: Feature<Polygon> = base;

      switch (this.settings.greenSpaceType) {
          case "central": {
              const center = turf.center(base);
              const bbox = turf.bbox(base);
              const width = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'kilometers' });
              const height = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'kilometers' });
              const park = turf.circle(center, Math.min(width, height) * 0.2, { units: 'kilometers' });
              const clipped = turf.intersect(park, base);
              if (clipped) {
                  greenSpaces.push(clipped as Feature<Polygon>);
                  const diff = turf.difference(base, clipped as Feature<Polygon>);
                  if (diff) buildableArea = diff as Feature<Polygon>;
              }
              break;
          }
          case "perimeter": {
              const inner = turf.buffer(base, -40, { units: 'meters' });
              if (inner) {
                  const ring = turf.difference(base, inner as Feature<Polygon>);
                  if(ring) greenSpaces.push(ring as Feature<Polygon>);
                  buildableArea = inner as Feature<Polygon>;
              }
              break;
          }
          // Other cases like 'distributed' can be added here
      }
      return { buildableArea, greenSpaces };
  }

  private generateRoads(area: Feature<Polygon>): FeatureCollection<LineString> {
      // Simplified road generation for integration. 
      // A more complex algorithm like space colonization could be implemented here.
      const bbox = turf.bbox(area);
      const points = turf.randomPoint(20, { bbox });
      const filteredPoints = turf.featureCollection(points.features.filter(pt => turf.booleanPointInPolygon(pt, area)));
      if (filteredPoints.features.length < 2) return turf.featureCollection([]);

      const lines: Feature<LineString>[] = [];
      for (let i = 0; i < filteredPoints.features.length; i++) {
        const nearest = turf.nearestPoint(filteredPoints.features[i], filteredPoints);
        if (nearest && turf.distance(filteredPoints.features[i], nearest) > 0) {
            lines.push(turf.lineString([
                turf.getCoord(filteredPoints.features[i]),
                turf.getCoord(nearest)
            ]));
        }
      }
      return turf.featureCollection(lines);
  }

  private generateParcels(area: Feature<Polygon>, roads: FeatureCollection<LineString>): FeatureCollection<Polygon> {
      const roadBuffer = turf.buffer(roads, this.settings.roadSetback, { units: 'meters' });
      const parcelableArea = turf.difference(area, roadBuffer as Feature<Polygon>);
      if (!parcelableArea) return turf.featureCollection([]);

      const bbox = turf.bbox(parcelableArea);
      const points = turf.randomPoint(50, { bbox }); // Seed points for voronoi
      const filteredPoints = turf.featureCollection(points.features.filter(pt => turf.booleanPointInPolygon(pt, parcelableArea)));

      if (filteredPoints.features.length < 2) return turf.featureCollection([]);
      
      const voronoiPolygons = turf.voronoi(filteredPoints, { bbox });

      const clippedParcels = voronoiPolygons.features.map(poly => {
          const intersection = turf.intersect(poly, parcelableArea);
          return intersection;
      }).filter((p): p is Feature<Polygon> => p !== null && turf.area(p) > 200);

      return turf.featureCollection(clippedParcels);
  }

  private generateBuildings(parcels: FeatureCollection<Polygon>, roads: FeatureCollection<LineString>): FeatureCollection<Polygon> {
      const buildings: Feature<Polygon>[] = [];

      parcels.features.forEach(parcel => {
          // Simplified: place one building per parcel
          const areaSqm = turf.area(parcel);
          const targetSizeMin = this.settings.minBuildingSize;
          const targetSizeMax = this.settings.maxBuildingSize;
          const targetArea = targetSizeMin + this.rand() * (targetSizeMax - targetSizeMin);
          if (areaSqm < targetArea) return;

          const center = turf.centroid(parcel).geometry.coordinates;
          
          const ratio = 0.6 + this.rand() * 0.8;
          const widthMeters = Math.sqrt(targetArea * ratio);
          const heightMeters = targetArea / widthMeters;

          const buildingRect = turf.polygon([[
              turf.destination(center, widthMeters / 2, -90, { units: 'meters' }).geometry.coordinates,
              turf.destination(center, widthMeters / 2, 90, { units: 'meters' }).geometry.coordinates,
          ]]);

          const building = turf.buffer(turf.point(center), Math.sqrt(targetArea / Math.PI), {units: 'meters'});

          buildings.push(building as Feature<Polygon>);
      });

      return turf.featureCollection(buildings);
  }
  
  private cleanGreenSpaces(greenSpaces: Feature<Polygon>[], buildings: FeatureCollection<Polygon>): Feature<Polygon>[] {
    if (!buildings.features.length || !greenSpaces.length) return greenSpaces;
    try {
        const allBuildings = turf.union(...buildings.features as [Feature<Polygon>, ...Feature<Polygon>[]]);
        if (!allBuildings) return greenSpaces;
        
        return greenSpaces.map(gs => {
            const diff = turf.difference(gs, allBuildings as Feature<Polygon>);
            return diff as Feature<Polygon> | null;
        }).filter((gs): gs is Feature<Polygon> => gs !== null);
    } catch (e) {
        console.error("Failed to clean green spaces", e);
        return greenSpaces;
    }
  }
}

type LatLng = { lat: number, lng: number };


const proceduralGenerateLayoutFlow = ai.defineFlow(
  {
    name: 'proceduralGenerateLayoutFlow',
    inputSchema: ProceduralGenerateLayoutInputSchema,
    outputSchema: ProceduralGenerateLayoutOutputSchema,
  },
  async (input) => {
    try {
        const planner = new UrbanPlanner(input.boundary, input);
        const layout = planner.generateLayout();
        return layout;
    } catch (e: any) {
        console.error("Error in procedural generation flow:", e);
        throw new Error(`Procedural generation failed: ${e.message}`);
    }
  }
);
