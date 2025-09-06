'use server';
/**
 * @fileOverview A Genkit flow for procedural site layout generation.
 * This flow uses deterministic algorithms to generate roads, parcels, and building footprints.
 */

import { ai } from '@/ai/genkit';
import { ProceduralGenerateLayoutInputSchema, ProceduralGenerateLayoutOutputSchema } from '@/lib/procedural-types';
import type { ProceduralGenerateLayoutInput, ProceduralGenerateLayoutOutput } from '@/lib/procedural-types';
import * as turf from '@turf/turf';

function normalizeBoundary(boundary: ProceduralGenerateLayoutInput['boundary']): turf.helpers.Position[] {
    const coords = boundary.map(p => [p.lng, p.lat]);
    if (coords.length > 2 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0]);
    }
    return coords;
}


/**
 * Exported wrapper function that calls the Genkit flow.
 * @param input - The input object containing the generation parameters.
 * @returns A promise that resolves to the generated layout.
 */
export async function proceduralGenerateLayout(
  input: ProceduralGenerateLayoutInput
): Promise<ProceduralGenerateLayoutOutput> {
  return proceduralGenerateLayoutFlow(input);
}


// Define the main Genkit flow
const proceduralGenerateLayoutFlow = ai.defineFlow(
  {
    name: 'proceduralGenerateLayoutFlow',
    inputSchema: ProceduralGenerateLayoutInputSchema,
    outputSchema: ProceduralGenerateLayoutOutputSchema,
  },
  async (input) => {
    // This is a placeholder for a complex procedural generation algorithm.
    // A real implementation would involve sophisticated geometric operations.
    // For this example, we'll generate a simple grid of rectangular buildings.

    const boundaryCoords = normalizeBoundary(input.boundary);
    const boundaryPolygon = turf.polygon([boundaryCoords]);
    const boundaryBbox = turf.bbox(boundaryPolygon);

    const buildings: turf.helpers.Feature[] = [];

    const buildingWidth = 0.0001; // ~11 meters
    const buildingHeight = 0.00008; // ~9 meters
    const spacingX = buildingWidth + (input.spacing / 111320);
    const spacingY = buildingHeight + (input.spacing / 111320);

    for (let lng = boundaryBbox[0]; lng < boundaryBbox[2]; lng += spacingX) {
      for (let lat = boundaryBbox[1]; lat < boundaryBbox[3]; lat += spacingY) {
        const buildingCenter = turf.point([lng + buildingWidth / 2, lat + buildingHeight / 2]);
        
        // Check if the center of the potential building is inside the boundary
        if (turf.booleanPointInPolygon(buildingCenter, boundaryPolygon)) {
            const buildingFootprint = turf.polygon([[
                [lng, lat],
                [lng + buildingWidth, lat],
                [lng + buildingWidth, lat + buildingHeight],
                [lng, lat + buildingHeight],
                [lng, lat]
            ]]);
            buildings.push(buildingFootprint);
        }
      }
    }
    
    return {
      buildings: turf.featureCollection(buildings),
      greenSpaces: turf.featureCollection([]),
      roads: turf.featureCollection([]),
      parcels: turf.featureCollection([]),
    };
  }
);
