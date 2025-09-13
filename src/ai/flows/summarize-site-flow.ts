"use server";
/**
 * @fileOverview A Genkit flow for generating a textual summary of a development site.
 * This flow acts as an AI site analyst, interpreting geometric and topographic data
 * to provide a human-readable assessment.
 */

import { z } from "zod";
import { ai } from "@/ai/genkit";
import type { ProximityData } from "@/services/proximity-service";
import type { IntegratedData } from "@/services/data-integrator-service";
import type { ElevationGrid } from "@/lib/types";

// Define the input schema for the flow
const SummarizeSiteInputSchema = z.object({
  siteName: z.string().describe("The name of the site."),
  siteAreaAcres: z.number().describe("The total area of the site in acres."),
  elevationDifference: z
    .number()
    .describe(
      "The difference in meters between the highest and lowest points of the site."
    ),
  steepPercent: z
    .number()
    .describe('The percentage of the site area that is considered "steep".'),
  averageSlope: z
    .number()
    .describe("The average slope percentage across the entire site."),
  // Use z.any() to avoid TS structural assignment errors when passing typed objects
  proximityData: z
    .any()
    .describe("Proximity analysis data including distances to key amenities.")
    .optional(),
  integratedData: z
    .any()
    .describe(
      "Integrated data including demographics, environmental, regulatory."
    )
    .optional(),
  elevationGrid: z.any().describe("Full elevation grid data.").optional(),
  localAuthority: z
    .object({
      name: z.string(),
      reference: z.string(),
      entity: z.string(),
      planningAuthority: z.string(),
    })
    .optional()
    .describe("Local authority information for the site location."),
  extensive: z
    .boolean()
    .default(false)
    .describe(
      "Flag to generate extensive report (500-800 words) with detailed sections, risks, opportunities, recommendations."
    ),
});
export type SummarizeSiteInput = z.infer<typeof SummarizeSiteInputSchema>;

// Define the output schema for the flow
const SummarizeSiteOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      "A concise, natural-language summary of the site assessment (150-200 words)."
    ),
  extensive: z
    .object({
      detailedAnalysis: z
        .string()
        .describe(
          "In-depth exploration of data drivers and implications (200-300 words)."
        ),
      risksOpportunities: z
        .string()
        .describe(
          "Balanced assessment with quantified probabilities (100-200 words)."
        ),
      recommendations: z
        .string()
        .describe("Step-by-step strategies with timelines (100-200 words)."),
    })
    .optional()
    .describe("Extensive report sections, only if extensive flag is true."),
});
export type SummarizeSiteOutput = z.infer<typeof SummarizeSiteOutputSchema>;

/**
 * An exported wrapper function that calls the Genkit flow.
 * @param input - The input object containing the site data.
 * @returns A promise that resolves to the AI-generated site summary.
 */
export async function summarizeSite(
  input: SummarizeSiteInput
): Promise<SummarizeSiteOutput> {
  return summarizeSiteFlow(input);
}

// Define the prompt for the AI model
const summarizeSitePromptV2 = ai.definePrompt({
  name: "summarizeSitePromptV2",
  input: { schema: SummarizeSiteInputSchema },
  output: { schema: SummarizeSiteOutputSchema },
  model: "googleai/gemini-1.5-flash",
  config: {
    temperature: 0.3,
  },
  prompt: `
You are a professional Site Assessment Analyst, specialising in UK land development, planning, and construction.

Your objective is to produce a data-driven report that assesses a site's viability for development. The analysis must focus on factors directly impacting planning permission, construction feasibility, and market potential.

Use only the specific data provided for this site. Integrate all available data naturally into your analysis (e.g., "The site is 2.3km from the nearest school, which meets basic accessibility requirements but may require a transport assessment for larger schemes."). Do not include general statistics or assumptions about national averages unless explicitly provided in the data.
Do not mention missing, unavailable, or insufficient data. Be definitive within the provided scope and avoid phrases such as "data not available" or "insufficient data".
Round the site area to the nearest whole acre when writing the narrative (do not show excessive decimal places).
Conclude with 1–2 sentences that synthesize what the proximity metrics imply for planning, access, and market suitability.

{{#if extensive}}
Generate an EXTENSIVE report (500-800 words total) with the following structure:

Executive Summary (150-200 words): A high-level synopsis for decision-makers, outlining the site's core potential, key constraints, and a concluding recommendation based on the specific data provided.

Detailed Analysis: An in-depth breakdown of the site's characteristics, covering only the data points available:

Topography & Ground Conditions: Implications of slope, elevation, and soil type on design, earthworks, and foundation strategy using the specific measurements provided.

Planning & Regulatory Context: Assessment based on the specific regulatory data provided, including Green Belt status and compliance score.

Infrastructure & Access: Evaluation using the specific proximity data to amenities, transport, and utilities availability.

Environmental Factors: Analysis using the specific flood risk, soil quality, and environmental data provided.

Risks & Opportunities: A summary of primary development barriers and value-add opportunities based specifically on the site's data. Quantify using the actual measurements where possible.

Strategic Recommendations: Actionable, phased recommendations for next steps based on the specific findings (e.g., "Phase 1 (Q1 2025): Commission geotechnical investigation focusing on identified steep areas. Phase 2 (Q2 2025): Flood risk assessment for affected zones.").
{{/if}}

{{#unless extensive}}
Generate a BASIC summary (150-200 words): A concise overview of the site's development suitability, covering only the most critical findings from the specific data provided related to topography, proximity, environmental factors, and regulatory compliance.
{{/unless}}

Available Data Points (use only these specific values):

Site: {{siteName}}, {{siteAreaAcres}} acres.

Topography: Elevation difference of {{elevationDifference}}m across the site; average slope {{averageSlope}}%; {{steepPercent}}% of the area exceeds 8% slope.

Ground Conditions:
{{#if integratedData.environmental}}
  {{#if integratedData.environmental.soil}}
    - Soil Type: {{integratedData.environmental.soil.soilType}}
    - Quality: {{integratedData.environmental.soil.quality}}
    - Drainage: {{integratedData.environmental.soil.drainage}}
  {{/if}}
{{/if}}

Proximity & Access:
{{#if proximityData}}
  {{#if proximityData.airport}}- Airport: {{proximityData.airport.name}} at {{proximityData.airport.distanceKm}}km ({{proximityData.airport.distanceMiles}} miles){{/if}}
  {{#if proximityData.hospital}}- Hospital: {{proximityData.hospital.name}} at {{proximityData.hospital.distanceKm}}km ({{proximityData.hospital.distanceMiles}} miles){{/if}}
  {{#if proximityData.school}}- School: {{proximityData.school.name}} at {{proximityData.school.distanceKm}}km ({{proximityData.school.distanceMiles}} miles){{/if}}
  {{#if proximityData.town}}- Town Centre: {{proximityData.town.name}} at {{proximityData.town.distanceKm}}km ({{proximityData.town.distanceMiles}} miles){{/if}}
  {{#if proximityData.highway}}- Highway Access: {{proximityData.highway.name}} at {{proximityData.highway.distanceKm}}km ({{proximityData.highway.distanceMiles}} miles){{/if}}
{{/if}}

Demographics (Local Area Specific):
{{#if integratedData.demographic}}
  - Population: {{integratedData.demographic.population}}
  - Average Household Income: £{{integratedData.demographic.averageIncomeGbp}}
  - Employment Rate: {{integratedData.demographic.employmentRate}}%
  - Median Age: {{integratedData.demographic.medianAge}}
  - Property Ownership Rate: {{integratedData.demographic.propertyOwnershipRate}}%
{{/if}}

Environmental Factors (Site Specific):
{{#if integratedData.environmental}}
  {{#if integratedData.environmental.flood}}
    - Flood Risk: {{integratedData.environmental.flood.riskLevel}} ({{integratedData.environmental.flood.percentageAffected}}% of site affected)
  {{/if}}
  {{#if integratedData.environmental.soil}}
    - Soil: {{integratedData.environmental.soil.quality}} quality, {{integratedData.environmental.soil.soilType}} classification
  {{/if}}
{{/if}}

Infrastructure Availability:
{{#if integratedData.infrastructure}}
  - Water: {{integratedData.infrastructure.utilities.water}}
  - Electricity: {{integratedData.infrastructure.utilities.electricity}}
  - Sewerage: {{integratedData.infrastructure.utilities.sewerage}}
{{/if}}

Regulatory Status (Site Specific):
{{#if integratedData.regulatory}}
  - Green Belt: {{integratedData.regulatory.greenBelt}}
  - Planning Compliance Score: {{integratedData.regulatory.complianceScore}}/100
  - Local Plan Designation: {{integratedData.regulatory.designation}}
{{/if}}

Local Authority Context:
{{#if localAuthority}}
  - Planning Authority: {{localAuthority.planningAuthority}}
  - Local Authority: {{localAuthority.name}} ({{localAuthority.reference}})
  - Contact: {{localAuthority.planningAuthority}} for planning applications and local development plan policies
{{/if}}

Suggested Visualisations: Recommend specific geospatial visualisations based on the available data. Examples:
- If slope data available: "Topographic contour map highlighting areas above 8% slope ({{steepPercent}}% of site)"
- If flood data available: "Flood risk overlay showing affected areas"
- If proximity data available: "Isochrone map from site centre to key amenities"
- If demographics available: "Market catchment map showing local population within the analysis radius"

Tone & Output:
Maintain a professional, objective, and authoritative tone suitable for developers, investors, and planning committees. Base all conclusions on the specific data provided—no speculation beyond the facts.

The context is strictly UK planning and construction standards (NPPF, Building Regulations, etc.).

Output the final report in a JSON structure: {summary: "...", extensive: {detailedAnalysis: "...", risksOpportunities: "...", recommendations: "..."} if extensive}.
      `,
});

// Define the main Genkit flow
const summarizeSiteFlow = ai.defineFlow(
  {
    name: "summarizeSiteFlow",
    inputSchema: SummarizeSiteInputSchema,
    outputSchema: SummarizeSiteOutputSchema,
  },
  async (input) => {
    const { output } = await summarizeSitePromptV2(input);
    return output!;
  }
);
