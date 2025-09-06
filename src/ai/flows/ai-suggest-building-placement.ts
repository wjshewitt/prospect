'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting optimal building placements using AI.
 *
 * The flow takes property details and zoning regulations as input and returns suggested building placements.
 * @param {AISuggestBuildingPlacementInput} input - The input for the AI building placement suggestion flow.
 * @returns {Promise<AISuggestBuildingPlacementOutput>} - A promise that resolves to the AI building placement suggestions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AISuggestBuildingPlacementInputSchema = z.object({
  propertyDetails: z
    .string()
    .describe('Detailed description of the property, including size, terrain, and existing structures.'),
  zoningRegulations: z
    .string()
    .describe('Specific zoning regulations for the property, including setbacks, height restrictions, and usage restrictions.'),
});
export type AISuggestBuildingPlacementInput = z.infer<
  typeof AISuggestBuildingPlacementInputSchema
>;

const AISuggestBuildingPlacementOutputSchema = z.object({
  suggestedPlacements: z
    .string()
    .describe(
      'Description of suggested building placements, considering property details and zoning regulations.'
    ),
  reasoning: z
    .string()
    .describe('Explanation of why the suggested placements are optimal.'),
});
export type AISuggestBuildingPlacementOutput = z.infer<
  typeof AISuggestBuildingPlacementOutputSchema
>;

export async function suggestBuildingPlacement(
  input: AISuggestBuildingPlacementInput
): Promise<AISuggestBuildingPlacementOutput> {
  return aiSuggestBuildingPlacementFlow(input);
}

const aiSuggestBuildingPlacementPrompt = ai.definePrompt(
  {
    name: 'aiSuggestBuildingPlacementPrompt',
    input: { schema: AISuggestBuildingPlacementInputSchema },
    output: { schema: AISuggestBuildingPlacementOutputSchema },
    model: 'googleai/gemini-1.5-flash',
    config: {
      temperature: 0.7,
    },
    prompt: `You are an AI assistant specializing in suggesting optimal building placements on properties.

  Consider the following property details and zoning regulations to provide the best placement suggestions.

  Property Details: {{{propertyDetails}}}
  Zoning Regulations: {{{zoningRegulations}}}

  Provide a description of suggested building placements and explain why these placements are optimal, considering both the property details and zoning regulations.`,
  }
);

const aiSuggestBuildingPlacementFlow = ai.defineFlow(
  {
    name: 'aiSuggestBuildingPlacementFlow',
    inputSchema: AISuggestBuildingPlacementInputSchema,
    outputSchema: AISuggestBuildingPlacementOutputSchema,
  },
  async input => {
    const {output} = await aiSuggestBuildingPlacementPrompt(input);
    return output!;
  }
);
