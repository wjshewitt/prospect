
'use client';

import type { Shape, LatLng } from '@/lib/types';
import * as turf from '@turf/turf';

/**
 * Takes a shape and applies a buffer (positive for outward, negative for inward).
 * @param shape - The original shape.
 * @param distance - The buffer distance in meters.
 * @returns A new shape object with the buffered path and area.
 */
export function applyBuffer(shape: Shape, distance: number): { path: LatLng[], area: number } {
  if (shape.path.length < 3) {
    throw new Error('Cannot buffer a shape with less than 3 points.');
  }

  // Turf.js expects coordinates in [lng, lat] format
  const turfPoints = shape.path.map(p => [p.lng, p.lat]);
  
  // Ensure the polygon is closed for turf
  if (turfPoints[0][0] !== turfPoints[turfPoints.length - 1][0] || turfPoints[0][1] !== turfPoints[turfPoints.length - 1][1]) {
    turfPoints.push(turfPoints[0]);
  }

  const turfPolygon = turf.polygon([turfPoints]);
  const buffered = turf.buffer(turfPolygon, distance, { units: 'meters' });

  if (!buffered || !buffered.geometry || !buffered.geometry.coordinates || buffered.geometry.coordinates.length === 0) {
    throw new Error('Buffer operation resulted in an empty shape. The distance may be too large.');
  }

  // Turf returns coordinates in [lng, lat] format, so we convert back
  const newPath = buffered.geometry.coordinates[0].map((p: number[]) => ({ lat: p[1], lng: p[0] }));
  
  // Remove the closing point that turf adds if it's a duplicate of the first
  if (newPath.length > 1 && newPath[0].lat === newPath[newPath.length-1].lat && newPath[0].lng === newPath[newPath.length-1].lng) {
      newPath.pop();
  }

  // Calculate the new area using Google Maps geometry library for consistency
  const newArea = google.maps.geometry.spherical.computeArea(newPath);

  return { path: newPath, area: newArea };
}
