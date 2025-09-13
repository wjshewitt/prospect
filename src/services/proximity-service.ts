// src/services/proximity-service.ts
"use client";

import type { Shape } from "@/lib/types";
import * as turf from "@turf/turf";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import nearestPointOnLine from "@turf/nearest-point-on-line";

interface ProximityData {
  airport?: {
    name: string;
    distanceKm: number;
    distanceMiles: number;
    coords: [number, number]; // [lng, lat]
  };
  town?: {
    name: string;
    distanceKm: number;
    distanceMiles: number;
    coords: [number, number];
  };
  school?: {
    name: string;
    distanceKm: number;
    distanceMiles: number;
    coords: [number, number];
  };
  hospital?: {
    name: string;
    distanceKm: number;
    distanceMiles: number;
    coords: [number, number];
  };
  highway?: {
    name: string;
    distanceKm: number;
    distanceMiles: number;
    coords: [number, number];
  };
  validation: {
    isValid: boolean;
    errors: string[];
    boundaryArea: number;
  };
}

const POI_TYPES: Record<keyof Omit<ProximityData, "validation">, string> = {
  airport: "airport",
  town: "(cities)",
  school: "school",
  hospital: "hospital",
  highway: "route", // Better for highways
};

export async function getProximityData(shape: Shape): Promise<ProximityData> {
  const errors: string[] = [];
  let boundaryArea = 0;

  try {
    // Validate and convert shape to Turf polygon
    const coords = shape.path.map((p) => [p.lng, p.lat]);
    if (
      coords.length > 0 &&
      (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1])
    ) {
      coords.push(coords[0]);
    }

    const poly = turf.polygon([coords]);

    // Validate: Check for self-intersections
    const k = turf.kinks(poly);
    if (k.features.length > 0) {
      errors.push(
        "Irregular boundary detected: Self-intersections found. Consider simplifying the polygon."
      );
    }

    boundaryArea = turf.area(poly);

    // Get center for search
    const center = turf.centroid(poly);
    const centerPt = turf.point(center.geometry.coordinates);
    const [centerLng, centerLat] = center.geometry.coordinates;

    const data: ProximityData = {
      validation: { isValid: errors.length === 0, errors, boundaryArea },
    };

    // Check if Google Maps is available
    if (
      typeof window === "undefined" ||
      !window.google ||
      !window.google.maps
    ) {
      errors.push("Google Maps API not available");
      return {
        validation: { isValid: false, errors, boundaryArea },
      };
    }

    // Fetch POIs using browser Places API
    const service = new window.google.maps.places.PlacesService(
      document.createElement("div")
    );

    const poiPromises = Object.entries(POI_TYPES) as [
      keyof Omit<ProximityData, "validation">,
      string
    ][];

    await Promise.all(
      poiPromises.map(([key, type]) => {
        return new Promise<void>((resolve) => {
          const request = {
            location: new window.google.maps.LatLng(centerLat, centerLng),
            radius: 50000,
            type: type,
          };

          service.nearbySearch(request, (results, status) => {
            try {
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                results &&
                results.length > 0
              ) {
                const place = results[0];
                const placeLoc = place.geometry!.location!;
                const placePt = turf.point([placeLoc.lng(), placeLoc.lat()]);

                // Robust distance: If POI outside boundary, find nearest point on boundary
                let distancePt = centerPt;
                if (!booleanPointInPolygon(placePt, poly)) {
                  const b = turf.bbox(poly);
                  const bboxPoly = turf.bboxPolygon(b);
                  const nearest = nearestPointOnLine(bboxPoly, placePt);
                  if (nearest) distancePt = nearest;
                }

                const distKm = turf.distance(centerPt, placePt, {
                  units: "kilometers",
                });
                const distMiles = turf.distance(centerPt, placePt, {
                  units: "miles",
                });

                (data as any)[key] = {
                  name: place.name || "Unknown",
                  distanceKm: parseFloat(distKm.toFixed(1)),
                  distanceMiles: parseFloat(distMiles.toFixed(1)),
                  coords: [placeLoc.lng(), placeLoc.lat()],
                };
              }
            } catch (err: any) {
              console.warn(`Failed to process ${key}:`, err.message);
            }
            resolve();
          });
        });
      })
    );

    return data;
  } catch (err) {
    errors.push(
      `Proximity calculation failed: ${
        err instanceof Error ? err.message : "Unknown error"
      }`
    );
    return {
      validation: { isValid: false, errors, boundaryArea },
    };
  }
}

export type { ProximityData };
