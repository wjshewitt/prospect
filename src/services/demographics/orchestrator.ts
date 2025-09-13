/**
 * @file Implements the core orchestrator for the demographics feature.
 *
 * The DemographicsOrchestrator is responsible for fetching, aggregating,
 * and caching demographic data from various providers.
 */

import {
  DemographicProvider,
  DemographicData,
  DemographicMetadata,
} from "./providers/base";

interface ProviderResult {
  data: DemographicData;
  metadata: DemographicMetadata;
  providerName: string;
}

interface AggregationStrategy {
  population?: "first" | "average" | "max";
  households?: "first" | "average" | "max";
  medianAge?: "first" | "average" | "weighted_average";
  employmentRate?: "first" | "average" | "weighted_average";
  ageDistribution?: "first" | "merge" | "average";
}

/**
 * Manages and coordinates demographic data providers to fulfill data requests.
 * Supports data aggregation from multiple sources with configurable strategies.
 */
export class DemographicsOrchestrator {
  private providers: DemographicProvider[];
  private aggregationStrategy: AggregationStrategy;
  private timeout: number;
  private cache: Map<
    string,
    { data: DemographicData; metadata: DemographicMetadata; timestamp: number }
  >;
  private cacheTtl: number; // Cache TTL in milliseconds

  /**
   * Initializes the orchestrator with a set of demographic data providers.
   * @param providers - An array of objects that conform to the DemographicProvider interface.
   * @param aggregationStrategy - Strategy for combining data from multiple providers.
   * @param timeout - Timeout in milliseconds for each provider request (default: 30000).
   */
  constructor(
    providers: DemographicProvider[],
    aggregationStrategy: AggregationStrategy = {
      population: "first",
      households: "first",
      medianAge: "first",
      employmentRate: "first",
      ageDistribution: "first",
    },
    timeout: number = 30000,
    cacheTtl: number = 3600000 // 1 hour default cache TTL
  ) {
    this.providers = providers;
    this.aggregationStrategy = aggregationStrategy;
    this.timeout = timeout;
    this.cache = new Map();
    this.cacheTtl = cacheTtl;
  }

  /**
   * Fetches demographic data for a given area, coordinating between multiple providers.
   * Implements sophisticated fallback and aggregation strategies.
   *
   * @param area - A GeoJSON Feature or FeatureCollection.
   * @returns A promise that resolves to an aggregated demographic data object.
   */
  public async getDemographics(
    area: GeoJSON.Feature | GeoJSON.FeatureCollection
  ): Promise<{ data: DemographicData; metadata: DemographicMetadata }> {
    // Generate cache key from area coordinates
    const cacheKey = this.generateCacheKey(area);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      console.log("Returning cached demographic data");
      return { data: cached.data, metadata: cached.metadata };
    }

    const results: ProviderResult[] = [];
    const errors: { provider: string; error: Error }[] = [];

    // Attempt to fetch data from all providers concurrently with timeout
    const providerPromises = this.providers.map(async (provider) => {
      const providerName = provider.constructor.name;
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Timeout after ${this.timeout}ms`)),
            this.timeout
          );
        });

        const result = await Promise.race([
          provider.fetchData(area),
          timeoutPromise,
        ]);

        if (result) {
          results.push({
            ...result,
            providerName,
          });
          console.log(`Successfully fetched data from ${providerName}`);
        } else {
          console.warn(`${providerName} returned null result`);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ provider: providerName, error: err });
        console.error(`Error fetching data from ${providerName}:`, err.message);
      }
    });

    // Wait for all providers to complete or fail
    await Promise.allSettled(providerPromises);

    if (results.length === 0) {
      const errorMessages = errors
        .map((e) => `${e.provider}: ${e.error.message}`)
        .join("; ");
      throw new Error(
        `No demographic data could be fetched from any provider. Errors: ${errorMessages}`
      );
    }

    let result: { data: DemographicData; metadata: DemographicMetadata };

    // If we have results, aggregate them according to the strategy
    if (results.length === 1) {
      // Single result, return as-is but update metadata
      const singleResult = results[0];
      result = {
        data: singleResult.data,
        metadata: {
          ...singleResult.metadata,
          source: `${singleResult.metadata.source} (via ${singleResult.providerName})`,
        },
      };
    } else {
      // Multiple results, aggregate according to strategy
      result = this.aggregateResults(results);
    }

    // Cache the result
    this.cache.set(cacheKey, {
      data: result.data,
      metadata: result.metadata,
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * Aggregates results from multiple providers according to the configured strategy.
   */
  private aggregateResults(results: ProviderResult[]): {
    data: DemographicData;
    metadata: DemographicMetadata;
  } {
    const aggregatedData: DemographicData = {
      population: this.aggregateNumericField(
        results,
        "population",
        this.aggregationStrategy.population || "first"
      ),
      households: this.aggregateNumericField(
        results,
        "households",
        this.aggregationStrategy.households || "first"
      ),
      medianAge: this.aggregateNumericField(
        results,
        "medianAge",
        this.aggregationStrategy.medianAge || "first"
      ),
      employmentRate: this.aggregateNumericField(
        results,
        "employmentRate",
        this.aggregationStrategy.employmentRate || "first"
      ),
      ageDistribution: this.aggregateAgeDistribution(
        results,
        this.aggregationStrategy.ageDistribution || "first"
      ),
    };

    const sources = results
      .map((r) => `${r.metadata.source} (${r.providerName})`)
      .join(", ");
    const latestRetrievedAt = new Date(
      Math.max(...results.map((r) => r.metadata.retrievedAt.getTime()))
    );

    const aggregatedMetadata: DemographicMetadata = {
      source: `Aggregated from: ${sources}`,
      retrievedAt: latestRetrievedAt,
    };

    return { data: aggregatedData, metadata: aggregatedMetadata };
  }

  /**
   * Aggregates a numeric field according to the specified strategy.
   */
  private aggregateNumericField(
    results: ProviderResult[],
    field: keyof DemographicData,
    strategy: "first" | "average" | "max" | "weighted_average"
  ): number | null {
    const values = results
      .map((r) => r.data[field])
      .filter(
        (val): val is number =>
          val !== null && val !== undefined && typeof val === "number"
      );

    if (values.length === 0) return null;

    switch (strategy) {
      case "first":
        return values[0];
      case "average":
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case "max":
        return Math.max(...values);
      case "weighted_average":
        // For now, treat as simple average. In future, could weight by data quality/recency
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      default:
        return values[0];
    }
  }

  /**
   * Aggregates age distribution data according to the specified strategy.
   */
  private aggregateAgeDistribution(
    results: ProviderResult[],
    strategy: "first" | "merge" | "average"
  ): Record<string, number> | null {
    const distributions = results
      .map((r) => r.data.ageDistribution)
      .filter(
        (dist): dist is Record<string, number> =>
          dist !== null && dist !== undefined
      );

    if (distributions.length === 0) return null;

    switch (strategy) {
      case "first":
        return distributions[0];
      case "merge":
      case "average":
        // Get all unique age groups
        const allAgeGroups = new Set<string>();
        distributions.forEach((dist) => {
          Object.keys(dist).forEach((group) => allAgeGroups.add(group));
        });

        const merged: Record<string, number> = {};
        allAgeGroups.forEach((group) => {
          const values = distributions
            .map((dist) => dist[group])
            .filter((val): val is number => val !== undefined && val !== null);

          if (values.length > 0) {
            merged[group] =
              strategy === "average"
                ? values.reduce((sum, val) => sum + val, 0) / values.length
                : values.reduce((sum, val) => sum + val, 0);
          }
        });

        return merged;
      default:
        return distributions[0];
    }
  }

  /**
   * Adds a new provider to the orchestrator.
   */
  public addProvider(provider: DemographicProvider): void {
    this.providers.push(provider);
  }

  /**
   * Removes a provider from the orchestrator.
   */
  public removeProvider(
    providerClass: new (...args: any[]) => DemographicProvider
  ): void {
    this.providers = this.providers.filter(
      (p) => !(p instanceof providerClass)
    );
  }

  /**
   * Generates a cache key from GeoJSON area coordinates.
   */
  private generateCacheKey(
    area: GeoJSON.Feature | GeoJSON.FeatureCollection
  ): string {
    let coordinates: number[];

    if (area.type === "FeatureCollection") {
      if (!area.features || area.features.length === 0) {
        throw new Error("Invalid GeoJSON: FeatureCollection has no features");
      }
      const feature = area.features[0];
      if (!feature.geometry || feature.geometry.type !== "Point") {
        throw new Error(
          "Invalid GeoJSON: first feature must have Point geometry"
        );
      }
      coordinates = (feature.geometry as GeoJSON.Point).coordinates;
    } else {
      if (!area.geometry || area.geometry.type !== "Point") {
        throw new Error("Invalid GeoJSON: must have Point geometry");
      }
      coordinates = (area.geometry as GeoJSON.Point).coordinates;
    }

    // Round coordinates to 6 decimal places for cache key stability
    const roundedCoords = coordinates.map(
      (coord) => Math.round(coord * 1000000) / 1000000
    );
    return `demographics:${roundedCoords.join(",")}`;
  }

  /**
   * Clears the cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics.
   */
  public getCacheStats(): { size: number; ttl: number } {
    return {
      size: this.cache.size,
      ttl: this.cacheTtl,
    };
  }

  /**
   * Updates the aggregation strategy.
   */
  public setAggregationStrategy(strategy: AggregationStrategy): void {
    this.aggregationStrategy = { ...this.aggregationStrategy, ...strategy };
  }
}
