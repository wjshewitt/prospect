
'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating procedural site layouts.
 * It uses the UrbanPlanner class to perform the core generation logic.
 */

import { ai } from '@/ai/genkit';
import * as turf from '@turf/turf';

import {
  ProceduralGenerateLayoutInputSchema,
  ProceduralGenerateLayoutOutputSchema,
  type ProceduralSettings,
  type ProceduralGenerateLayoutOutput,
} from '@/lib/procedural-types';
import { UrbanPlanner } from '@/lib/urban-planner';


/* -----------------------------------------------------------------------------
   Flow definition
----------------------------------------------------------------------------- */

export const proceduralGenerateLayoutFlow = ai.defineFlow(
  {
    name: 'proceduralGenerateLayoutFlow',
    inputSchema: ProceduralGenerateLayoutInputSchema,
    outputSchema: ProceduralGenerateLayoutOutputSchema,
  },
  async (input: ProceduralSettings): Promise<ProceduralGenerateLayoutOutput> => {
    return proceduralGenerateLayout(input);
  }
);

/* -----------------------------------------------------------------------------
   Public API (named + default export)
----------------------------------------------------------------------------- */

export async function proceduralGenerateLayout(
  input: ProceduralSettings
): Promise<ProceduralGenerateLayoutOutput> {
  const planner = new UrbanPlanner(input.boundary, input);
  const { buildings, greenSpaces, roads } = planner.generateLayout();
  
  // The planner returns FeatureCollections. Parcels are implicitly defined.
  // For now, return an empty FeatureCollection for parcels as per the schema.
  const parcels = turf.featureCollection([]);

  return {
    roads,
    parcels,
    greenSpaces,
    buildings,
  };
}

export default proceduralGenerateLayout;
