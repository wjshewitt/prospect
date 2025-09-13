"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  UnifiedCoordinateSystem,
  CoordinateSystem,
} from "../coordinates/CoordinateSystem";

interface MapLibreContextType {
  map: maplibregl.Map | null;
  coordinateSystem: CoordinateSystem;
  isLoaded: boolean;
}

const MapLibreContext = createContext<MapLibreContextType | null>(null);

export const useMapLibre = () => {
  const context = useContext(MapLibreContext);
  if (!context) {
    throw new Error("useMapLibre must be used within a MapLibreProvider");
  }
  return context;
};

interface MapLibreProviderProps {
  children: React.ReactNode;
  initialCenter?: [number, number];
  initialZoom?: number;
  style?: string;
}

export const MapLibreProvider: React.FC<MapLibreProviderProps> = ({
  children,
  initialCenter = [-2.244644, 53.483959], // UK center
  initialZoom = 7,
  style = "https://demotiles.maplibre.org/style.json",
}) => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const coordinateSystem = useRef(new UnifiedCoordinateSystem()).current;
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: initialCenter,
      zoom: initialZoom,
    });

    mapInstance.on("load", () => {
      setIsLoaded(true);
    });

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
    };
  }, [initialCenter, initialZoom, style]);

  const contextValue: MapLibreContextType = {
    map,
    coordinateSystem,
    isLoaded,
  };

  return (
    <MapLibreContext.Provider value={contextValue}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {isLoaded && children}
    </MapLibreContext.Provider>
  );
};
