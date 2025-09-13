"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useMapLibre } from "./MapLibreProvider";
import type { Shape, Tool, LatLng } from "@/lib/types";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useToast } from "@/hooks/use-toast";
import * as turf from "@turf/turf";

interface MapLibreCanvasProps {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onBoundaryDrawn: (shape: Omit<Shape, "id">) => void;
  className?: string;
  onCameraChanged?: (center: [number, number], zoom: number) => void;
}

export const MapLibreCanvas: React.FC<MapLibreCanvasProps> = ({
  shapes,
  setShapes,
  selectedTool,
  setSelectedTool,
  selectedShapeIds,
  setSelectedShapeIds,
  onBoundaryDrawn,
  className = "w-full h-full",
  onCameraChanged,
}) => {
  const { map, isLoaded } = useMapLibre();
  const { toast } = useToast();
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Initialize MapboxDraw
  useEffect(() => {
    if (!map || !isLoaded) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // Custom styles for drawing
        {
          id: "gl-draw-polygon-fill-inactive",
          type: "fill",
          filter: [
            "all",
            ["==", "active", "false"],
            ["==", "$type", "Polygon"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "fill-color": "#FF6B35",
            "fill-outline-color": "#FF6B35",
            "fill-opacity": 0.25,
          },
        },
        {
          id: "gl-draw-polygon-stroke-inactive",
          type: "line",
          filter: [
            "all",
            ["==", "active", "false"],
            ["==", "$type", "Polygon"],
            ["!=", "mode", "static"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#FF6B35",
            "line-width": 3,
            "line-opacity": 0.9,
          },
        },
        {
          id: "gl-draw-polygon-fill-active",
          type: "fill",
          filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
          paint: {
            "fill-color": "#FF6B35",
            "fill-outline-color": "#FF6B35",
            "fill-opacity": 0.3,
          },
        },
        {
          id: "gl-draw-polygon-stroke-active",
          type: "line",
          filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#FF6B35",
            "line-width": 4,
            "line-opacity": 1,
          },
        },
      ],
    });

    map.addControl(draw);
    drawRef.current = draw;

    // Handle drawing completion
    map.on("draw.create", (e) => {
      const feature = e.features[0];
      if (feature.geometry.type === "Polygon") {
        const coordinates = feature.geometry.coordinates[0];
        const path: LatLng[] = coordinates
          .slice(0, -1)
          .map(([lng, lat]) => ({ lng, lat }));
        const area = turf.area(feature);

        onBoundaryDrawn({
          type: "polygon",
          path,
          area,
        });

        // Clear the drawing
        draw.deleteAll();
        setSelectedTool("pan");
        setIsDrawingMode(false);
      }
    });

    // Handle camera changes
    const handleMove = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onCameraChanged?.([center.lng, center.lat], zoom);
    };

    map.on("moveend", handleMove);

    return () => {
      map.off("draw.create");
      map.off("moveend", handleMove);
      if (drawRef.current) {
        map.removeControl(drawRef.current);
      }
    };
  }, [map, isLoaded, onBoundaryDrawn, onCameraChanged, setSelectedTool]);

  // Handle tool changes
  useEffect(() => {
    if (!drawRef.current) return;

    const draw = drawRef.current;

    switch (selectedTool) {
      case "polygon":
      case "rectangle":
      case "freehand":
        if (!isDrawingMode) {
          draw.changeMode("draw_polygon");
          setIsDrawingMode(true);
        }
        break;
      case "pan":
      default:
        if (isDrawingMode) {
          draw.changeMode("simple_select");
          setIsDrawingMode(false);
        }
        break;
    }
  }, [selectedTool, isDrawingMode]);

  // Render existing shapes
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Clear existing shape layers
    const existingLayers =
      map.getStyle().layers?.filter((layer) => layer.id.startsWith("shape-")) ||
      [];

    existingLayers.forEach((layer) => {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }
    });

    // Clear existing shape sources
    const existingSources = Object.keys(map.getStyle().sources || {}).filter(
      (source) => source.startsWith("shape-")
    );

    existingSources.forEach((source) => {
      if (map.getSource(source)) {
        map.removeSource(source);
      }
    });

    // Add shapes to map
    shapes.forEach((shape, index) => {
      const sourceId = `shape-${shape.id}`;
      const layerId = `shape-layer-${shape.id}`;

      // Convert shape to GeoJSON
      const coordinates = [
        ...shape.path.map((p) => [p.lng, p.lat]),
        [shape.path[0].lng, shape.path[0].lat],
      ];
      const geojson = {
        type: "Feature" as const,
        properties: {
          id: shape.id,
          type: shape.type,
          selected: selectedShapeIds.includes(shape.id),
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [coordinates],
        },
      };

      // Add source
      map.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });

      // Determine colors based on shape type
      let fillColor = "#3B82F6";
      let strokeColor = "#3B82F6";

      if (shape.zoneMeta) {
        switch (shape.zoneMeta.kind) {
          case "residential":
            fillColor = "#10B981";
            strokeColor = "#059669";
            break;
          case "commercial":
            fillColor = "#3B82F6";
            strokeColor = "#2563EB";
            break;
          case "green_space":
            fillColor = "#22C55E";
            strokeColor = "#16A34A";
            break;
          case "amenity":
            fillColor = "#F59E0B";
            strokeColor = "#D97706";
            break;
          case "solar":
            fillColor = "#F97316";
            strokeColor = "#EA580C";
            break;
        }
      } else if (shape.assetMeta) {
        if (shape.assetMeta.assetType === "building") {
          fillColor = "#A9927D";
          strokeColor = "#5E503F";
        } else if (shape.assetMeta.assetType === "solar_panel") {
          fillColor = "#1E40AF";
          strokeColor = "#1E293B";
        }
      } else if (shape.bufferMeta) {
        fillColor = "#8B5CF6";
        strokeColor = "#8B5CF6";
      } else {
        // Boundary
        fillColor = "#FF6B35";
        strokeColor = "#FF6B35";
      }

      // Add fill layer
      map.addLayer({
        id: layerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": fillColor,
          "fill-opacity": selectedShapeIds.includes(shape.id) ? 0.4 : 0.25,
        },
      });

      // Add stroke layer
      map.addLayer({
        id: `${layerId}-stroke`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": strokeColor,
          "line-width": selectedShapeIds.includes(shape.id) ? 4 : 2,
          "line-opacity": 0.9,
        },
      });

      // Add click handler for selection
      map.on("click", layerId, (e) => {
        if (selectedTool === "pan") {
          const clickedShapeId = e.features?.[0]?.properties?.id;
          if (clickedShapeId) {
            const isCtrlOrMeta =
              e.originalEvent.ctrlKey || e.originalEvent.metaKey;
            if (isCtrlOrMeta) {
              // Toggle selection
              setSelectedShapeIds(
                selectedShapeIds.includes(clickedShapeId)
                  ? selectedShapeIds.filter((id) => id !== clickedShapeId)
                  : [...selectedShapeIds, clickedShapeId]
              );
            } else {
              // Single selection
              setSelectedShapeIds([clickedShapeId]);
            }
          }
        }
      });

      // Change cursor on hover
      map.on("mouseenter", layerId, () => {
        if (selectedTool === "pan") {
          map.getCanvas().style.cursor = "pointer";
        }
      });

      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    });
  }, [
    map,
    isLoaded,
    shapes,
    selectedShapeIds,
    selectedTool,
    setSelectedShapeIds,
  ]);

  if (!isLoaded) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <div className={className} />;
};
