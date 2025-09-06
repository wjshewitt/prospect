'use server';
/**
 * @fileOverview Procedural generation for urban layouts.
 * This file contains the core logic for generating roads, parcels, and buildings based on a set of rules.
 * It is adapted from a standalone HTML/JS implementation.
 */
import { ai } from '@/ai/genkit';
import { ProceduralGenerateLayoutInputSchema, ProceduralGenerateLayoutOutputSchema, ProceduralGenerateLayoutInput, ProceduralGenerateLayoutOutput } from '@/lib/procedural-types';
import * as turf from '@turf/turf';
import type { Feature, Polygon, LineString, FeatureCollection, MultiPolygon, Point } from '@turf/turf';


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

// Helper to extract polygons from various geometry types
function extractPolygons(geom: Feature<Polygon | MultiPolygon> | null): Feature<Polygon>[] {
    if (!geom) return [];
    
    if (geom.geometry.type === 'Polygon') {
        return [geom as Feature<Polygon>];
    } else if (geom.geometry.type === 'MultiPolygon') {
        // Convert MultiPolygon to array of Polygons
        const multiPoly = geom as Feature<MultiPolygon>;
        return multiPoly.geometry.coordinates.map(coords => 
            turf.polygon(coords)
        );
    }
    return [];
}

// Custom function to find nearest point without using RBush
function findNearestPoint(targetPoint: Feature<Point>, points: FeatureCollection<Point>): Feature<Point> | null {
    if (points.features.length === 0) return null;
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const point of points.features) {
        // Skip the same point
        if (turf.getCoord(point)[0] === turf.getCoord(targetPoint)[0] && 
            turf.getCoord(point)[1] === turf.getCoord(targetPoint)[1]) {
            continue;
        }
        
        const dist = turf.distance(targetPoint, point);
        if (dist < minDistance) {
            minDistance = dist;
            nearest = point;
        }
    }
    
    return nearest;
}

// Simple grid-based parcel generation as alternative to Voronoi
function generateGridParcels(area: Feature<Polygon>, cellSize: number = 50): Feature<Polygon>[] {
    const bbox = turf.bbox(area);
    const parcels: Feature<Polygon>[] = [];
    
    // Create a grid of squares
    const squareGrid = turf.squareGrid(bbox, cellSize, { units: 'meters' });
    
    // Clip each square to the area
    for (const square of squareGrid.features) {
        try {
            const clipped = turf.intersect(square, area);
            if (clipped) {
                const polygons = extractPolygons(clipped as Feature<Polygon | MultiPolygon>);
                parcels.push(...polygons);
            }
        } catch (e) {
            // Skip invalid intersections
        }
    }
    
    return parcels;
}

// --- Core Urban Planning Logic ---
class UrbanPlanner {
  private boundary: Feature<Polygon>;
  private settings: ProceduralGenerateLayoutInput;
  private rand: () => number;
  private boundaryArea: number;

  constructor(boundaryInput: any, settings: ProceduralGenerateLayoutInput) {
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
          if (shrunk) {
              const polygons = extractPolygons(shrunk as Feature<Polygon | MultiPolygon>);
              if (polygons.length > 0) {
                  // Use the largest polygon if multiple
                  base = polygons.reduce((prev, curr) => 
                      turf.area(curr) > turf.area(prev) ? curr : prev
                  );
              }
          }
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
              
              try {
                  const clipped = turf.intersect(park, base);
                  if (clipped) {
                      const clippedPolygons = extractPolygons(clipped as Feature<Polygon | MultiPolygon>);
                      greenSpaces.push(...clippedPolygons);
                      
                      const diff = turf.difference(base, clipped as Feature<Polygon | MultiPolygon>);
                      if (diff) {
                          const diffPolygons = extractPolygons(diff as Feature<Polygon | MultiPolygon>);
                          if (diffPolygons.length > 0) {
                              buildableArea = diffPolygons[0]; // Use largest piece
                          }
                      }
                  }
              } catch (e) {
                  console.warn("Failed to create central green space", e);
              }
              break;
          }
          case "perimeter": {
              const inner = turf.buffer(base, -40, { units: 'meters' });
              if (inner) {
                  const innerPolygons = extractPolygons(inner as Feature<Polygon | MultiPolygon>);
                  if (innerPolygons.length > 0) {
                      try {
                          const ring = turf.difference(base, inner as Feature<Polygon | MultiPolygon>);
                          if (ring) {
                              const ringPolygons = extractPolygons(ring as Feature<Polygon | MultiPolygon>);
                              greenSpaces.push(...ringPolygons);
                          }
                          buildableArea = innerPolygons[0]; // Use largest inner piece
                      } catch (e) {
                          console.warn("Failed to create perimeter green space", e);
                          buildableArea = base;
                      }
                  }
              }
              break;
          }
          // Other cases like 'distributed' can be added here
      }
      return { buildableArea, greenSpaces };
  }

  private generateRoads(area: Feature<Polygon>): FeatureCollection<LineString> {
      // Simplified road generation - create a grid-based road network
      const bbox = turf.bbox(area);
      const lines: Feature<LineString>[] = [];
      
      try {
          // Generate random points for road network
          const numPoints = Math.min(20, Math.max(5, Math.floor(this.boundaryArea / 50000)));
          const points = turf.randomPoint(numPoints, { bbox });
          const validPoints = points.features.filter(pt => {
              try {
                  return turf.booleanPointInPolygon(pt, area);
              } catch {
                  return false;
              }
          });
          
          if (validPoints.length < 2) return turf.featureCollection([]);
          
          // Create a simple connected network
          const pointCollection = turf.featureCollection(validPoints);
          
          // Connect each point to its nearest neighbor
          for (let i = 0; i < validPoints.length; i++) {
              const currentPoint = validPoints[i];
              const nearest = findNearestPoint(currentPoint, pointCollection);
              
              if (nearest) {
                  const line = turf.lineString([
                      turf.getCoord(currentPoint),
                      turf.getCoord(nearest)
                  ]);
                  lines.push(line);
              }
          }
          
          // Add some cross-connections for better connectivity
          for (let i = 0; i < validPoints.length - 1; i++) {
              if (this.rand() > 0.7) { // 30% chance of additional connection
                  const j = Math.floor(this.rand() * (validPoints.length - i - 1)) + i + 1;
                  const line = turf.lineString([
                      turf.getCoord(validPoints[i]),
                      turf.getCoord(validPoints[j])
                  ]);
                  lines.push(line);
              }
          }
      } catch (e) {
          console.warn("Failed to generate roads", e);
      }
      
      return turf.featureCollection(lines);
  }

  private generateParcels(area: Feature<Polygon>, roads: FeatureCollection<LineString>): FeatureCollection<Polygon> {
      let parcelableAreas: Feature<Polygon>[] = [area];
      
      // Subtract road buffers if there are roads
      if (roads.features.length > 0 && this.settings.roadSetback > 0) {
          try {
              const roadBuffer = turf.buffer(roads, this.settings.roadSetback, { units: 'meters' });
              if (roadBuffer) {
                  const diff = turf.difference(area, roadBuffer as Feature<Polygon | MultiPolygon>);
                  if (diff) {
                      parcelableAreas = extractPolygons(diff as Feature<Polygon | MultiPolygon>);
                      if (parcelableAreas.length === 0) {
                          parcelableAreas = [area]; // Fallback to original area
                      }
                  }
              }
          } catch (e) {
              console.warn("Failed to subtract road buffer, using original area", e);
          }
      }
      
      // Generate parcels for each parcelable area
      const allParcels: Feature<Polygon>[] = [];
      
      for (const parcelArea of parcelableAreas) {
          try {
              // Use grid-based parceling instead of Voronoi to avoid RBush issues
              const areaSize = turf.area(parcelArea);
              const targetParcelSize = (this.settings.minBuildingSize + this.settings.maxBuildingSize) / 2 * 2; // Double the building size
              const cellSize = Math.sqrt(targetParcelSize);
              
              const gridParcels = generateGridParcels(parcelArea, cellSize);
              
              // Filter out parcels that are too small
              const validParcels = gridParcels.filter(p => turf.area(p) > 200);
              
              if (validParcels.length === 0) {
                  // If no valid grid parcels, use the whole area
                  allParcels.push(parcelArea);
              } else {
                  allParcels.push(...validParcels);
              }
          } catch (e) {
              console.warn("Failed to generate parcels for area, using as single parcel", e);
              allParcels.push(parcelArea);
          }
      }
      
      return turf.featureCollection(allParcels);
  }

  private generateBuildings(parcels: FeatureCollection<Polygon>, roads: FeatureCollection<LineString>): FeatureCollection<Polygon> {
      const buildings: Feature<Polygon>[] = [];

      for (const parcel of parcels.features) {
          try {
              const areaSqm = turf.area(parcel);
              const targetSizeMin = this.settings.minBuildingSize;
              const targetSizeMax = this.settings.maxBuildingSize;
              const targetArea = targetSizeMin + this.rand() * (targetSizeMax - targetSizeMin);
              
              if (areaSqm < targetArea * 0.8) continue; // Skip if parcel is too small
              
              // Get parcel centroid
              const center = turf.centroid(parcel);
              
              let building: Feature<Polygon> | null = null;
              
              // Create rectangular building
              const ratio = 0.6 + this.rand() * 0.8; // aspect ratio between 0.6 and 1.4
              const width = Math.sqrt(targetArea * ratio);
              const height = targetArea / width;
              
              // Create rectangle using a small buffer around a line
              const halfWidth = width / 2;
              const halfHeight = height / 2;
              const centerCoord = turf.getCoord(center);
              
              // Create rectangle vertices
              const vertices = [
                  turf.destination(turf.destination(centerCoord, halfWidth, 90), halfHeight, 0).geometry.coordinates,
                  turf.destination(turf.destination(centerCoord, halfWidth, 90), halfHeight, 180).geometry.coordinates,
                  turf.destination(turf.destination(centerCoord, halfWidth, -90), halfHeight, 180).geometry.coordinates,
                  turf.destination(turf.destination(centerCoord, halfWidth, -90), halfHeight, 0).geometry.coordinates,
                  turf.destination(turf.destination(centerCoord, halfWidth, 90), halfHeight, 0).geometry.coordinates, // close the polygon
              ];
              
              building = turf.polygon([vertices]);
              
              if (building) {
                  // Ensure building is within parcel
                  const clipped = turf.intersect(building, parcel);
                  if (clipped) {
                      const buildingPolygons = extractPolygons(clipped as Feature<Polygon | MultiPolygon>);
                      // Only add if the building maintains most of its size
                      for (const poly of buildingPolygons) {
                          if (turf.area(poly) > targetArea * 0.5) {
                              buildings.push(poly);
                          }
                      }
                  }
              }
          } catch (e) {
              console.warn("Failed to generate building for parcel", e);
          }
      }

      return turf.featureCollection(buildings);
  }
  
  private cleanGreenSpaces(greenSpaces: Feature<Polygon>[], buildings: FeatureCollection<Polygon>): Feature<Polygon>[] {
    if (!buildings.features.length || !greenSpaces.length) return greenSpaces;
    
    const cleanedSpaces: Feature<Polygon>[] = [];
    
    for (const greenSpace of greenSpaces) {
        let currentSpace: Feature<Polygon | MultiPolygon> | null = greenSpace;
        
        // Subtract each building from the green space
        for (const building of buildings.features) {
            if (!currentSpace) break;
            try {
                const diff = turf.difference(currentSpace, building);
                currentSpace = diff as Feature<Polygon | MultiPolygon> | null;
            } catch (e) {
                // If difference fails, keep the current space
                console.warn("Failed to subtract building from green space", e);
            }
        }
        
        if (currentSpace) {
            const polygons = extractPolygons(currentSpace);
            cleanedSpaces.push(...polygons.filter(p => turf.area(p) > 50)); // Filter out tiny fragments
        }
    }
    
    return cleanedSpaces;
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

    