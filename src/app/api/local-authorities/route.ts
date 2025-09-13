import { NextRequest, NextResponse } from "next/server";
import { LocalAuthorityCollection, LocalAuthorityFeature } from "@/lib/types";

// Cache configuration
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let cache: {
  data: LocalAuthorityCollection | null;
  timestamp: number;
  spatialIndex: any | null;
} = {
  data: null,
  timestamp: 0,
  spatialIndex: null,
};

// Local authority dataset URL
const LOCAL_AUTHORITY_URL =
  "https://firebasestorage.googleapis.com/v0/b/prospect-972b9.firebasestorage.app/o/public_maps%2Flocal-authority-district.geojson?alt=media";

/**
 * Fetch and cache local authority dataset
 */
async function fetchLocalAuthorityData(): Promise<LocalAuthorityCollection> {
  try {
    const response = await fetch(LOCAL_AUTHORITY_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch local authority data: ${response.statusText}`
      );
    }

    const data = (await response.json()) as LocalAuthorityCollection;
    return data;
  } catch (error) {
    console.error("Error fetching local authority data:", error);
    throw new Error("Failed to fetch local authority dataset");
  }
}

/**
 * Build spatial index for efficient queries
 */
function buildSpatialIndex(features: LocalAuthorityFeature[]) {
  // This will be implemented with RBush library for spatial indexing
  // For now, return a simple bounding box index
  return features.map((feature, index) => {
    const bounds = calculateBounds(feature);
    return {
      minX: bounds.west,
      minY: bounds.south,
      maxX: bounds.east,
      maxY: bounds.north,
      feature: feature,
      index: index,
    };
  });
}

/**
 * Calculate bounding box for a feature
 */
function calculateBounds(feature: LocalAuthorityFeature): {
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
  coordinates.forEach((polygon, polyIndex) => {
    polygon.forEach((ring, ringIndex) => {
      ring.forEach((coord, coordIndex) => {
        console.log(
          `Feature bounds calc - poly:${polyIndex}, ring:${ringIndex}, coord:${coordIndex}, value:`,
          coord,
          `type:`,
          typeof coord
        );
        if (!Array.isArray(coord)) {
          console.error(`Non-array coord found:`, coord);
          return; // Skip this coord
        }
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
 * Filter features by viewport bounds
 */
function filterByViewport(
  features: LocalAuthorityFeature[],
  bounds: { north: number; south: number; east: number; west: number }
): LocalAuthorityFeature[] {
  return features.filter((feature) => {
    const featureBounds = calculateBounds(feature);

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
 * GET /api/local-authorities
 * Returns local authority dataset with optional viewport filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const viewport = searchParams.get("viewport");

    // Check cache validity
    const now = Date.now();
    const isCacheValid = cache.data && now - cache.timestamp < CACHE_DURATION;

    if (!isCacheValid) {
      // Fetch fresh data
      cache.data = await fetchLocalAuthorityData();
      cache.timestamp = now;
      cache.spatialIndex = buildSpatialIndex(cache.data.features);
    }

    if (!cache.data) {
      return NextResponse.json(
        { error: "Failed to load local authority data" },
        { status: 500 }
      );
    }

    let features = cache.data.features;

    // Apply viewport filtering if requested
    if (viewport) {
      try {
        const bounds = JSON.parse(viewport);
        features = filterByViewport(features, bounds);
      } catch (error) {
        console.error("Invalid viewport parameter:", error);
      }
    }

    // Return filtered dataset
    const response: LocalAuthorityCollection = {
      type: "FeatureCollection",
      name: cache.data.name,
      features: features,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in local authorities API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/local-authorities/query
 * Query which local authority contains a given point
 */
export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    // Ensure data is loaded
    if (!cache.data || !cache.spatialIndex) {
      cache.data = await fetchLocalAuthorityData();
      cache.timestamp = Date.now();
      cache.spatialIndex = buildSpatialIndex(cache.data.features);
    }

    if (!cache.data) {
      return NextResponse.json(
        { error: "Local authority data not available" },
        { status: 500 }
      );
    }

    // Find containing local authority
    const containingAuthority = findContainingAuthority(
      lat,
      lng,
      cache.data.features
    );

    if (containingAuthority) {
      return NextResponse.json({
        found: true,
        authority: {
          name: containingAuthority.properties.name,
          reference: containingAuthority.properties.reference,
          entity: containingAuthority.properties.entity,
        },
      });
    } else {
      return NextResponse.json({
        found: false,
        authority: null,
      });
    }
  } catch (error) {
    console.error("Error in local authority query:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Find which local authority contains the given point
 * This is a simplified implementation - will be enhanced with proper spatial indexing
 */
function findContainingAuthority(
  lat: number,
  lng: number,
  features: LocalAuthorityFeature[]
): LocalAuthorityFeature | null {
  // For now, use a simple bounding box check followed by point-in-polygon
  // This will be optimized with RBush spatial indexing in the client implementation

  for (const feature of features) {
    const bounds = calculateBounds(feature);

    // Quick bounding box check
    if (
      lat >= bounds.south &&
      lat <= bounds.north &&
      lng >= bounds.west &&
      lng <= bounds.east
    ) {
      // More detailed point-in-polygon check would go here
      // For now, return the first match (will be improved with proper spatial operations)
      return feature;
    }
  }

  return null;
}

// Export cache for testing and debugging
export const __cache = cache;
