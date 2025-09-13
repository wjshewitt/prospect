import { LatLng } from "@/lib/types";

// MeasurementService implementation using Google Maps geometry utilities
export class MeasurementService {
  /**
   * Calculate area of a polygon path
   * @param path Array of LatLng points
   * @param units Measurement units
   * @returns Area in specified units (m² for metric, acres for imperial)
   */
  static calculateArea(
    path: LatLng[],
    units: "metric" | "imperial" = "metric"
  ): number {
    if (path.length < 3) return 0;

    // Use window.google.maps for client-side access
    if (typeof window === "undefined" || !window.google?.maps?.geometry) {
      return 0; // Return 0 if Google Maps is not available
    }

    // Convert to Google Maps LatLng objects
    const gPath = path.map((p) => new window.google.maps.LatLng(p.lat, p.lng));

    // Compute area in square meters using spherical geometry
    const areaM2 = window.google.maps.geometry.spherical.computeArea(gPath);

    if (units === "imperial") {
      // Convert m² to acres (1 acre = 4046.86 m²)
      return areaM2 / 4046.86;
    }

    return areaM2; // Return m² for metric
  }

  /**
   * Calculate perimeter of a polygon path
   * @param path Array of LatLng points
   * @param units Measurement units
   * @returns Perimeter in specified units (meters for metric, feet for imperial)
   */
  static calculatePerimeter(
    path: LatLng[],
    units: "metric" | "imperial" = "metric"
  ): number {
    if (path.length < 2) return 0;

    let totalDistance = 0;

    // Calculate distance between consecutive points
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += this.calculateDistance(path[i], path[i + 1], units);
    }

    // Close the polygon by calculating distance from last to first point
    if (path.length > 2) {
      totalDistance += this.calculateDistance(
        path[path.length - 1],
        path[0],
        units
      );
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points
   * @param point1 First LatLng point
   * @param point2 Second LatLng point
   * @param units Measurement units
   * @returns Distance in specified units (meters for metric, feet for imperial)
   */
  static calculateDistance(
    point1: LatLng,
    point2: LatLng,
    units: "metric" | "imperial" = "metric"
  ): number {
    if (typeof window === "undefined" || !window.google?.maps?.geometry) {
      return 0; // Return 0 if Google Maps is not available
    }

    const gPoint1 = new window.google.maps.LatLng(point1.lat, point1.lng);
    const gPoint2 = new window.google.maps.LatLng(point2.lat, point2.lng);

    // Compute distance in meters using spherical geometry
    const distanceMeters =
      window.google.maps.geometry.spherical.computeDistanceBetween(
        gPoint1,
        gPoint2
      );

    if (units === "imperial") {
      // Convert meters to feet (1 meter = 3.28084 feet)
      return distanceMeters * 3.28084;
    }

    return distanceMeters; // Return meters for metric
  }

  /**
   * Calculate bearing (heading) between two points
   * @param point1 Starting LatLng point
   * @param point2 Ending LatLng point
   * @returns Bearing in degrees (0-360)
   */
  static calculateBearing(point1: LatLng, point2: LatLng): number {
    if (typeof window === "undefined" || !window.google?.maps?.geometry) {
      return 0; // Return 0 if Google Maps is not available
    }

    const gPoint1 = new window.google.maps.LatLng(point1.lat, point1.lng);
    const gPoint2 = new window.google.maps.LatLng(point2.lat, point2.lng);

    // Compute heading in degrees (0 when heading north, positive to east)
    const heading = window.google.maps.geometry.spherical.computeHeading(
      gPoint1,
      gPoint2
    );

    // Normalize to 0-360 range
    return heading < 0 ? heading + 360 : heading;
  }

  /**
   * Format area value with appropriate units and precision
   * @param area Raw area value
   * @param units Measurement units
   * @param precision Decimal places
   * @returns Formatted string (e.g., "1.23 acres", "4567 m²")
   */
  static formatArea(
    area: number,
    units: "metric" | "imperial",
    precision: number
  ): string {
    if (area <= 0) return "0";

    if (units === "imperial") {
      // For imperial: show sq ft for small areas (<1 acre), acres for larger
      if (area < 1) {
        const sqFt = area * 43560; // 1 acre = 43560 sq ft
        return `${sqFt.toFixed(precision)} sq ft`;
      }
      return `${area.toFixed(precision)} acres`;
    } else {
      // For metric: show m² for small areas (<10000 m²), hectares for larger
      if (area < 10000) {
        return `${area.toFixed(precision)} m²`;
      }
      const hectares = area / 10000; // 1 hectare = 10000 m²
      return `${hectares.toFixed(precision)} ha`;
    }
  }

  /**
   * Format distance value with appropriate units and precision
   * @param distance Raw distance value
   * @param units Measurement units
   * @param precision Decimal places
   * @returns Formatted string (e.g., "1234 ft", "1.23 mi", "567 m", "0.89 km")
   */
  static formatDistance(
    distance: number,
    units: "metric" | "imperial",
    precision: number
  ): string {
    if (distance <= 0) return "0";

    if (units === "imperial") {
      // For imperial: show feet for short distances (<1 mile), miles for longer
      if (distance < 5280) {
        // 1 mile = 5280 feet
        return `${distance.toFixed(precision)} ft`;
      }
      const miles = distance / 5280;
      return `${miles.toFixed(precision)} mi`;
    } else {
      // For metric: show meters for short distances (<1000 m), km for longer
      if (distance < 1000) {
        return `${distance.toFixed(precision)} m`;
      }
      const km = distance / 1000;
      return `${km.toFixed(precision)} km`;
    }
  }
}

// Export interface for type checking (already defined in types.ts but re-export for convenience)
export interface MeasurementService {
  calculateArea(path: LatLng[], units?: "metric" | "imperial"): number;
  calculatePerimeter(path: LatLng[], units?: "metric" | "imperial"): number;
  calculateDistance(
    point1: LatLng,
    point2: LatLng,
    units?: "metric" | "imperial"
  ): number;
  calculateBearing(point1: LatLng, point2: LatLng): number;
  formatMeasurement(
    value: number,
    type: "area" | "distance",
    units: "metric" | "imperial"
  ): string;
}
