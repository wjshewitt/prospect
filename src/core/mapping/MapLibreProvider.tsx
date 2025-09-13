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

interface MapLibreContextType {
  map: maplibregl.Map | null;
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
  containerRef: React.RefObject<HTMLDivElement>;
  center?: [number, number];
  zoom?: number;
  style?: string;
}

export const MapLibreProvider: React.FC<MapLibreProviderProps> = ({
  children,
  containerRef,
  center = [-2.244644, 53.483959], // UK center
  zoom = 7,
  style = "https://demotiles.maplibre.org/style.json",
}) => {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || map) return;

    const mapInstance = new maplibregl.Map({
      container: containerRef.current,
      style,
      center,
      zoom,
      attributionControl: true,
    });

    mapInstance.on("load", () => {
      setIsLoaded(true);
    });

    setMap(mapInstance);

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [containerRef, center, zoom, style]);

  return (
    <MapLibreContext.Provider value={{ map, isLoaded }}>
      {children}
    </MapLibreContext.Provider>
  );
};
