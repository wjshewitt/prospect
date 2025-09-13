
import { z } from 'zod';

const PointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

// Define enums for string literals to be used in both Zod schema and TypeScript types
export const DensityLevelEnum = z.enum(['low', 'medium', 'high', 'very-high']);
export const LayoutPatternEnum = z.enum(['grid', 'cul-de-sac', 'radial', 'organic', 'linear', 'cluster', 'mixed']);
export const RoadStyleEnum = z.enum(['connect-neighbors', 'trunk-branch']);
export const GreenSpaceTypeEnum = z.enum(['none', 'distributed', 'central', 'perimeter']);
export const BuildingShapeEnum = z.enum(['rectangle', 'l-shape', 't-shape', 'mixed']);

// TypeScript types derived from Zod enums
export type DensityLevel = z.infer<typeof DensityLevelEnum>;
export type LayoutPattern = z.infer<typeof LayoutPatternEnum>;
export type RoadStyle = z.infer<typeof RoadStyleEnum>;
export type GreenSpaceType = z.infer<typeof GreenSpaceTypeEnum>;
export type BuildingShape = z.infer<typeof BuildingShapeEnum>;

// Zod schema for the full input, used for validation in the Genkit flow
export const ProceduralGenerateLayoutInputSchema = z.object({
  boundary: z.array(PointSchema).describe("The site boundary polygon."),
  density: DensityLevelEnum,
  layout: LayoutPatternEnum,
  roadStyle: RoadStyleEnum,
  greenSpaceType: GreenSpaceTypeEnum,
  seed: z.string().optional().nullable(),
  roadSetback: z.number(),
  siteSetback: z.number(),
  minBuildingSize: z.number(),
  maxBuildingSize: z.number(),
  spacing: z.number(),
  buildingShape: BuildingShapeEnum,
});

// Main input type used by the UrbanPlanner class and UI
export type ProceduralSettings = z.infer<typeof ProceduralGenerateLayoutInputSchema>;

// Alias for backward compatibility and clarity
export type ProceduralGenerateLayoutInput = ProceduralSettings;

// Output schema remains the same
const GeoJsonFeatureCollectionSchema = z.any();

export const ProceduralGenerateLayoutOutputSchema = z.object({
  buildings: GeoJsonFeatureCollectionSchema,
  greenSpaces: GeoJsonFeatureCollectionSchema,
  roads: GeoJsonFeatureCollectionSchema,
  parcels: GeoJsonFeatureCollectionSchema,
});
export type ProceduralGenerateLayoutOutput = z.infer<typeof ProceduralGenerateLayoutOutputSchema>;
