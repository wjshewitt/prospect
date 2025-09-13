/**
 * @file Centralized configuration for the demographics service.
 *
 * This file contains API keys, service endpoints, and other settings
 * required by the DemographicsOrchestrator and its providers.
 * It's designed to be easily extendable for different environments (e.g., development, production).
 */

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  rateLimit: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
}

interface FallbackConfig {
  enableMockData: boolean;
  mockDataPath?: string;
}

interface DemographicsConfig {
  defaultProvider: string;
  providers: {
    [key: string]: ProviderConfig;
  };
  cache: CacheConfig;
  fallbacks: FallbackConfig;
}

export const demographicsConfig: DemographicsConfig = {
  defaultProvider: "census",
  providers: {
    census: {
      apiKey: process.env.CENSUS_API_KEY || "",
      baseUrl: "https://api.beta.ons.gov.uk/v1", // Correct ONS API base URL
      rateLimit: 10,
      timeout: 30000, // 30 seconds
      retries: 3,
      retryDelay: 1000, // 1 second base delay
    },
  },
  cache: {
    ttl: 3600000, // 1 hour
    maxSize: 1000, // Maximum 1000 cached entries
  },
  fallbacks: {
    enableMockData: false, // Never use mock data
    mockDataPath: "./mock-data",
  },
};
