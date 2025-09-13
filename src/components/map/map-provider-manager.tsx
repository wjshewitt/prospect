"use client";

import React, { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import {
  getMapProvider,
  isGoogleMapsProvider,
  requiresTileOverlay,
} from "@/lib/map-providers";

interface MapProviderManagerProps {
  activeProvider: string;
  onProviderChange: (providerId: string) => void;
  children: React.ReactNode;
}

export const MapProviderManager: React.FC<MapProviderManagerProps> = ({
  activeProvider,
  onProviderChange,
  children,
}) => {
  const map = useMap();
  const [overlayMapTypes, setOverlayMapTypes] = useState<
    google.maps.ImageMapType[]
  >([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing overlays
    overlayMapTypes.forEach((overlay) => {
      const index = map.overlayMapTypes.getArray().indexOf(overlay);
      if (index !== -1) {
        map.overlayMapTypes.removeAt(index);
      }
    });

    const provider = getMapProvider(activeProvider);
    if (!provider) return;

    // Handle Google Maps providers
    if (isGoogleMapsProvider(activeProvider)) {
      // Set the appropriate Google Maps type
      switch (activeProvider) {
        case "google-satellite":
          map.setMapTypeId("satellite");
          break;
        case "google-roadmap":
          map.setMapTypeId("roadmap");
          break;
        case "google-hybrid":
          map.setMapTypeId("hybrid");
          break;
        case "google-terrain":
          map.setMapTypeId("terrain");
          break;
        default:
          map.setMapTypeId("satellite");
      }
      setOverlayMapTypes([]);
    } else if (requiresTileOverlay(activeProvider)) {
      // Handle third-party tile providers
      map.setMapTypeId("roadmap"); // Use roadmap as base for overlays

      const mapType = new google.maps.ImageMapType({
        getTileUrl: (coord, zoom) =>
          provider.getTileUrl(coord.x, coord.y, zoom),
        tileSize: new google.maps.Size(256, 256),
        name: provider.name,
        maxZoom: provider.maxZoom,
        opacity: 1.0,
      });

      map.overlayMapTypes.insertAt(0, mapType);
      setOverlayMapTypes([mapType]);
    }

    return () => {
      // Cleanup on unmount
      overlayMapTypes.forEach((overlay) => {
        const index = map.overlayMapTypes.getArray().indexOf(overlay);
        if (index !== -1) {
          map.overlayMapTypes.removeAt(index);
        }
      });
    };
  }, [map, activeProvider]);

  // Handle provider change requests
  const handleProviderChange = (providerId: string) => {
    const provider = getMapProvider(providerId);
    if (provider) {
      onProviderChange(providerId);
    }
  };

  return <>{children}</>;
};

// Hook for easy provider management
export const useMapProvider = (
  initialProvider: string = "google-satellite"
) => {
  const [activeProvider, setActiveProvider] = useState(initialProvider);

  const changeProvider = (providerId: string) => {
    const provider = getMapProvider(providerId);
    if (provider) {
      setActiveProvider(providerId);
    }
  };

  return {
    activeProvider,
    changeProvider,
    currentProvider: getMapProvider(activeProvider),
  };
};
