import { Vector3 } from "three";

export interface CoordinatePrecision {
  coordinate: number; // decimal places for lat/lng
  elevation: number; // decimal places for elevation
  measurement: number; // decimal places for measurements
}

export type VisualizationTier = "maplibre" | "babylon" | "three";

export interface CoordinateSystem {
  // Primary coordinate reference system
  readonly crs: "EPSG:4326" | "EPSG:3857";
  readonly precision: CoordinatePrecision;

  // Core transformation methods
  lngLatToWorld(lngLat: [number, number], elevation?: number): Vector3;
  worldToLngLat(position: Vector3): [number, number, number];
  screenToWorld(screen: [number, number], tier: VisualizationTier): Vector3;
  worldToScreen(world: Vector3, tier: VisualizationTier): [number, number];

  // Validation and normalization
  validateCoordinate(coord: [number, number]): boolean;
  normalizeCoordinate(coord: [number, number]): [number, number];

  // Precision handling
  roundToPrecision(
    value: number,
    type: "coordinate" | "elevation" | "measurement"
  ): number;
}

const WORLD_SIZE = 1000000; // 1M units for world space

export class UnifiedCoordinateSystem implements CoordinateSystem {
  readonly crs = "EPSG:4326" as const;
  readonly precision: CoordinatePrecision = {
    coordinate: 8,
    elevation: 2,
    measurement: 3,
  };

  lngLatToWorld(lngLat: [number, number], elevation = 0): Vector3 {
    // Convert WGS84 to world coordinates
    const [lng, lat] = this.normalizeCoordinate(lngLat);

    // Use Web Mercator projection for world coordinates
    const x = (lng + 180) / 360;
    const y =
      (1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
      2;

    return new Vector3(
      this.roundToPrecision(x * WORLD_SIZE, "coordinate"),
      this.roundToPrecision(elevation, "elevation"),
      this.roundToPrecision(y * WORLD_SIZE, "coordinate")
    );
  }

  worldToLngLat(position: Vector3): [number, number, number] {
    const x = position.x / WORLD_SIZE;
    const y = position.z / WORLD_SIZE;

    const lng = x * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

    return [
      this.roundToPrecision(lng, "coordinate"),
      this.roundToPrecision(lat, "coordinate"),
      this.roundToPrecision(position.y, "elevation"),
    ];
  }

  screenToWorld(screen: [number, number], tier: VisualizationTier): Vector3 {
    // This will be implemented per-tier with specific camera projections
    // For now, return a placeholder
    return new Vector3(screen[0], 0, screen[1]);
  }

  worldToScreen(world: Vector3, tier: VisualizationTier): [number, number] {
    // This will be implemented per-tier with specific camera projections
    // For now, return a placeholder
    return [world.x, world.z];
  }

  validateCoordinate(coord: [number, number]): boolean {
    const [lng, lat] = coord;
    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  }

  normalizeCoordinate(coord: [number, number]): [number, number] {
    let [lng, lat] = coord;

    // Normalize longitude to [-180, 180]
    lng = ((lng + 180) % 360) - 180;

    // Clamp latitude to [-90, 90]
    lat = Math.max(-90, Math.min(90, lat));

    return [lng, lat];
  }

  roundToPrecision(
    value: number,
    type: "coordinate" | "elevation" | "measurement"
  ): number {
    const precision = this.precision[type];
    return (
      Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)
    );
  }
}
