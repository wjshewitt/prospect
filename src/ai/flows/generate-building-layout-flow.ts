
'use server';
/**
 * @fileOverview A Genkit flow for generating building layouts within a specified zone.
 * This flow uses an AI model to act as an urban planner, placing buildings in a realistic
 * and aesthetically pleasing manner based on a specified density.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for a single point (latitude and longitude)
const PointSchema = z.object({
  lat: z.number().describe('Latitude coordinate of a point.'),
  lng: z.number().describe('Longitude coordinate of a point.'),
});

// Define the schema for a single building
const BuildingSchema = z.object({
  type: z.string().describe("Type of the building (e.g., 'house_detached', 'flat_block')."),
  footprint: z.array(PointSchema).describe('The four corner points of the building footprint.'),
  floors: z.number().describe('Number of floors in the building.'),
  rotation: z.number().describe('The rotation of the building in degrees from North (0-360).'),
});

// Define the input schema for the flow
const GenerateBuildingLayoutInputSchema = z.object({
  zonePolygon: z.array(PointSchema).describe('An array of points defining the boundary of the zone to place buildings in.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the building layout.'),
});
export type GenerateBuildingLayoutInput = z.infer<typeof GenerateBuildingLayoutInputSchema>;

// Define the output schema for the flow
const GenerateBuildingLayoutOutputSchema = z.object({
  buildings: z.array(BuildingSchema).describe('An array of generated building objects.'),
});
export type GenerateBuildingLayoutOutput = z.infer<typeof GenerateBuildingLayoutOutputSchema>;


/**
 * An exported wrapper function that calls the Genkit flow.
 * @param input - The input object containing the zone polygon and density.
 * @returns A promise that resolves to the generated building layout.
 */
export async function generateBuildingLayout(input: GenerateBuildingLayoutInput): Promise<GenerateBuildingLayoutOutput> {
  return generateBuildingLayoutFlow(input);
}


// Define the prompt for the AI model
const generateLayoutPrompt = ai.definePrompt({
  name: 'generateLayoutPrompt',
  input: { schema: GenerateBuildingLayoutInputSchema },
  output: { schema: GenerateBuildingLayoutOutputSchema },
  prompt: `
    You are an expert urban planner AI. Your task is to design a realistic and aesthetically pleasing residential building layout within a given polygonal zone, according to a specified density.

    General Rules:
    1.  All generated buildings must be strictly inside the provided 'zonePolygon'.
    2.  Generate detached houses ('house_detached'), each with 2 floors.
    3.  The footprint for each house should be approximately 8x10 meters.
    4.  Arrange buildings in natural-looking clusters. Avoid placing them in a simple, rigid grid. Introduce slight variations in rotation for each building.
    5.  Ensure a reasonable distance between buildings for privacy and access, according to the density specified.

    Density-Specific Instructions:
    - **low**: Generate a spacious layout with large gaps between buildings, suitable for luxury homes with large yards. Prioritize privacy and open space.
    - **medium**: Generate a standard suburban layout. Buildings should be regularly spaced but not cramped. Balance density with community feel.
    - **high**: Generate a dense layout but maintain realism. Do not just pack the area completely. Create organic clusters of buildings, and leave some irregular open space between clusters to simulate pathways or small common areas. The layout should feel dense but thoughtfully planned.

    Input:
    - Zone Polygon: {{{JSON.stringify zonePolygon}}}
    - Desired Density: {{{density}}}

    Output the result as a JSON object matching the prescribed output schema.
  `,
});


// Define the main Genkit flow
const generateBuildingLayoutFlow = ai.defineFlow(
  {
    name: 'generateBuildingLayoutFlow',
    inputSchema: GenerateBuildingLayoutInputSchema,
    outputSchema: GenerateBuildingLayoutOutputSchema,
  },
  async (input) => {
    // Execute the prompt with the given input
    const { output } = await generateLayoutPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a building layout.');
    }
    return output;
  }
);
