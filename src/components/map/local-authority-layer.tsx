"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { localAuthorityService } from "@/services/local-authority/local-authority-service";
import { LocalAuthorityFeature, LocalAuthorityInfo } from "@/lib/types";
import * as turf from "@turf/turf";
import { simplify } from "@turf/turf";

interface LocalAuthorityLayerProps {
  visible: boolean;
  opacity?: number;
  onAuthorityClick?: (authority: LocalAuthorityFeature) => void;
  onAuthorityHover?: (authority: LocalAuthorityFeature | null) => void;
}

/**
 * Local Authority Layer Component
 * Renders local authority boundaries with efficient viewport-based rendering
 */
export const LocalAuthorityLayer: React.FC<LocalAuthorityLayerProps> = ({
  visible,
  opacity = 0.3,
  onAuthorityClick,
  onAuthorityHover,
}) => {
  const map = useMap();
  const [features, setFeatures] = useState<LocalAuthorityFeature[]>([]);
  const [polygons, setPolygons] = useState<google.maps.Polygon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastBounds, setLastBounds] = useState<google.maps.LatLngBounds | null>(
    null
  );

  /**
   * Get current map bounds
   */
  const getMapBounds = useCallback((): google.maps.LatLngBounds | null => {
    if (!map) return null;
    return map.getBounds() || null;
  }, [map]);

  /**
   * Convert Google Maps bounds to simple bounds object
   */
  const convertBounds = useCallback(
    (
      bounds: google.maps.LatLngBounds
    ): {
      north: number;
      south: number;
      east: number;
      west: number;
    } => {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      return {
        north: ne.lat(),
        south: sw.lat(),
        east: ne.lng(),
        west: sw.lng(),
      };
    },
    []
  );

  /**
   * Load local authority features for current viewport
   */
  const loadFeatures = useCallback(async () => {
    if (!map || !visible) return;

    const bounds = getMapBounds();
    if (!bounds) return;

    // Check if bounds have changed significantly
    if (lastBounds && lastBounds.equals(bounds)) return;

    setIsLoading(true);
    setLastBounds(bounds);

    try {
      const simpleBounds = convertBounds(bounds);
      const viewportFeatures = await localAuthorityService.getFeaturesInBounds(
        simpleBounds
      );
      setFeatures(viewportFeatures);
    } catch (error) {
      console.error("Error loading local authority features:", error);
    } finally {
      setIsLoading(false);
    }
  }, [map, visible, getMapBounds, convertBounds, lastBounds]);

  /**
   * Create Google Maps polygons from features
   */
  const createPolygons = useCallback(() => {
    if (!map || !visible || features.length === 0) return [];

    const newPolygons: google.maps.Polygon[] = [];

    features.forEach((feature) => {
      try {
        const paths = feature.geometry.coordinates.map((polygon) =>
          polygon[0].map((coord) => ({
            lat: coord[1],
            lng: coord[0],
          }))
        );

        paths.forEach((path) => {
          const polygon = new google.maps.Polygon({
            paths: path,
            map,
            strokeColor: "#6B7280",
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: "#9CA3AF",
            fillOpacity: opacity,
            clickable: true,
            zIndex: 1,
          });

          // Add event listeners
          if (onAuthorityClick) {
            polygon.addListener("click", () => onAuthorityClick(feature));
          }

          if (onAuthorityHover) {
            polygon.addListener("mouseover", () => onAuthorityHover(feature));
            polygon.addListener("mouseout", () => onAuthorityHover(null));
          }

          newPolygons.push(polygon);
        });
      } catch (error) {
        console.error("Error creating polygon for feature:", error, feature);
      }
    });

    return newPolygons;
  }, [map, visible, features, opacity, onAuthorityClick, onAuthorityHover]);

  /**
   * Clear existing polygons
   */
  const clearPolygons = useCallback(
    (polygonsToClear: google.maps.Polygon[]) => {
      polygonsToClear.forEach((polygon) => {
        polygon.setMap(null);
      });
    },
    []
  );

  // Load features when map or visibility changes
  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  // Update polygons when features change
  useEffect(() => {
    if (!visible) {
      setPolygons((prevPolygons) => {
        clearPolygons(prevPolygons);
        return [];
      });
      return;
    }

    const newPolygons = createPolygons();
    setPolygons((prevPolygons) => {
      clearPolygons(prevPolygons);
      return newPolygons;
    });

    return () => {
      clearPolygons(newPolygons);
    };
  }, [createPolygons, visible, clearPolygons]);

  // Handle map bounds changes
  useEffect(() => {
    if (!map) return;

    const handleBoundsChanged = () => {
      loadFeatures();
    };

    const listener = map.addListener("bounds_changed", handleBoundsChanged);
    return () => {
      listener.remove();
    };
  }, [map, loadFeatures]);

  // Handle zoom level changes for level-of-detail rendering
  const zoomLevel = useMemo(() => {
    return map?.getZoom() || 0;
  }, [map]);

  // Simplify geometries at lower zoom levels for performance
  const shouldSimplify = useMemo(() => {
    return zoomLevel < 10;
  }, [zoomLevel]);

  // Render loading indicator if needed
  if (isLoading && visible) {
    return (
      <div className="absolute top-4 left-4 z-10 bg-white/90 rounded-lg p-2 shadow-lg">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">
            Loading local authorities...
          </span>
        </div>
      </div>
    );
  }

  return null; // This component doesn't render UI elements, it manages map overlays
};

/**
 * Hook for using local authority service
 */
export function useLocalAuthorityService() {
  return localAuthorityService;
}

/**
 * Hook for finding containing local authority
 */
export function useContainingAuthority(lat: number, lng: number) {
  const [authority, setAuthority] = useState<LocalAuthorityInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const findAuthority = async () => {
      setIsLoading(true);
      try {
        const result = await localAuthorityService.findContainingAuthority(
          lat,
          lng
        );
        setAuthority(result);
      } catch (error) {
        console.error("Error finding containing authority:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (lat && lng) {
      findAuthority();
    }
  }, [lat, lng]);

  return { authority, isLoading };
}

export default LocalAuthorityLayer;
