/**
 * @file Defines the base interface for a demographic data provider.
 *
 * This interface establishes a contract for all demographic providers to follow,
 * ensuring that they can be used interchangeably by the DemographicsOrchestrator.
 */

export interface AgeDistribution {
  [ageGroup: string]: number;
}

export interface DemographicData {
  population: number | null;
  households: number | null;
  medianAge: number | null;
  employmentRate: number | null;
  ageDistribution: AgeDistribution | null;
}

export interface DemographicMetadata {
  source: string;
  retrievedAt: Date;
  confidence?: number; // 0-1 confidence score
  coverage?: number; // Geographic coverage percentage
}

export interface DemographicProvider {
  fetchData(
    area: GeoJSON.Feature | GeoJSON.FeatureCollection
  ): Promise<{ data: DemographicData; metadata: DemographicMetadata } | null>;
}
