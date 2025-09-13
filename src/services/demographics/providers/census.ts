import { demographicsConfig } from "@/config/demographics";
import {
  DemographicData,
  DemographicMetadata,
  DemographicProvider,
  AgeDistribution,
} from "./base";

// Custom error classes for better error handling
export class CensusAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = "CensusAPIError";
  }
}

export class GeographyResolutionError extends CensusAPIError {
  constructor(coordinates: { lat: number; lng: number }) {
    super(
      `Could not resolve geography for coordinates: ${coordinates.lat}, ${coordinates.lng}`,
      undefined,
      false
    );
    this.name = "GeographyResolutionError";
  }
}

/**
 * Provides demographic data from the UK Census 2021 API.
 * Uses the official ONS Census 2021 API with real data retrieval.
 */
export class CensusProvider implements DemographicProvider {
  private readonly censusApiBaseUrl: string;
  private readonly censusApiKey: string;

  constructor() {
    this.censusApiBaseUrl = demographicsConfig.providers.census.baseUrl;
    this.censusApiKey = demographicsConfig.providers.census.apiKey;
  }

  /**
   * Fetches demographic data from the UK Census 2021 API.
   *
   * @param area - A GeoJSON Feature or FeatureCollection.
   * @returns A promise that resolves to the demographic data.
   */
  public async fetchData(
    area: GeoJSON.Feature | GeoJSON.FeatureCollection
  ): Promise<{ data: DemographicData; metadata: DemographicMetadata } | null> {
    console.log("Fetching data from Census API for area:", area);

    // Handle FeatureCollection - use first feature
    let feature: GeoJSON.Feature;
    if (area.type === "FeatureCollection") {
      if (!area.features || area.features.length === 0) {
        throw new CensusAPIError(
          "Invalid GeoJSON: FeatureCollection has no features",
          undefined,
          false
        );
      }
      feature = area.features[0];
    } else {
      feature = area;
    }

    if (!feature.geometry) {
      throw new CensusAPIError(
        "Invalid GeoJSON: missing geometry",
        undefined,
        false
      );
    }

    // Handle different geometry types - we need Point geometry
    if (feature.geometry.type !== "Point") {
      throw new CensusAPIError(
        "Invalid GeoJSON: geometry must be Point type",
        undefined,
        false
      );
    }

    const pointGeometry = feature.geometry as GeoJSON.Point;
    const coordinates = pointGeometry.coordinates;

    try {
      // Retry logic for geography resolution
      const geographyCode = await this.withRetry(
        () => this.getGeographyCode(coordinates[1], coordinates[0]),
        3,
        1000
      );

      if (!geographyCode) {
        throw new GeographyResolutionError({
          lat: coordinates[1],
          lng: coordinates[0],
        });
      }

      // Find a suitable Census 2021 dataset with retry
      const datasetIdResult = await this.withRetry(
        () => this.findCensusDataset(),
        3,
        2000
      );

      if (Array.isArray(datasetIdResult)) {
        // This should not happen in the normal flow, but handle it gracefully
        throw new CensusAPIError(
          "Debugging mode returned all datasets, cannot proceed with data fetching",
          undefined,
          false
        );
      }
      const datasetId = datasetIdResult;

      if (!datasetId) {
        throw new CensusAPIError(
          "No suitable Census 2021 dataset found",
          undefined,
          false
        );
      }

      // Get the latest version for the dataset
      const versionInfo = await this.withRetry(
        () => this.getLatestVersion(datasetId),
        3,
        2000
      );

      if (!versionInfo) {
        throw new CensusAPIError(
          "Could not retrieve dataset version information",
          undefined,
          true
        );
      }

      // Create a filter for the required data
      const filterId = await this.withRetry(
        () =>
          this.createFilter(
            datasetId,
            versionInfo.edition,
            versionInfo.version,
            geographyCode
          ),
        3,
        2000
      );

      if (!filterId) {
        throw new CensusAPIError(
          "Failed to create data filter",
          undefined,
          true
        );
      }

      // Submit the filter job
      const jobSubmitted = await this.withRetry(
        () => this.submitFilterJob(filterId),
        3,
        2000
      );

      if (!jobSubmitted) {
        throw new CensusAPIError(
          "Failed to submit filter job",
          undefined,
          true
        );
      }

      // Wait for the job to complete and get download URL
      const downloadUrl = await this.waitForJobCompletion(filterId);
      if (!downloadUrl) {
        throw new CensusAPIError(
          "Failed to get download URL for filtered data",
          undefined,
          true
        );
      }

      // Download and parse the data
      const rawData = await this.downloadAndParseData(downloadUrl);
      const transformedData = this.transformData(rawData);

      const metadata: DemographicMetadata = {
        source: "UK Census 2021",
        retrievedAt: new Date(),
        confidence: this.calculateConfidence(transformedData),
        coverage: 100, // Assuming full coverage for now
      };

      return { data: transformedData, metadata };
    } catch (error) {
      if (error instanceof CensusAPIError) {
        throw error;
      }
      console.error("Error fetching data from Census API:", error);
      throw new CensusAPIError(
        "An unexpected error occurred while fetching demographic data from Census API",
        undefined,
        true
      );
    }
  }

  // Retry utility function
  private async withRetry<T>(
    operation: () => Promise<T | null>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (result !== null && result !== undefined) {
          return result;
        }
        if (attempt === maxRetries) {
          return null;
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`Attempt ${attempt} failed, retrying...`);
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return null;
  }

  // Calculate confidence score based on data completeness
  private calculateConfidence(data: DemographicData): number {
    let confidence = 1.0;

    if (!data.population || data.population === 0) confidence *= 0.8;
    if (!data.households || data.households === 0) confidence *= 0.9;
    if (!data.medianAge || data.medianAge === 0) confidence *= 0.9;
    if (!data.employmentRate || data.employmentRate === 0) confidence *= 0.9;
    if (!data.ageDistribution || Object.keys(data.ageDistribution).length === 0)
      confidence *= 0.8;

    return Math.round(confidence * 100) / 100;
  }

  private async findCensusDataset(
    returnAll = false
  ): Promise<string[] | string | null> {
    try {
      const url = `${this.censusApiBaseUrl}/datasets?limit=50`;
      console.log(`Fetching datasets from: ${url}`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.censusApiKey}`,
        },
      });
      if (!response.ok) {
        console.error(
          `Dataset fetch failed with status: ${response.status} ${response.statusText}`
        );
        console.error(
          `Response headers:`,
          Object.fromEntries(response.headers.entries())
        );

        // Try to get error details from response
        let errorDetails = "";
        try {
          const errorData = await response.text();
          errorDetails = errorData.substring(0, 200); // First 200 chars
        } catch (e) {
          errorDetails = "Could not parse error response";
        }

        throw new CensusAPIError(
          `Failed to fetch datasets: ${response.status} ${response.statusText}. Details: ${errorDetails}`,
          response.status,
          response.status >= 500 // Retry on server errors
        );
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} datasets`);

      if (returnAll) {
        return data.items?.map((d: any) => d.title) || [];
      }

      // Look for a dataset that includes demographic data
      const suitableDataset = data.items?.find((dataset: any) =>
        dataset.title
          ?.toLowerCase()
          .includes(
            "house price statistics for small areas in england and wales"
          )
      );

      if (!suitableDataset) {
        console.warn(
          "No suitable Census 2021 dataset found in available datasets"
        );
        // Log all available dataset titles for debugging
        console.log(
          "All available dataset titles:",
          data.items?.map((d: any) => d.title)
        );
      }

      return suitableDataset ? suitableDataset.id : null;
    } catch (error) {
      if (error instanceof CensusAPIError) {
        throw error;
      }
      console.error("Error finding Census dataset:", error);
      throw new CensusAPIError(
        "Failed to find suitable Census dataset",
        undefined,
        true
      );
    }
  }

  private async getLatestVersion(
    datasetId: string
  ): Promise<{ edition: string; version: number } | null> {
    try {
      const response = await fetch(
        `${this.censusApiBaseUrl}/datasets/${datasetId}`,
        {
          headers: {
            Authorization: `Bearer ${this.censusApiKey}`,
          },
        }
      );
      if (!response.ok) {
        throw new CensusAPIError(
          `Failed to fetch dataset details: ${response.statusText}`,
          response.status,
          true
        );
      }
      const data = await response.json();
      const latestEdition = data.editions[data.editions.length - 1];
      const latestVersion =
        latestEdition.versions[latestEdition.versions.length - 1];
      return { edition: latestEdition.edition, version: latestVersion.version };
    } catch (error) {
      if (error instanceof CensusAPIError) {
        throw error;
      }
      console.error("Error getting latest version:", error);
      throw new CensusAPIError(
        "Failed to get dataset version information",
        undefined,
        true
      );
    }
  }

  private async createFilter(
    datasetId: string,
    edition: string,
    version: number,
    geographyCode: string
  ): Promise<string | null> {
    try {
      const filterBody = {
        dataset: {
          id: datasetId,
          edition: edition,
          version: version,
        },
        dimensions: [
          {
            name: "geography",
            options: [geographyCode],
          },
          {
            name: "sex",
            options: ["total"],
          },
          {
            name: "age",
            options: ["0-17", "18-34", "35-64", "65+"],
          },
        ],
      };

      const response = await fetch(`${this.censusApiBaseUrl}/filters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.censusApiKey}`,
        },
        body: JSON.stringify(filterBody),
      });

      if (!response.ok) {
        throw new CensusAPIError(
          `Failed to create filter: ${response.statusText}`,
          response.status,
          true
        );
      }
      const data = await response.json();
      return data.id;
    } catch (error) {
      if (error instanceof CensusAPIError) {
        throw error;
      }
      console.error("Error creating filter:", error);
      throw new CensusAPIError("Failed to create data filter", undefined, true);
    }
  }

  private async submitFilterJob(filterId: string): Promise<boolean> {
    try {
      const jobBody = {
        downloads: {
          csv: {
            href: "",
          },
        },
      };

      const response = await fetch(
        `${this.censusApiBaseUrl}/filter-outputs/${filterId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.censusApiKey}`,
          },
          body: JSON.stringify(jobBody),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Error submitting filter job:", error);
      return false;
    }
  }

  private async waitForJobCompletion(filterId: string): Promise<string | null> {
    const maxRetries = 30; // Wait up to 5 minutes (30 * 10 seconds)
    const retryDelay = 10000; // 10 seconds

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(
          `${this.censusApiBaseUrl}/filter-outputs/${filterId}`,
          {
            headers: {
              Authorization: `Bearer ${this.censusApiKey}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to check job status: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.state === "completed") {
          return data.downloads.csv.href;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } catch (error) {
        console.error("Error checking job status:", error);
        return null;
      }
    }
    return null;
  }

  private async downloadAndParseData(downloadUrl: string): Promise<any> {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new CensusAPIError(
          `Failed to download data: ${response.statusText}`,
          response.status,
          true
        );
      }
      const csvText = await response.text();

      // Parse CSV with better error handling
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        throw new CensusAPIError(
          "CSV data is empty or malformed",
          undefined,
          false
        );
      }

      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));
      const data: any = {};

      // Use the first data row (skip header)
      const values = lines[1].split(",").map((v) => v.trim().replace(/"/g, ""));
      if (values.length !== headers.length) {
        console.warn(
          "Header and data column count mismatch, attempting flexible parsing"
        );
      }

      for (let j = 0; j < Math.min(headers.length, values.length); j++) {
        const header = headers[j];
        const value = values[j];
        // Try to parse numeric values
        if (!isNaN(Number(value)) && value !== "") {
          data[header] = Number(value);
        } else {
          data[header] = value;
        }
      }

      return data;
    } catch (error) {
      if (error instanceof CensusAPIError) {
        throw error;
      }
      console.error("Error downloading and parsing data:", error);
      throw new CensusAPIError("Failed to parse CSV data", undefined, false);
    }
  }

  private transformData(rawData: any): DemographicData {
    // Transform the raw API data into DemographicData structure
    // This is a simplified transformation - in practice, you'd map the API fields to the required structure
    return {
      population: parseInt(rawData.population || "0", 10),
      households: parseInt(rawData.households || "0", 10),
      medianAge: parseFloat(rawData.median_age || "0"),
      employmentRate: parseFloat(rawData.employment_rate || "0"),
      ageDistribution: {
        "0-17": parseInt(rawData.age_0_17 || "0", 10),
        "18-34": parseInt(rawData.age_18_34 || "0", 10),
        "35-64": parseInt(rawData.age_35_64 || "0", 10),
        "65+": parseInt(rawData.age_65_plus || "0", 10),
      },
    };
  }

  private async getGeographyCode(
    lat: number,
    lng: number
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}`
      );
      if (!response.ok) {
        console.error(`Postcodes.io API error: ${response.statusText}`);
        return null;
      }
      const data = await response.json();
      if (data.result && data.result.length > 0) {
        return data.result[0].lsoa; // Use LSOA as the geography code
      }
      return null;
    } catch (error) {
      console.error("Error fetching geography code from postcodes.io:", error);
      return null;
    }
  }
}
