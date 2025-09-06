'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting optimal building placements using AI.
 *
 * The flow takes property details and zoning regulations as input and returns suggested building placements.
 * @param {AISuggestBuildingPlacementInput} input - The input for the AI building placement suggestion flow.
 * @returns {Promise<AISuggestBuildingPlacementOutput>} - A promise that resolves to the AI building placement suggestions.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit/zod';
import {defineFlow, definePrompt} from 'genkit/flow';

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

const aiSuggestBuildingPlacementPrompt = definePrompt(
  {
    name: 'aiSuggestBuildingPlacementPrompt',
    inputSchema: AISuggestBuildingPlacementInputSchema,
    outputSchema: AISuggestBuildingPlacementOutputSchema,
    model: 'googleai/gemini-1.5-flash',
    config: {
      temperature: 0.7,
    },
  },
  async input => {
    return {
      prompt: `You are an AI assistant specializing in suggesting optimal building placements on properties.

  Consider the following property details and zoning regulations to provide the best placement suggestions.

  Property Details: ${input.propertyDetails}
  Zoning Regulations: ${input.zoningRegulations}

  Provide a description of suggested building placements and explain why these placements are optimal, considering both the property details and zoning regulations.`,
      output: {
        format: 'json',
      },
    };
  }
);

const aiSuggestBuildingPlacementFlow = defineFlow(
  {
    name: 'aiSuggestBuildingPlacementFlow',
    inputSchema: AISuggestBuildingPlacementInputSchema,
    outputSchema: AISuggestBuildingPlacementOutputSchema,
  },
  async input => {
    const result = await aiSuggestBuildingPlacementPrompt(input);
    return result;
  }
);
