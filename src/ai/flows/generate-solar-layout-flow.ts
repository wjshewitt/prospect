
'use server';
/**
 * @fileOverview A Genkit flow for generating solar panel layouts on a defined roof area.
 * This flow acts as a solar installation designer, placing panels in an optimal
 * and realistic manner based on a specified density.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for a single point (latitude and longitude)
const PointSchema = z.object({
  lat: z.number().describe('Latitude coordinate of a point.'),
  lng: z.number().describe('Longitude coordinate of a point.'),
});

// Define the schema for a single solar panel
const SolarPanelSchema = z.object({
  footprint: z.array(PointSchema).describe('The four corner points of the solar panel footprint.'),
  rotation: z.number().describe('The rotation of the panel in degrees from North (0-360).'),
});

// Define the input schema for the flow
const GenerateSolarLayoutInputSchema = z.object({
  roofPolygon: z.array(PointSchema).describe('An array of points defining the boundary of the roof to place panels on.'),
  density: z.enum(['low', 'medium', 'high']).describe('The desired density of the solar panel layout.'),
});
export type GenerateSolarLayoutInput = z.infer<typeof GenerateSolarLayoutInputSchema>;

// Define the output schema for the flow
const GenerateSolarLayoutOutputSchema = z.object({
  panels: z.array(SolarPanelSchema).describe('An array of generated solar panel objects.'),
});
export type GenerateSolarLayoutOutput = z.infer<typeof GenerateSolarLayoutOutputSchema>;


/**
 * An exported wrapper function that calls the Genkit flow.
 * @param input - The input object containing the roof polygon and density.
 * @returns A promise that resolves to the generated solar panel layout.
 */
export async function generateSolarLayout(input: GenerateSolarLayoutInput): Promise<GenerateSolarLayoutOutput> {
  return generateSolarLayoutFlow(input);
}


// Define the prompt for the AI model
const generateLayoutPrompt = ai.definePrompt({
  name: 'generateSolarLayoutPrompt',
  input: { schema: GenerateSolarLayoutInputSchema },
  output: { schema: GenerateSolarLayoutOutputSchema },
  prompt: `
    You are an expert solar panel installation designer. Your task is to design a realistic and efficient solar panel layout on a given polygonal roof area, according to a specified density.

    General Rules:
    1.  All generated panels must be strictly inside the provided 'roofPolygon'. The roof is defined by a list of latitude/longitude points.
    2.  Use standard UK residential solar panels, with a footprint of approximately 1.7m x 1.0m. The footprint must be a rectangle defined by four latitude/longitude points.
    3.  Arrange panels in neat rows and columns aligned with the longest edge of the roof polygon. Maintain a small, consistent gap (approx 10-20cm) between panels.
    4.  The rotation of all panels should be uniform, aligned with the primary orientation of the roof.

    Density-Specific Instructions:
    - **low**: Cover about 30-40% of the roof area. Leave significant space around the edges and between panel groups.
    - **medium**: Cover about 50-60% of the roof area. This is a standard, balanced installation.
    - **high**: Maximize the number of panels, covering 70-80% of the roof area. The layout should be dense but still respect small gaps between panels.

    Input Data:
    - Roof Polygon Coordinates (lat, lng): {{{JSON.stringify roofPolygon}}}
    - Desired Density: {{{density}}}

    Output the result as a JSON object matching the prescribed output schema. Ensure all panel footprints are valid rectangles and fall completely within the roof polygon.
  `,
});


// Define the main Genkit flow
const generateSolarLayoutFlow = ai.defineFlow(
  {
    name: 'generateSolarLayoutFlow',
    inputSchema: GenerateSolarLayoutInputSchema,
    outputSchema: GenerateSolarLayoutOutputSchema,
  },
  async (input) => {
    const { output } = await generateLayoutPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a solar panel layout.');
    }
    // The AI output needs a 'type' for the asset, which we add here.
    const panelsWithAssetType = output.panels.map(p => ({
        ...p,
        type: 'solar_panel' 
    }));
    
    return { panels: panelsWithAssetType };
  }
);
