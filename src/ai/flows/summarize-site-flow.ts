
'use server';
/**
 * @fileOverview A Genkit flow for generating a textual summary of a development site.
 * This flow acts as an AI site analyst, interpreting geometric and topographic data
 * to provide a human-readable assessment.
 */

import { z } from 'zod';
import { ai } from '@/ai/genkit';

// Define the input schema for the flow
const SummarizeSiteInputSchema = z.object({
  siteName: z.string().describe('The name of the site.'),
  siteAreaAcres: z.number().describe('The total area of the site in acres.'),
  elevationDifference: z.number().describe('The difference in meters between the highest and lowest points of the site.'),
  steepPercent: z.number().describe('The percentage of the site area that is considered "steep".'),
  averageSlope: z.number().describe('The average slope percentage across the entire site.'),
});
export type SummarizeSiteInput = z.infer<typeof SummarizeSiteInputSchema>;

// Define the output schema for the flow
const SummarizeSiteOutputSchema = z.object({
  summary: z.string().describe('A concise, natural-language summary of the site assessment.'),
});
export type SummarizeSiteOutput = z.infer<typeof SummarizeSiteOutputSchema>;

/**
 * An exported wrapper function that calls the Genkit flow.
 * @param input - The input object containing the site data.
 * @returns A promise that resolves to the AI-generated site summary.
 */
export async function summarizeSite(input: SummarizeSiteInput): Promise<SummarizeSiteOutput> {
  return summarizeSiteFlow(input);
}

// Define the prompt for the AI model
const summarizeSitePrompt = ai.definePrompt({
  name: 'summarizeSitePrompt',
  inputSchema: SummarizeSiteInputSchema,
  outputSchema: SummarizeSiteOutputSchema,
  model: 'googleai/gemini-1.5-flash',
  config: {
      temperature: 0.3,
  }
}, async (input) => {
    return {
        prompt: `
        You are an expert site assessment analyst for land development.
        Your task is to create a concise, professional summary based on the provided data.
        The summary should be easy to understand for a developer or planner.

        General Guidance:
        - Start by stating the site name and its total acreage.
        - Comment on the overall suitability for development based on the topography.
        - A typical steepness threshold for easy development is around 8-10%.
        - An elevation difference of over 30 meters on a small site can indicate challenging terrain.

        Tone and Language:
        - If the site is generally flat (e.g., average slope < 8% and low steep percentage), describe it as "well-suited for development" or "appears ready to build."
        - If a small portion of the site is steep (e.g., steepPercent is between 10% and 30%), mention it as a "localized challenge" or that "some areas of steeper terrain exist" but the rest is buildable.
        - If a significant portion is steep (e.g., steepPercent > 30%), describe the site as having "significant topographical challenges" or "requiring careful planning due to steep slopes." Adjust the language to be more cautious.
        - Always mention the elevation difference as context for the overall vertical relief.

        Input Data:
        - Site Name: ${input.siteName}
        - Site Area (acres): ${input.siteAreaAcres.toFixed(2)}
        - Elevation Difference (meters): ${input.elevationDifference.toFixed(1)}
        - Percentage of Site Considered Steep: ${input.steepPercent.toFixed(1)}%
        - Average Slope: ${input.averageSlope.toFixed(1)}%

        Example Output for a good site:
        "The site 'North Ridge Estates' covers 45.2 acres and appears well-suited for development. The terrain is generally gentle, with an average slope of just 5.1% and a total elevation difference of 15 meters. Only a small fraction of the land, about 8%, exceeds the typical steepness threshold, suggesting most of the area is straightforward to build on."

        Example Output for a challenging site:
        "The proposed 'Mountain View' development, spanning 22.5 acres, presents some topographical challenges. With over 40% of the site having steep slopes and a significant elevation difference of 55 meters, development will require careful planning and potential engineering solutions to manage the terrain. The average slope is 18.5%, indicating that much of the area is not flat."

        Now, generate a summary for the provided input data.
      `,
        output: {
            format: 'json',
        }
    }
});

// Define the main Genkit flow
const summarizeSiteFlow = ai.defineFlow(
  {
    name: 'summarizeSiteFlow',
    inputSchema: SummarizeSiteInputSchema,
    outputSchema: SummarizeSiteOutputSchema,
  },
  async (input) => {
    const result = await summarizeSitePrompt(input);
    return result;
  }
);
