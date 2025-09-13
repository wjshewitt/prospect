import * as turf from "@turf/turf";
import type { LatLng } from "@/lib/types";

// Type declaration for module with export issues
const booleanPointInPolygon: any = require("@turf/boolean-point-in-polygon");

/**
 * A closed polygon ring (first point equals last point)
 */
export type PolygonRing = LatLng[];

/**
 * Geometry for a zone with optional holes
 */
export type ZoneGeometry = {
  outer: PolygonRing;
  holes?: PolygonRing[];
};

/**
 * Result of geometry validation
 */
export type ValidationResult = {
  isValid: boolean;
  reasons: string[];
  repairedGeometry?: ZoneGeometry;
};

/**
 * Normalize a path into a closed polygon ring
 * - Ensures first point equals last point
 * - Removes duplicate consecutive points
 * - Filters out invalid coordinates
 */
export function normalizeRing(path: LatLng[]): PolygonRing {
  if (path.length === 0) {
    throw new Error("Cannot normalize empty path");
  }

  // Filter out invalid coordinates
  const validPoints = path.filter(
    (p) =>
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      !isNaN(p.lat) &&
      !isNaN(p.lng) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lng >= -180 &&
      p.lng <= 180
  );

  if (validPoints.length < 3) {
    throw new Error("Path must have at least 3 valid points");
  }

  // Remove duplicate consecutive points
  const deduped = validPoints.filter((point, index) => {
    if (index === 0) return true;
    const prev = validPoints[index - 1];
    return !(point.lat === prev.lat && point.lng === prev.lng);
  });

  if (deduped.length < 3) {
    throw new Error("Path must have at least 3 non-duplicate points");
  }

  // Close the ring if not already closed
  const first = deduped[0];
  const last = deduped[deduped.length - 1];

  if (first.lat !== last.lat || first.lng !== last.lng) {
    deduped.push({ ...first }); // Clone to avoid reference issues
  }

  return deduped;
}

/**
 * Check if a polygon ring is a valid simple polygon (no self-intersections)
 */
export function isValidSimplePolygon(ring: PolygonRing): boolean {
  try {
    const coords = ring.map((p) => [p.lng, p.lat]);
    // Remove closing point for turf
    if (
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      coords.pop();
    }

    const poly = turf.polygon([coords]);
    const kinks = turf.kinks(poly);

    return kinks.features.length === 0;
  } catch (error) {
    console.warn("Error validating polygon:", error);
    return false;
  }
}

/**
 * Attempt to repair self-intersecting polygons using turf.unkink
 * Returns the repaired geometry or null if repair fails
 */
export function repairSelfIntersections(
  ring: PolygonRing
): ZoneGeometry | null {
  try {
    const coords = ring.map((p) => [p.lng, p.lat]);
    // Remove closing point for turf
    if (
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      coords.pop();
    }

    const poly = turf.polygon([coords]);
    // Note: unkink might not be available in this version of Turf
    // For now, return null to indicate repair is not possible
    console.warn(
      "Self-intersection repair not implemented - unkink function not available"
    );
    return null;
  } catch (error) {
    console.warn("Error repairing polygon:", error);
    return null;
  }
}

/**
 * Check if one polygon completely contains another
 */
export function containsPolygon(
  outer: PolygonRing,
  inner: PolygonRing
): boolean {
  try {
    const outerCoords = outer.map((p) => [p.lng, p.lat]);
    const innerCoords = inner.map((p) => [p.lng, p.lat]);

    // Remove closing points for turf
    if (
      outerCoords.length > 1 &&
      outerCoords[0][0] === outerCoords[outerCoords.length - 1][0] &&
      outerCoords[0][1] === outerCoords[outerCoords.length - 1][1]
    ) {
      outerCoords.pop();
    }
    if (
      innerCoords.length > 1 &&
      innerCoords[0][0] === innerCoords[innerCoords.length - 1][0] &&
      innerCoords[0][1] === innerCoords[innerCoords.length - 1][1]
    ) {
      innerCoords.pop();
    }

    const outerPoly = turf.polygon([outerCoords]);
    const innerPoly = turf.polygon([innerCoords]);

    // Simplified containment check using point-in-polygon
    // This is a basic implementation - could be improved with proper Turf functions
    const centroid = turf.centroid(innerPoly);
    const point = turf.point(centroid.geometry.coordinates);

    try {
      return booleanPointInPolygon(point, outerPoly);
    } catch {
      // Fallback: check if centroid of inner is inside outer bounds
      const innerBounds = turf.bbox(innerPoly);
      const outerBounds = turf.bbox(outerPoly);
      return (
        innerBounds[0] >= outerBounds[0] &&
        innerBounds[1] >= outerBounds[1] &&
        innerBounds[2] <= outerBounds[2] &&
        innerBounds[3] <= outerBounds[3]
      );
    }
  } catch (error) {
    console.warn("Error checking polygon containment:", error);
    return false;
  }
}

/**
 * Compute the area of a polygon ring in square meters
 */
export function computeArea(ring: PolygonRing): number {
  try {
    const coords = ring.map((p) => [p.lng, p.lat]);
    // Remove closing point for turf
    if (
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      coords.pop();
    }

    const poly = turf.polygon([coords]);
    return turf.area(poly); // Returns square meters
  } catch (error) {
    console.warn("Error computing polygon area:", error);
    return 0;
  }
}

/**
 * Compute the area of a zone geometry (with holes) in square meters
 */
export function computeZoneArea(geometry: ZoneGeometry): number {
  const outerArea = computeArea(geometry.outer);
  const holeArea =
    geometry.holes?.reduce((sum, hole) => sum + computeArea(hole), 0) || 0;
  return Math.max(0, outerArea - holeArea);
}

/**
 * Simplify a polygon path using Douglas-Peucker algorithm
 * @param path The input path
 * @param toleranceMeters Tolerance in meters for simplification
 */
export function simplifyPath(
  path: LatLng[],
  toleranceMeters: number
): LatLng[] {
  if (path.length <= 3 || toleranceMeters <= 0) {
    return path;
  }

  try {
    const coords = path.map((p) => [p.lng, p.lat]);
    const line = turf.lineString(coords);
    const simplified = turf.simplify(line, toleranceMeters / 100000, false);

    if (simplified.type === 'Feature' && simplified.geometry.type === 'LineString') {
      return simplified.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
    }
    return path;
  } catch (error) {
    console.warn("Error simplifying path:", error);
    return path;
  }
}

/**
 * Calculate the centroid of a polygon
 */
export function computeCentroid(ring: PolygonRing): LatLng {
  try {
    const coords = ring.map((p) => [p.lng, p.lat]);
    // Remove closing point for turf
    if (
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
    ) {
      coords.pop();
    }

    const poly = turf.polygon([coords]);
    const centroid = turf.centroid(poly);

    return {
      lat: centroid.geometry.coordinates[1],
      lng: centroid.geometry.coordinates[0],
    };
  } catch (error) {
    console.warn("Error computing centroid:", error);
    // Fallback to average of points
    const sum = ring.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: sum.lat / ring.length,
      lng: sum.lng / ring.length,
    };
  }
}

/**
 * Validate a zone geometry against business rules
 */
export function validateZoneGeometry(
  geometry: ZoneGeometry,
  options: {
    minVertices?: number;
    minAreaMeters2?: number;
    maxAreaMeters2?: number;
    requireSimple?: boolean;
  } = {}
): ValidationResult {
  const reasons: string[] = [];
  const {
    minVertices = 3,
    minAreaMeters2 = 1,
    maxAreaMeters2,
    requireSimple = true,
  } = options;

  // Check minimum vertices
  if (geometry.outer.length < minVertices + 1) {
    // +1 for closing point
    reasons.push(`Zone must have at least ${minVertices} vertices`);
  }

  // Check area constraints
  const area = computeZoneArea(geometry);
  if (area < minAreaMeters2) {
    reasons.push(
      `Zone area must be at least ${minAreaMeters2} m² (${(
        minAreaMeters2 / 4046.86
      ).toFixed(3)} acres)`
    );
  }
  if (maxAreaMeters2 && area > maxAreaMeters2) {
    reasons.push(
      `Zone area cannot exceed ${maxAreaMeters2} m² (${(
        maxAreaMeters2 / 4046.86
      ).toFixed(3)} acres)`
    );
  }

  // Check for self-intersections if required
  if (requireSimple && !isValidSimplePolygon(geometry.outer)) {
    reasons.push("Zone cannot have self-intersections");

    // Try to repair
    const repaired = repairSelfIntersections(geometry.outer);
    if (repaired) {
      return {
        isValid: false,
        reasons,
        repairedGeometry: repaired,
      };
    }
  }

  // Check holes for validity
  if (geometry.holes) {
    for (let i = 0; i < geometry.holes.length; i++) {
      const hole = geometry.holes[i];
      if (hole.length < minVertices + 1) {
        reasons.push(
          `Hole ${i + 1} must have at least ${minVertices} vertices`
        );
      }
      if (requireSimple && !isValidSimplePolygon(hole)) {
        reasons.push(`Hole ${i + 1} cannot have self-intersections`);
      }
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}
