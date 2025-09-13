import type { Shape, LatLng } from '@/lib/types';

/**
 * Utility functions to convert between legacy path format and GeoJSON coordinates
 * for backward compatibility during the MapLibre migration
 */

/**
 * Convert legacy LatLng path to GeoJSON coordinates
 */
export function pathToCoordinates(path: LatLng[]): number[][][] {
  if (!path || path.length === 0) return [];
  
  // Convert LatLng objects to [lng, lat] coordinate pairs
  const coords = path.map((point) => [point.lng, point.lat]);
  
  // Close the polygon if it's not already closed
  const firstPoint = coords[0];
  const lastPoint = coords[coords.length - 1];
  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    coords.push([firstPoint[0], firstPoint[1]]);
  }
  
  // Return as GeoJSON polygon coordinates (array of rings)
  return [coords];
}

/**
 * Convert GeoJSON coordinates to legacy LatLng path
 */
export function coordinatesToPath(coordinates: number[][][]): LatLng[] {
  if (!coordinates || coordinates.length === 0) return [];
  
  // Get the exterior ring (first ring)
  const ring = coordinates[0];
  if (!ring || ring.length === 0) return [];
  
  // Convert [lng, lat] pairs to LatLng objects
  // Remove the last point if it's a duplicate of the first (GeoJSON requirement)
  const points = ring.slice(0, -1).map((coord) => ({
    lat: coord[1],
    lng: coord[0],
  }));
  
  return points;
}

/**
 * Ensure a shape has both path and coordinates for compatibility
 */
export function normalizeShape(shape: Shape): Shape {
  const normalized = { ...shape };
  
  // If coordinates exist but path doesn't, convert coordinates to path
  if (normalized.coordinates && (!normalized.path || normalized.path.length === 0)) {
    normalized.path = coordinatesToPath(normalized.coordinates);
  }
  
  // If path exists but coordinates don't, convert path to coordinates
  if (normalized.path && normalized.path.length > 0 && (!normalized.coordinates || normalized.coordinates.length === 0)) {
    normalized.coordinates = pathToCoordinates(normalized.path);
  }
  
  return normalized;
}

/**
 * Convert shapes array for MapLibre compatibility
 */
export function normalizeShapesForMapLibre(shapes: Shape[]): Shape[] {
  return shapes.map(normalizeShape);
}

/**
 * Convert shapes array for Google Maps compatibility
 */
export function normalizeShapesForGoogleMaps(shapes: Shape[]): Shape[] {
  return shapes.map((shape) => {
    const normalized = normalizeShape(shape);
    // Ensure path exists for Google Maps
    if (!normalized.path || normalized.path.length === 0) {
      normalized.path = [];
    }
    return normalized;
  });
}

/**
 * Create a GeoJSON feature from a shape
 */
export function shapeToGeoJSONFeature(shape: Shape): GeoJSON.Feature {
  const normalized = normalizeShape(shape);
  
  return {
    type: 'Feature',
    properties: {
      id: shape.id,
      name: shape.properties?.name || `Shape ${shape.id}`,
      type: shape.type,
      ...shape.properties,
    },
    geometry: {
      type: 'Polygon',
      coordinates: normalized.coordinates || [],
    },
  };
}

/**
 * Create a shape from a GeoJSON feature
 */
export function geoJSONFeatureToShape(feature: GeoJSON.Feature): Shape {
  const geometry = feature.geometry as GeoJSON.Polygon;
  const properties = feature.properties || {};
  
  const shape: Shape = {
    id: properties.id || Math.random().toString(36).substr(2, 9),
    type: properties.type || 'polygon',
    path: [], // Will be filled by normalizeShape
    coordinates: geometry.coordinates,
    properties: {
      name: properties.name,
      description: properties.description,
      ...properties,
    },
  };
  
  return normalizeShape(shape);
}

/**
 * Calculate area using simple spherical excess formula (compatible with both engines)
 */
export function calculateShapeArea(shape: Shape): number {
  const normalized = normalizeShape(shape);
  if (!normalized.coordinates || normalized.coordinates.length === 0) return 0;
  
  const ring = normalized.coordinates[0];
  if (ring.length < 4) return 0; // Need at least 3 points + closure
  
  // Simple spherical excess calculation
  let area = 0;
  const R = 6371000; // Earth radius in meters
  
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % (ring.length - 1)];
    
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    area += 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
  return Math.abs(area) * R * R;
}