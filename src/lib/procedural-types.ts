
import { z } from 'zod';

const PointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const ProceduralGenerateLayoutInputSchema = z.object({
  boundary: z.array(PointSchema).describe("The site boundary polygon."),
  density: z.enum(['low', 'medium', 'high', 'very-high']),
  layout: z.enum(['grid', 'cul-de-sac', 'radial', 'organic', 'linear', 'cluster', 'mixed']),
  roadStyle: z.enum(['connect-neighbors', 'trunk-branch']),
  greenSpaceType: z.enum(['none', 'distributed', 'central', 'perimeter']),
  seed: z.string().optional().nullable(),
  roadSetback: z.number(),
  siteSetback: z.number(),
  minBuildingSize: z.number(),
  maxBuildingSize: z.number(),
  spacing: z.number(),
  buildingShape: z.enum(['rectangle', 'l-shape', 't-shape', 'mixed']),
});
export type ProceduralGenerateLayoutInput = z.infer<typeof ProceduralGenerateLayoutInputSchema>;

const GeoJsonFeatureCollectionSchema = z.any();

export const ProceduralGenerateLayoutOutputSchema = z.object({
  buildings: GeoJsonFeatureCollectionSchema,
  greenSpaces: GeoJsonFeatureCollectionSchema,
  roads: GeoJsonFeatureCollectionSchema,
  parcels: GeoJsonFeatureCollectionSchema,
});
export type ProceduralGenerateLayoutOutput = z.infer<typeof ProceduralGenerateLayoutOutputSchema>;
