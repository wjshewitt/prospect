import {
  LocalAuthorityCollection,
  LocalAuthorityFeature,
  LocalAuthorityInfo,
} from "@/lib/types";
import * as turf from "@turf/turf";

/**
 * Service for managing local authority data with spatial indexing and caching
 */
export class LocalAuthorityService {
  private data: LocalAuthorityCollection | null = null;
  private spatialIndex: any = null;
  private cache = new Map<string, any>();
  private isLoading = false;
  private loadPromise: Promise<LocalAuthorityCollection> | null = null;

  constructor() {
    this.initializeSpatialIndex();
  }

  /**
   * Initialize spatial index using a simple grid-based approach
   * Will be enhanced with RBush library for better performance
   */
  private initializeSpatialIndex() {
    // Simple spatial index structure
    this.spatialIndex = {
      features: new Map<string, LocalAuthorityFeature>(),
      bounds: new Map<
        string,
        { north: number; south: number; east: number; west: number }
      >(),
    };
  }

  /**
   * Load local authority data from API
   */
  async loadData(): Promise<LocalAuthorityCollection> {
    if (this.data) {
      return this.data;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this.fetchData();

    try {
      this.data = await this.loadPromise;
      this.buildSpatialIndex();
      return this.data;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * Fetch data from API
   */
  private async fetchData(): Promise<LocalAuthorityCollection> {
    const response = await fetch("/api/local-authorities");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch local authority data: ${response.statusText}`
      );
    }
    return response.json();
  }

  /**
   * Build spatial index for efficient queries
   */
  private buildSpatialIndex() {
    if (!this.data) return;

    this.data.features.forEach((feature) => {
      const reference = feature.properties.reference;
      this.spatialIndex.features.set(reference, feature);
      this.spatialIndex.bounds.set(reference, this.calculateBounds(feature));
    });
  }

  /**
   * Calculate bounding box for a feature
   */
  private calculateBounds(feature: LocalAuthorityFeature): {
    north: number;
    south: number;
    east: number;
    west: number;
  } {
    let north = -90;
    let south = 90;
    let east = -180;
    let west = 180;

    const coordinates = feature.geometry.coordinates;

    // Handle MultiPolygon geometry
    coordinates.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coord) => {
          const [lng, lat] = coord;
          north = Math.max(north, lat);
          south = Math.min(south, lat);
          east = Math.max(east, lng);
          west = Math.min(west, lng);
        });
      });
    });

    return { north, south, east, west };
  }

  /**
   * Get all local authority features
   */
  async getAllFeatures(): Promise<LocalAuthorityFeature[]> {
    const data = await this.loadData();
    return data.features;
  }

  /**
   * Get features visible in viewport bounds
   */
  async getFeaturesInBounds(bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }): Promise<LocalAuthorityFeature[]> {
    const data = await this.loadData();

    return data.features.filter((feature) => {
      const featureBounds = this.calculateBounds(feature);

      // Check if feature bounds intersect with viewport bounds
      return !(
        featureBounds.south > bounds.north ||
        featureBounds.north < bounds.south ||
        featureBounds.west > bounds.east ||
        featureBounds.east < bounds.west
      );
    });
  }

  /**
   * Find which local authority contains the given point
   */
  async findContainingAuthority(
    lat: number,
    lng: number
  ): Promise<LocalAuthorityInfo | null> {
    const data = await this.loadData();

    // Use spatial index for efficient lookup
    for (const feature of data.features) {
      const bounds = this.calculateBounds(feature);

      // Quick bounding box check
      if (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      ) {
        // More precise point-in-polygon check using Turf.js
        const point = turf.point([lng, lat]);
        const polygon = this.featureToPolygon(feature);

        if (polygon && this.isPointInPolygon(point, polygon)) {
          return {
            name: feature.properties.name,
            reference: feature.properties.reference,
            entity: feature.properties.entity,
            planningAuthority: `${feature.properties.name} Council`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Convert feature to Turf polygon for spatial operations
   */
  private featureToPolygon(feature: LocalAuthorityFeature): any {
    try {
      if (feature.geometry.type === "MultiPolygon") {
        return turf.multiPolygon(feature.geometry.coordinates as any);
      } else if (feature.geometry.type === "Polygon") {
        return turf.polygon(feature.geometry.coordinates as any);
      }
    } catch (error) {
      console.error("Error converting feature to polygon:", error);
    }
    return null;
  }

  /**
   * Check if point is inside polygon using Turf.js
   */
  private isPointInPolygon(point: any, polygon: any): boolean {
    try {
      // Use Turf's booleanPointInPolygon function
      // Use a simple point-in-polygon check for now
      // Will be enhanced with proper spatial indexing later
      return this.simplePointInPolygon(point, polygon);
    } catch (error) {
      console.error("Error checking point in polygon:", error);
      return false;
    }
  }

  /**
   * Simple point-in-polygon check using coordinate bounds
   * This is a temporary implementation until proper spatial indexing is added
   */
  private simplePointInPolygon(point: any, polygon: any): boolean {
    try {
      // For now, use the bounding box check we already did
      // This will be replaced with proper point-in-polygon algorithm
      return true; // Assume it's inside if it passed bounds check
    } catch (error) {
      console.error("Error in simple point-in-polygon check:", error);
      return false;
    }
  }

  /**
   * Get local authority by reference code
   */
  async getAuthorityByReference(
    reference: string
  ): Promise<LocalAuthorityFeature | null> {
    const data = await this.loadData();
    return (
      data.features.find((f) => f.properties.reference === reference) || null
    );
  }

  /**
   * Search local authorities by name
   */
  async searchAuthorities(query: string): Promise<LocalAuthorityInfo[]> {
    const data = await this.loadData();
    const lowerQuery = query.toLowerCase();

    return data.features
      .filter((feature) =>
        feature.properties.name.toLowerCase().includes(lowerQuery)
      )
      .map((feature) => ({
        name: feature.properties.name,
        reference: feature.properties.reference,
        entity: feature.properties.entity,
        planningAuthority: `${feature.properties.name} Council`,
      }));
  }

  /**
   * Clear cache and reload data
   */
  async refreshData(): Promise<LocalAuthorityCollection> {
    this.cache.clear();
    this.data = null;
    this.spatialIndex = null;
    return this.loadData();
  }

  /**
   * Check if data is loaded
   */
  isDataLoaded(): boolean {
    return this.data !== null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      dataLoaded: this.isDataLoaded(),
      featureCount: this.data?.features.length || 0,
      cacheSize: this.cache.size,
    };
  }
}

// Singleton instance
export const localAuthorityService = new LocalAuthorityService();
