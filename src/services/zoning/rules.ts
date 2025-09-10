import type { LatLng } from "@/lib/types";
import type {
  PolygonRing,
  ZoneGeometry,
  ValidationResult,
} from "../geometry/polygon";
import {
  normalizeRing,
  containsPolygon,
  validateZoneGeometry,
} from "../geometry/polygon";

/**
 * Zone kind definitions with their validation rules
 */
export type ZoneKind =
  | "residential"
  | "commercial"
  | "green_space"
  | "amenity"
  | "solar";

export interface ZoneKindConfig {
  name: string;
  minAreaMeters2: number;
  maxAreaMeters2?: number;
  description: string;
}

export const ZONE_KIND_CONFIGS: Record<ZoneKind, ZoneKindConfig> = {
  residential: {
    name: "Residential",
    minAreaMeters2: 100, // ~0.025 acres
    description: "Housing and residential development",
  },
  commercial: {
    name: "Commercial",
    minAreaMeters2: 200, // ~0.05 acres
    description: "Business and commercial development",
  },
  green_space: {
    name: "Green Space",
    minAreaMeters2: 500, // ~0.12 acres
    description: "Parks, recreation, and natural areas",
  },
  amenity: {
    name: "Amenity",
    minAreaMeters2: 100, // ~0.025 acres
    description: "Community facilities and public services",
  },
  solar: {
    name: "Solar",
    minAreaMeters2: 1000, // ~0.25 acres
    description: "Solar panel installations",
  },
};

/**
 * Result of zone validation with zoning-specific rules
 */
export interface ZoneValidationResult extends ValidationResult {
  zoneKind?: ZoneKind;
  suggestions?: string[];
}

/**
 * Validate that a zone is within the project boundary
 */
export function validateZoneBoundary(
  zoneRing: PolygonRing,
  boundaryRing: PolygonRing
): { isValid: boolean; reason?: string } {
  if (!containsPolygon(boundaryRing, zoneRing)) {
    return {
      isValid: false,
      reason: "Zone must be completely within the project boundary",
    };
  }
  return { isValid: true };
}

/**
 * Validate zone against other existing zones (no overlaps, minimum separation, etc.)
 */
export function validateZoneConflicts(
  zoneRing: PolygonRing,
  existingZones: Array<{ ring: PolygonRing; kind: ZoneKind }>,
  minSeparationMeters: number = 10
): { isValid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  for (const existing of existingZones) {
    // Check for overlaps (simplified - using centroids for basic check)
    if (
      containsPolygon(existing.ring, zoneRing) ||
      containsPolygon(zoneRing, existing.ring)
    ) {
      conflicts.push(`Zone overlaps with existing ${existing.kind} zone`);
    }

    // TODO: Add minimum separation check when we have proper distance calculations
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Validate a complete zone including geometry, boundary, and zoning rules
 */
export function validateZone(
  zoneGeometry: ZoneGeometry,
  zoneKind: ZoneKind,
  boundaryRing: PolygonRing,
  existingZones: Array<{ ring: PolygonRing; kind: ZoneKind }> = [],
  options: {
    allowHoles?: boolean;
    minSeparationMeters?: number;
  } = {}
): ZoneValidationResult {
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // Basic geometry validation
  const geomValidation = validateZoneGeometry(zoneGeometry, {
    minAreaMeters2: ZONE_KIND_CONFIGS[zoneKind].minAreaMeters2,
    maxAreaMeters2: ZONE_KIND_CONFIGS[zoneKind].maxAreaMeters2,
    requireSimple: true,
  });

  if (!geomValidation.isValid) {
    reasons.push(...geomValidation.reasons);
  }

  // Boundary validation
  const boundaryValidation = validateZoneBoundary(
    zoneGeometry.outer,
    boundaryRing
  );
  if (!boundaryValidation.isValid) {
    reasons.push(boundaryValidation.reason!);
  }

  // Zone conflict validation
  const conflictValidation = validateZoneConflicts(
    zoneGeometry.outer,
    existingZones,
    options.minSeparationMeters
  );
  if (!conflictValidation.isValid) {
    reasons.push(...conflictValidation.conflicts);
  }

  // Hole validation
  if (
    !options.allowHoles &&
    zoneGeometry.holes &&
    zoneGeometry.holes.length > 0
  ) {
    reasons.push("Holes are not allowed in zones");
  }

  // Generate suggestions based on validation failures
  if (reasons.length > 0) {
    if (reasons.some((r) => r.includes("area"))) {
      suggestions.push(
        `Try drawing a larger area for ${ZONE_KIND_CONFIGS[
          zoneKind
        ].name.toLowerCase()} zones`
      );
    }
    if (reasons.some((r) => r.includes("boundary"))) {
      suggestions.push("Ensure the entire zone is within the project boundary");
    }
    if (reasons.some((r) => r.includes("self-intersections"))) {
      suggestions.push("Try drawing a simpler shape without crossing lines");
    }
    if (reasons.some((r) => r.includes("overlaps"))) {
      suggestions.push("Avoid overlapping with existing zones");
    }
  }

  return {
    isValid: reasons.length === 0,
    reasons,
    zoneKind,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    repairedGeometry: geomValidation.repairedGeometry,
  };
}

/**
 * Get recommended zone kinds based on area and context
 */
export function suggestZoneKinds(
  areaMeters2: number,
  context?: {
    nearbyZones?: ZoneKind[];
    siteCharacteristics?: string[];
  }
): ZoneKind[] {
  const suggestions: ZoneKind[] = [];

  // Basic area-based suggestions
  if (areaMeters2 >= 1000) {
    suggestions.push("solar", "green_space");
  }
  if (areaMeters2 >= 500) {
    suggestions.push("commercial", "green_space");
  }
  if (areaMeters2 >= 200) {
    suggestions.push("residential", "commercial", "amenity");
  }
  if (areaMeters2 >= 100) {
    suggestions.push("residential", "amenity");
  }

  // Context-based adjustments
  if (context?.nearbyZones) {
    // Prefer complementary zone types
    const nearby = context.nearbyZones;
    if (nearby.includes("residential") && !suggestions.includes("amenity")) {
      suggestions.push("amenity");
    }
    if (nearby.includes("commercial") && !suggestions.includes("residential")) {
      suggestions.push("residential");
    }
  }

  // Remove duplicates and sort by relevance
  return [...new Set(suggestions)].sort((a, b) => {
    // Sort by minimum area requirement (smaller areas first)
    return (
      ZONE_KIND_CONFIGS[a].minAreaMeters2 - ZONE_KIND_CONFIGS[b].minAreaMeters2
    );
  });
}

/**
 * Calculate zone statistics for reporting
 */
export function calculateZoneStats(
  zoneGeometry: ZoneGeometry,
  zoneKind: ZoneKind
): {
  areaMeters2: number;
  areaAcres: number;
  perimeterMeters: number;
  zoneKind: ZoneKind;
  config: ZoneKindConfig;
} {
  const areaMeters2 =
    zoneGeometry.outer.reduce((sum, point, i, arr) => {
      const next = arr[(i + 1) % arr.length];
      return sum + (point.lng * next.lat - next.lng * point.lat);
    }, 0) / 2;

  // Calculate perimeter (simplified)
  let perimeterMeters = 0;
  for (let i = 0; i < zoneGeometry.outer.length - 1; i++) {
    const p1 = zoneGeometry.outer[i];
    const p2 = zoneGeometry.outer[i + 1];
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    perimeterMeters += 6371000 * c; // Earth radius in meters
  }

  return {
    areaMeters2: Math.abs(areaMeters2),
    areaAcres: Math.abs(areaMeters2) / 4046.86,
    perimeterMeters,
    zoneKind,
    config: ZONE_KIND_CONFIGS[zoneKind],
  };
}

/**
 * Validate if a building can be placed in the given zones based on type compatibility
 */
export interface BuildingPlacementValidation {
  isValid: boolean;
  reasons: string[];
  compatibleZone?: ZoneKind;
}

export function validateBuildingPlacement(
  buildingFootprint: PolygonRing,
  buildingType: string,
  zones: Array<{ ring: PolygonRing; kind: ZoneKind }>
): BuildingPlacementValidation {
  const reasons: string[] = [];
  let compatibleZone: ZoneKind | undefined;

  // Find which zone the building is in
  for (const zone of zones) {
    if (containsPolygon(zone.ring, buildingFootprint)) {
      // Check compatibility based on type
      const compatibleTypes: Record<string, ZoneKind[]> = {
        residential: ["residential"],
        commercial: ["commercial"],
        house_detached: ["residential"],
        flat_block: ["residential", "commercial"],
        office: ["commercial"],
        // Default or unknown
        default: ["residential", "commercial", "amenity"],
      };

      const requiredZones =
        compatibleTypes[buildingType] || compatibleTypes.default;
      if (requiredZones.includes(zone.kind)) {
        compatibleZone = zone.kind;
        return { isValid: true, reasons: [], compatibleZone };
      } else {
        reasons.push(
          `Building type '${buildingType}' is not compatible with ${
            zone.kind
          } zone. Expected one of: ${requiredZones.join(", ")}`
        );
      }
    }
  }

  // If not in any zone, invalid
  if (reasons.length === 0) {
    reasons.push("Building must be placed within a zoned area.");
  }

  return { isValid: false, reasons, compatibleZone };
}
