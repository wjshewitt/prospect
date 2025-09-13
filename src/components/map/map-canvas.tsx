"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  Map,
  useMap,
  useApiIsLoaded,
  InfoWindow,
  MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import type {
  Shape,
  Tool,
  ElevationGrid,
  ElevationGridCell,
  LatLng,
  LiveMeasurement,
  MeasurementConfig,
  LayerOverlay,
  Annotation,
} from "@/lib/types";
import { MeasurementOverlay } from "../measurement/measurement-overlay";
import { MeasurementService } from "@/services/measurement";
import type { PolygonRing } from "@/services/geometry/polygon";
import type { ZoneKind } from "@/services/zoning/rules";
import { validateBuildingPlacement } from "@/services/zoning/rules";
import { ShapeContextMenu } from "./shape-context-menu";
import { useToast } from "@/hooks/use-toast";
import { BufferDialog, type BufferState } from "./buffer-dialog";
import { ZoneDialog, type ZoneDialogState } from "./zone-dialog";
import { applyBuffer } from "@/services/buffer";
import { SiteMarker } from "./site-marker";
import * as turf from "@turf/turf";
import { LayerControl } from "./layer-control";
import { MapProviderManager } from "./map-provider-manager";
import { AnnotationTool } from "../annotation/annotation-tool";
import { AnnotationOverlay } from "../annotation/annotation-overlay";
import { LocalAuthorityLayer } from "./local-authority-layer";

interface MapCanvasProps {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  steepnessThreshold: number;
  elevationGrid: ElevationGrid | null;
  isAnalysisVisible: boolean;
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onBoundaryDrawn: (shape: Omit<Shape, "id">) => void;
  onAutoSave?: () => Promise<void>;
  className?: string;
  viewState: any;
  onCameraChanged: (e: MapCameraChangedEvent) => void;
  measurementConfig?: MeasurementConfig;
  mapProvider: string;
  setMapProvider: (id: string) => void;
  layerVisibility: { [key: string]: boolean };
  setLayerVisibility: (
    visibility:
      | { [key: string]: boolean }
      | ((prev: { [key: string]: boolean }) => { [key: string]: boolean })
  ) => void;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  localAuthorityInfo?: {
    name: string;
    reference: string;
    entity: string;
    planningAuthority: string;
  } | null;
  setLocalAuthorityInfo?: (info: any) => void;
}

interface ContextMenuState {
  shapeId: string;
  position: { x: number; y: number };
}

export function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// Enhanced zone colors with better contrast and visibility
const getEnhancedZoneColor = (
  kind?: "residential" | "commercial" | "green_space" | "amenity" | "solar"
) => {
  const effectiveKind = kind ?? "default";
  switch (effectiveKind) {
    case "residential":
      return { fill: "#10B981", stroke: "#059669" }; // Emerald
    case "commercial":
      return { fill: "#3B82F6", stroke: "#2563EB" }; // Blue
    case "amenity":
      return { fill: "#F59E0B", stroke: "#D97706" }; // Amber
    case "green_space":
      return { fill: "#22C55E", stroke: "#16A34A" }; // Green
    case "solar":
      return { fill: "#F97316", stroke: "#EA580C" }; // Orange
    default:
      return { fill: "#6B7280", stroke: "#4B5563" }; // Gray
  }
};

// Enhanced styling function for drawn shapes
const getEnhancedShapeStyle = (
  shape: Shape,
  isSelected: boolean,
  isEditing: boolean,
  isMoving: boolean,
  bufferedParentIds: Set<string>,
  selectedTool: Tool
) => {
  const isBuffer = !!shape.bufferMeta;
  const isZone = !!shape.zoneMeta;
  const isAsset = !!shape.assetMeta;
  const isBoundary = !isBuffer && !isZone && !isAsset;
  const isBufferedParent = bufferedParentIds.has(shape.id);

  // Enhanced base styling
  let fillColor = "#3B82F6"; // Default blue
  let fillOpacity = 0.3;
  let strokeColor = "#3B82F6";
  let strokeOpacity = 0.9;
  let strokeWeight = isSelected ? 5 : 3.5; // Much thicker lines
  let strokePosition: google.maps.StrokePosition =
    google.maps.StrokePosition.OUTSIDE;
  let zIndex = 1;
  let icons: google.maps.IconSequence[] | undefined;

  // ENHANCED BOUNDARY STYLING
  if (isBoundary) {
    strokeColor = "#FF6B35"; // Vibrant orange
    fillColor = "#FF6B35";
    strokeWeight = isSelected ? 6 : 4;
    fillOpacity = isSelected ? 0.2 : 0.1;
    zIndex = 5;

    // Solid line for boundary
    strokeOpacity = 0.8;
  }

  // ENHANCED BUFFER STYLING
  if (isBuffer) {
    fillColor = "#8B5CF6"; // Purple
    strokeColor = "#8B5CF6";
    fillOpacity = 0.25;
    strokeWeight = isSelected ? 4 : 3;
    zIndex = isSelected ? 6 : 3;

    // Dotted pattern for buffers
    icons = [
      {
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          strokeOpacity: 1,
          strokeWeight: 2,
          strokeColor: strokeColor,
          fillColor: strokeColor,
          fillOpacity: 1,
          scale: 3,
        },
        offset: "0",
        repeat: "20px",
      },
    ];
    strokeOpacity = 0.3;
  } else if (isBufferedParent) {
    strokeOpacity = 0.3;
  }

  // ENHANCED ZONE STYLING
  if (isZone && shape.zoneMeta) {
    const zoneColors = getEnhancedZoneColor(shape.zoneMeta?.kind);
    fillColor = zoneColors.fill;
    strokeColor = zoneColors.stroke;
    fillOpacity = 0.35;
    strokeWeight = isSelected ? 4 : 3;
    zIndex = isSelected ? 7 : 4;
    strokeOpacity = 0.9;
  }

  // --- NEW REALISTIC ASSET STYLING ---
  if (isAsset) {
    if (shape.assetMeta?.assetType === "solar_panel") {
      // Style for solar panels
      fillColor = "#1E40AF";
      strokeColor = "#1E293B";
      fillOpacity = 0.9;
      strokeWeight = 1.5;
    } else {
      // Style for buildings - Roof
      fillColor = "#A9927D"; // Earthy brown/terracotta for roof
      strokeColor = "#5E503F"; // Darker brown for roof edge/outline
      fillOpacity = 1.0;
      strokeWeight = 1;
    }
    zIndex = isSelected ? 8 : 6;
    strokeOpacity = 1.0;
  }

  // ENHANCED INTERACTION STATES
  if (isMoving) {
    fillOpacity = 0.6;
    strokeOpacity = 1.0;
    strokeWeight += 1;

    // Add movement indicator
    if (!icons) {
      icons = [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            strokeColor: "#FFFFFF",
            scale: 4,
          },
          offset: "0",
          repeat: "30px",
        },
      ];
    }
  }

  if (isSelected) {
    zIndex += 10;
    strokeWeight += 1;
  }

  return {
    fillColor,
    fillOpacity,
    strokeColor,
    strokeOpacity,
    strokeWeight,
    strokePosition,
    zIndex,
    icons,
    clickable: selectedTool === "pan",
    editable: isEditing,
    draggable: isMoving,
  };
};

// Helper function to smooth the freehand path
const smoothPath = (path: LatLng[]): LatLng[] => {
  if (path.length < 3) return path;

  const smoothed: LatLng[] = [path[0]]; // Keep first point

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    // Simple smoothing: average with neighbors
    const smoothedLat = (prev.lat + curr.lat + next.lat) / 3;
    const smoothedLng = (prev.lng + curr.lng + next.lng) / 3;

    // Only add point if it's significantly different from the last
    const lastPoint = smoothed[smoothed.length - 1];
    const distance =
      Math.abs(smoothedLat - lastPoint.lat) +
      Math.abs(smoothedLng - lastPoint.lng);

    if (distance > 0.0001) {
      // Threshold to reduce point density
      smoothed.push({ lat: smoothedLat, lng: smoothedLng });
    }
  }

  smoothed.push(path[path.length - 1]); // Keep last point
  return smoothed;
};

const DrawingManagerComponent: React.FC<{
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
  measurementConfig?: MeasurementConfig;
  onZoneDrawn: (path: LatLng[], area: number) => void;
  onBoundaryDrawn: (shape: Omit<Shape, "id">) => void;
}> = ({
  selectedTool,
  setSelectedTool,
  shapes,
  measurementConfig,
  onZoneDrawn,
  onBoundaryDrawn,
}) => {
  const map = useMap();
  const [drawingManager, setDrawingManager] =
    useState<google.maps.drawing.DrawingManager | null>(null);
  const [liveMeasurement, setLiveMeasurement] =
    useState<LiveMeasurement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const { toast } = useToast();
  const pathRef = useRef<LatLng[]>([]);

  useEffect(() => {
    if (!map) return;

    const isZoneDrawingTool = selectedTool === "zone";

    const dm = new google.maps.drawing.DrawingManager({
      map,
      drawingControl: false,
      drawingMode: null,

      // ENHANCED RECTANGLE OPTIONS
      rectangleOptions: {
        fillColor: isZoneDrawingTool ? "#8B5CF6" : "#FF6B35",
        fillOpacity: 0.25,
        strokeWeight: 4,
        strokeColor: isZoneDrawingTool ? "#8B5CF6" : "#FF6B35",
        strokeOpacity: 0.9,
        clickable: false,
        editable: false,
        zIndex: 10,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
      },

      // ENHANCED POLYGON OPTIONS
      polygonOptions: {
        fillColor: isZoneDrawingTool ? "#8B5CF6" : "#FF6B35",
        fillOpacity: 0.25,
        strokeWeight: 4,
        strokeColor: isZoneDrawingTool ? "#8B5CF6" : "#FF6B35",
        strokeOpacity: 0.9,
        clickable: false,
        editable: false,
        zIndex: 10,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
      },
    });

    setDrawingManager(dm);

    return () => {
      dm.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!drawingManager) return;

    const isBoundaryDrawingTool =
      selectedTool === "rectangle" ||
      selectedTool === "polygon" ||
      selectedTool === "freehand";
    const isZoneDrawingTool = selectedTool === "zone";

    let drawingMode = null;
    if (isBoundaryDrawingTool) {
      drawingMode =
        selectedTool === "rectangle"
          ? google.maps.drawing.OverlayType.RECTANGLE
          : google.maps.drawing.OverlayType.POLYGON;
    } else if (isZoneDrawingTool) {
      drawingMode = google.maps.drawing.OverlayType.POLYGON;
    }

    // Update colors dynamically based on tool
    const primaryColor = isZoneDrawingTool ? "#8B5CF6" : "#FF6B35";

    drawingManager.setOptions({
      polygonOptions: {
        fillColor: primaryColor,
        strokeColor: primaryColor,
        fillOpacity: 0.25,
        strokeWeight: 4,
        strokeOpacity: 0.9,
        clickable: false,
        editable: false,
        zIndex: 10,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
      },
      rectangleOptions: {
        fillColor: primaryColor,
        strokeColor: primaryColor,
        fillOpacity: 0.25,
        strokeWeight: 4,
        strokeOpacity: 0.9,
        clickable: false,
        editable: false,
        zIndex: 10,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
      },
    });

    drawingManager.setDrawingMode(drawingMode);
  }, [selectedTool, drawingManager]);

  useEffect(() => {
    if (!drawingManager) return;

    const onComplete = (
      overlay: google.maps.Rectangle | google.maps.Polygon
    ) => {
      let path: LatLng[], area: number;
      let type: Shape["type"];

      if (overlay instanceof google.maps.Rectangle) {
        const bounds = overlay.getBounds()!;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        path = [
          { lat: sw.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: ne.lng() },
        ];
        type = "rectangle";
      } else {
        // Polygon
        path = overlay
          .getPath()
          .getArray()
          .map((p) => ({ lat: p.lat(), lng: p.lng() }));
        type = selectedTool === "zone" ? "zone" : "polygon";
      }

      area = google.maps.geometry.spherical.computeArea(path);

      if (type === "zone") {
        onZoneDrawn(path, area);
      } else {
        // This is a boundary drawing tool
        const hasBoundary = shapes.some(
          (s) => !s.zoneMeta && !s.assetMeta && !s.bufferMeta
        );
        if (hasBoundary) {
          toast({
            variant: "destructive",
            title: "Boundary Exists",
            description:
              "Only one main project boundary can be drawn. Please clear the existing boundary first.",
          });
        } else {
          onBoundaryDrawn({ type, path, area });
        }
      }

      overlay.setMap(null);
      setSelectedTool("pan");
    };

    const rectListener = google.maps.event.addListener(
      drawingManager,
      "rectanglecomplete",
      onComplete
    );
    const polyListener = google.maps.event.addListener(
      drawingManager,
      "polygoncomplete",
      onComplete
    );

    return () => {
      google.maps.event.removeListener(rectListener);
      google.maps.event.removeListener(polyListener);
    };
  }, [
    drawingManager,
    setSelectedTool,
    selectedTool,
    onZoneDrawn,
    onBoundaryDrawn,
    shapes,
    toast,
  ]);

  return null;
};

const DrawnShapes: React.FC<{
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  onShapeRightClick: (
    shapeId: string,
    event: google.maps.MapMouseEvent
  ) => void;
  onShapeClick: (shapeId: string, isCtrlOrMeta: boolean) => void;
  selectedShapeIds: string[];
  editingShapeId: string | null;
  setEditingShapeId: (id: string | null) => void;
  movingShapeId: string | null;
  setMovingShapeId: (id: string | null) => void;
  selectedTool: Tool;
}> = ({
  shapes,
  setShapes,
  onShapeRightClick,
  onShapeClick,
  selectedShapeIds,
  editingShapeId,
  setEditingShapeId,
  movingShapeId,
  setMovingShapeId,
  selectedTool,
}) => {
  const map = useMap();
  const [polygons, setPolygons] = useState<{
    [id: string]: google.maps.Polygon[];
  }>({});
  const { toast } = useToast();
  const [hasShownMovePrompt, setHasShownMovePrompt] = useState(false);

  // Effect to create and manage polygon instances on the map
  useEffect(() => {
    if (!map) return;

    const newPolygons: { [id: string]: google.maps.Polygon[] } = {};
    const bufferedParentIds = new Set(
      shapes
        .filter((s) => s.bufferMeta)
        .map((s) => s.bufferMeta!.originalShapeId)
    );

    shapes.forEach((shape) => {
      const path = shape.path;

      const isEditing = shape.id === editingShapeId;
      const isMoving = shape.id === movingShapeId;
      const isSelected = selectedShapeIds.includes(shape.id);
      const isAsset = !!shape.assetMeta;

      const polyOptions = getEnhancedShapeStyle(
        shape,
        isSelected,
        isEditing,
        isMoving,
        bufferedParentIds,
        selectedTool
      );

      const shapePolys: google.maps.Polygon[] = [];

      const mainPoly = new google.maps.Polygon({
        paths: path,
        map: map,
        ...polyOptions,
      });
      shapePolys.push(mainPoly);

      // --- NEW: Add wall effect for buildings ---
      if (
        isAsset &&
        shape.assetMeta?.assetType !== "solar_panel" &&
        polyOptions.strokeWeight
      ) {
        const wallPoly = new google.maps.Polygon({
          paths: path,
          map: map,
          fillOpacity: 0,
          strokeColor: "#CBAA89", // Lighter brown/beige for walls
          strokeWeight: polyOptions.strokeWeight + 1, // Slightly thicker
          strokeOpacity: 0.8,
          zIndex: polyOptions.zIndex - 1, // Draw behind the roof
          clickable: false,
        });
        shapePolys.push(wallPoly);
      }

      // Create glow effect for selected shapes
      if (isSelected && !polyOptions.icons) {
        const glowPoly = new google.maps.Polygon({
          paths: path,
          map: map,
          strokeColor: "#FFFFFF",
          strokeWeight: (polyOptions.strokeWeight || 3) + 4,
          strokeOpacity: 0.3,
          fillOpacity: 0,
          zIndex: (polyOptions.zIndex || 1) - 1,
          clickable: false,
        });
        shapePolys.push(glowPoly);
      }

      mainPoly.addListener("rightclick", (e: google.maps.MapMouseEvent) =>
        onShapeRightClick(shape.id, e)
      );
      mainPoly.addListener("click", (e: google.maps.MapMouseEvent) => {
        const mouseEvent = e.domEvent as MouseEvent;
        onShapeClick(shape.id, mouseEvent.ctrlKey || mouseEvent.metaKey);

        if (editingShapeId && editingShapeId !== shape.id) {
          setEditingShapeId(null);
        }
      });

      mainPoly.addListener("dblclick", () => {
        if (!!shape.bufferMeta || isAsset) {
          toast({ title: "This shape cannot be moved or edited directly." });
          return;
        }
        setEditingShapeId(null);
        setMovingShapeId(shape.id);
        if (!hasShownMovePrompt) {
          toast({
            title: "Shape is now movable",
            description:
              "Click and drag to move the shape. Click the map to stop moving.",
          });
          setHasShownMovePrompt(true);
        }
      });

      if (isEditing) {
        const path = mainPoly.getPath();
        google.maps.event.addListener(path, "set_at", () =>
          updateShape(shape.id, mainPoly)
        );
        google.maps.event.addListener(path, "insert_at", () =>
          updateShape(shape.id, mainPoly)
        );
      }

      if (isMoving) {
        mainPoly.addListener("dragend", () => {
          updateShape(shape.id, mainPoly);
        });
      }

      newPolygons[shape.id] = shapePolys;
    });

    // Clean up polygons that are no longer in the shapes array
    Object.keys(polygons).forEach((id) => {
      if (!newPolygons[id]) {
        polygons[id].forEach((p) => {
          google.maps.event.clearInstanceListeners(p);
          p.setMap(null);
        });
      }
    });

    setPolygons(newPolygons);

    return () => {
      Object.values(newPolygons).forEach((polyArray) => {
        polyArray.forEach((p) => {
          google.maps.event.clearInstanceListeners(p);
          p.setMap(null);
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, map, editingShapeId, movingShapeId, selectedShapeIds]);

  // Effect to update the editable/draggable properties of polygons when editing/moving state changes
  useEffect(() => {
    Object.entries(polygons).forEach(([id, polyArray]) => {
      const mainPoly = polyArray[0];
      if (!mainPoly) return;

      const isEditing = id === editingShapeId;
      const isMoving = id === movingShapeId;
      const shape = shapes.find((s) => s.id === id);

      const shouldBeEditable =
        isEditing && !shape?.bufferMeta && !shape?.assetMeta;
      const shouldBeDraggable =
        isMoving && !shape?.bufferMeta && !shape?.assetMeta;

      if (mainPoly.getEditable() !== shouldBeEditable) {
        mainPoly.setEditable(shouldBeEditable);
      }
      if (mainPoly.getDraggable() !== shouldBeDraggable) {
        mainPoly.setDraggable(shouldBeDraggable);
      }
    });
  }, [editingShapeId, movingShapeId, polygons, shapes]);

  // New effect to control clickable state based on selected tool
  useEffect(() => {
    Object.entries(polygons).forEach(([id, polyArray]) => {
      const mainPoly = polyArray[0];
      if (!mainPoly) return;

      mainPoly.setOptions({ clickable: selectedTool === "pan" });
    });
  }, [selectedTool, polygons]);

  const updateShape = (id: string, poly: google.maps.Polygon) => {
    const newPath = poly
      .getPath()
      .getArray()
      .map((p) => ({ lat: p.lat(), lng: p.lng() }));
    const newArea = google.maps.geometry.spherical.computeArea(newPath);

    setShapes((prev) => {
      const newShapes = prev.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            path: newPath,
            area: newArea,
          };
        }
        return s;
      });

      // Now, find any buffers that depended on this shape and update them
      return newShapes.map((s) => {
        if (s.bufferMeta?.originalShapeId === id) {
          const originalShape = newShapes.find((os) => os.id === id);
          if (!originalShape) return s; // Should not happen
          const buffered = applyBuffer(originalShape, s.bufferMeta.distance);
          return { ...s, path: buffered.path, area: buffered.area };
        }
        return s;
      });
    });
  };

  return null;
};

const ElevationGridDisplay: React.FC<{
  elevationGrid: ElevationGrid | null;
  steepnessThreshold: number;
}> = ({ elevationGrid, steepnessThreshold }) => {
  const map = useMap();
  const [gridPolygons, setGridPolygons] = useState<google.maps.Polygon[]>([]);
  const [activeCell, setActiveCell] = useState<ElevationGridCell | null>(null);

  useEffect(() => {
    // Clear existing polygons
    gridPolygons.forEach((poly) => {
      google.maps.event.clearInstanceListeners(poly);
      poly.setMap(null);
    });
    setGridPolygons([]); // Reset state

    if (!map || !elevationGrid || !elevationGrid.cells) {
      return;
    }

    const newPolys = elevationGrid.cells.map((cell) => {
      const isValid = isFinite(cell.slope);
      const isSteep = isValid && cell.slope > steepnessThreshold;

      let fillColor = "#808080"; // Grey for invalid data
      let strokeColor = "#606060";
      if (isValid) {
        fillColor = isSteep ? "#ef4444" : "#22c55e";
        strokeColor = isSteep ? "#dc2626" : "#16a34a";
      }

      const poly = new google.maps.Polygon({
        map,
        paths: cell.path,
        fillColor,
        strokeColor,
        fillOpacity: 0.45,
        strokeWeight: 0.5,
        strokeOpacity: 0.6,
        clickable: true,
        zIndex: 2, // Ensure grid is above boundary but below zones/assets
      });

      poly.addListener("click", () => {
        setActiveCell(cell);
      });

      return poly;
    });

    setGridPolygons(newPolys);

    return () => {
      newPolys.forEach((poly) => {
        google.maps.event.clearInstanceListeners(poly);
        poly.setMap(null);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, elevationGrid, steepnessThreshold]);

  const handleInfoWindowClose = () => {
    setActiveCell(null);
  };

  return (
    <>
      {activeCell && (
        <InfoWindow
          position={activeCell.center}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="text-center p-1">
            {isFinite(activeCell.slope) ? (
              <>
                <p className="text-lg font-bold">
                  {activeCell.slope.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Steepness</p>
              </>
            ) : (
              <p className="text-sm font-medium">No data</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const FreehandDrawingTool: React.FC<{
  onDrawEnd: (path: LatLng[]) => void;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
  measurementConfig?: MeasurementConfig;
}> = ({ onDrawEnd, setSelectedTool, shapes, measurementConfig }) => {
  const map = useMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const pathRef = useRef<LatLng[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [liveMeasurement, setLiveMeasurement] =
    useState<LiveMeasurement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const { toast } = useToast();

  useEffect(() => {
    if (!map) return;

    const onMouseDown = (e: google.maps.MapMouseEvent) => {
      // Prevent drawing a boundary if one already exists
      const hasBoundary = shapes.some(
        (s) => !s.zoneMeta && !s.assetMeta && !s.bufferMeta
      );
      if (hasBoundary) {
        toast({
          variant: "destructive",
          title: "Boundary Exists",
          description:
            "Only one main project boundary can be drawn. Please clear the existing boundary first.",
        });
        setSelectedTool("pan");
        return;
      }

      setIsDrawing(true);
      pathRef.current = [];
      if (e.latLng) {
        pathRef.current.push(e.latLng.toJSON());
      }

      // ENHANCED VISUAL FEEDBACK - Much more visible drawing line
      polylineRef.current = new google.maps.Polyline({
        map,
        path: pathRef.current,
        strokeColor: "#FF6B35", // Vibrant orange
        strokeWeight: 4, // Thick line
        strokeOpacity: 0.9,
        zIndex: 1000, // On top of everything
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              strokeOpacity: 1,
              strokeWeight: 1,
              strokeColor: "#FF6B35",
              fillColor: "#FF6B35",
              fillOpacity: 1,
              scale: 2,
            },
            offset: "0",
            repeat: "12px",
          },
        ],
      });
    };

    const onMouseMove = (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;

      pathRef.current.push(e.latLng.toJSON());

      // Calculate live measurements
      if (pathRef.current.length > 2) {
        const area = MeasurementService.calculateArea(
          pathRef.current,
          measurementConfig?.units || "imperial"
        );
        const perimeter = MeasurementService.calculatePerimeter(
          pathRef.current,
          measurementConfig?.units || "imperial"
        );

        setLiveMeasurement({
          area,
          perimeter,
          units: measurementConfig?.units || "imperial",
          precision: measurementConfig?.precision ?? 2,
          displayPosition: { x: 0, y: 0 }, // Will be updated below
        });

        // Update cursor position for overlay
        const projection = map.getProjection();
        if (projection) {
          const point = projection.fromLatLngToPoint(e.latLng);
          if (point) {
            setCursorPosition({ x: point.x, y: point.y });
          }
        }
      }

      // Update the polyline with enhanced styling
      if (polylineRef.current) {
        const newPath = [...pathRef.current];
        polylineRef.current.setPath(newPath);

        // Add visual feedback for drawing progress
        polylineRef.current.setOptions({
          strokeWeight: 4 + Math.min(pathRef.current.length / 50, 2), // Gets slightly thicker as you draw
          strokeOpacity: 0.8 + Math.min(pathRef.current.length / 200, 0.2), // Gets more opaque
        });
      }
    };

    const onMouseUp = () => {
      if (!isDrawing || pathRef.current.length < 3) {
        setIsDrawing(false);
        polylineRef.current?.setMap(null);

        if (pathRef.current.length > 0 && pathRef.current.length < 3) {
          toast({
            title: "Draw a larger area",
            description:
              "Click and drag to draw a boundary with at least 3 points.",
          });
        }
        return;
      }

      // Smooth the path for better visual results
      const smoothedPath = smoothPath(pathRef.current);
      onDrawEnd(smoothedPath);

      setIsDrawing(false);
      pathRef.current = [];
      polylineRef.current?.setMap(null);
      setSelectedTool("pan");

      toast({
        title: "Boundary drawn",
        description: "Your site boundary has been created successfully.",
      });
    };

    // Enhanced event handling with better UX
    const downListener = map.addListener("mousedown", onMouseDown);
    const moveListener = map.addListener("mousemove", onMouseMove);
    const upListener = map.addListener("mouseup", onMouseUp);

    // Add escape key to cancel drawing
    const keyListener = google.maps.event.addDomListener(
      window,
      "keydown",
      (e: KeyboardEvent) => {
        if (e.key === "Escape" && isDrawing) {
          setIsDrawing(false);
          pathRef.current = [];
          polylineRef.current?.setMap(null);
          setSelectedTool("pan");
          toast({
            title: "Drawing cancelled",
            description: "Press and hold to draw your boundary.",
          });
        }
      }
    );

    return () => {
      downListener.remove();
      moveListener.remove();
      upListener.remove();
      google.maps.event.removeListener(keyListener);
      polylineRef.current?.setMap(null);
    };
  }, [map, isDrawing, onDrawEnd, setSelectedTool, shapes, toast]);

  return (
    <>
      {liveMeasurement && (
        <MeasurementOverlay
          measurements={liveMeasurement}
          position={cursorPosition}
          config={
            measurementConfig || {
              units: "imperial",
              precision: 2,
              showArea: true,
              showPerimeter: true,
              showVertexCount: false,
            }
          }
          visible={isDrawing}
        />
      )}
    </>
  );
};

const OpenStreetMapLayer = () => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // This tile server provides labels with a transparent background
    const osmMapType = new google.maps.ImageMapType({
      getTileUrl: function (coord, zoom) {
        return `https://tiles.wmflabs.org/osm-no-labels/${zoom}/${coord.x}/${coord.y}.png`;
      },
      tileSize: new google.maps.Size(256, 256),
      name: "OpenStreetMap Labels",
      maxZoom: 18,
    });

    map.overlayMapTypes.insertAt(0, osmMapType);
    return () => {
      // This is a bit tricky, but we try to remove it.
      // A more robust solution might involve managing the overlay types array more carefully.
      if (map && map.overlayMapTypes) {
        for (let i = 0; i < map.overlayMapTypes.getLength(); i++) {
          const mt = map.overlayMapTypes.getAt(i);
          if (mt && mt.name === "OpenStreetMap Labels") {
            map.overlayMapTypes.removeAt(i);
            break;
          }
        }
      }
    };
  }, [map]);
  return null;
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
  selectedTool,
  shapes,
  setShapes,
  setSelectedTool,
  steepnessThreshold,
  elevationGrid,
  isAnalysisVisible,
  selectedShapeIds,
  setSelectedShapeIds,
  onBoundaryDrawn,
  onAutoSave,
  measurementConfig,
  mapProvider,
  setMapProvider,
  layerVisibility,
  setLayerVisibility,
  className,
  viewState,
  onCameraChanged,
  annotations,
  setAnnotations,
}) => {
  const isLoaded = useApiIsLoaded();
  const map = useMap();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<string | null>(null);
  const { toast } = useToast();
  const [bufferState, setBufferState] = useState<BufferState>({
    isOpen: false,
    shapeId: null,
  });
  const [zoneDialogState, setZoneDialogState] = useState<ZoneDialogState>({
    isOpen: false,
    path: null,
    area: null,
  });

  const overlays = useMemo((): LayerOverlay[] => {
    return [
      {
        id: "annotations",
        name: "Annotations",
        visible: layerVisibility["annotations"] ?? true,
        opacity: 1,
        type: "annotations",
      },
    ];
  }, [layerVisibility]);

  const isInteractingWithShape = !!editingShapeId || !!movingShapeId;
  const isDrawing = ["rectangle", "polygon", "freehand", "zone"].includes(
    selectedTool
  );

  const projectBoundary = shapes.find(
    (s) => !s.bufferMeta && !s.zoneMeta && !s.assetMeta
  );

  useEffect(() => {
    if (map) {
      let cursor = "grab";
      if (
        selectedTool === "freehand" ||
        selectedTool === "rectangle" ||
        selectedTool === "polygon" ||
        selectedTool === "zone"
      )
        cursor = "crosshair";
      if (selectedTool === "asset") cursor = "copy";
      map.setOptions({ draggableCursor: cursor });
    }
  }, [map, selectedTool]);

  const handleShapeRightClick = useCallback(
    (shapeId: string, event: google.maps.MapMouseEvent) => {
      if (!map || !event.domEvent) return;
      event.domEvent.preventDefault();
      event.domEvent.stopPropagation();

      // Stop editing/moving other shapes when opening context menu
      setEditingShapeId(null);
      setMovingShapeId(null);

      // If the right-clicked shape is not part of the current selection,
      // make it the only selected shape.
      if (!selectedShapeIds.includes(shapeId)) {
        setSelectedShapeIds([shapeId]);
      }

      const projection = map.getProjection();
      if (!projection) return;

      const scale = Math.pow(2, map.getZoom()!);
      const bounds = map.getBounds();
      if (!bounds) return;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const nw = new google.maps.LatLng(ne.lat(), sw.lng());

      const worldPoint = projection.fromLatLngToPoint(event.latLng!);
      const mapTopLeft = projection.fromLatLngToPoint(nw)!;

      if (!worldPoint || !mapTopLeft) return;

      setContextMenu({
        shapeId: shapeId,
        position: {
          x: (worldPoint.x - mapTopLeft.x) * scale,
          y: (worldPoint.y - mapTopLeft.y) * scale,
        },
      });
    },
    [map, selectedShapeIds, setSelectedShapeIds]
  );

  const handleShapeClick = (shapeId: string, isCtrlOrMeta: boolean) => {
    if (selectedTool !== "pan") return;

    if (isCtrlOrMeta) {
      // Add or remove from selection
      setSelectedShapeIds(
        selectedShapeIds.includes(shapeId)
          ? selectedShapeIds.filter((id) => id !== shapeId)
          : [...selectedShapeIds, shapeId]
      );
    } else {
      // Set as the only selection
      setSelectedShapeIds([shapeId]);
    }
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteShape = (shapeId: string) => {
    // Delete all selected shapes
    setShapes((prev) => prev.filter((s) => !selectedShapeIds.includes(s.id)));
    setSelectedShapeIds([]);
    if (editingShapeId === shapeId) setEditingShapeId(null);
    if (movingShapeId === shapeId) setMovingShapeId(null);
    closeContextMenu();
  };

  const handleEditShape = (shapeId: string) => {
    setSelectedShapeIds([shapeId]);
    setMovingShapeId(null);
    setEditingShapeId(shapeId);
    closeContextMenu();
  };

  const handleBufferShape = (shapeId: string) => {
    setBufferState({ isOpen: true, shapeId });
    closeContextMenu();
  };

  const handleCreateBuffer = (distance: number) => {
    if (!bufferState.shapeId) return;

    const originalShape = shapes.find((s) => s.id === bufferState.shapeId);
    if (!originalShape) return;

    try {
      const bufferedShape = applyBuffer(originalShape, -distance); // negative for inward buffer

      setShapes((prev) => [
        ...prev,
        {
          id: uuid(),
          type: "buffer",
          path: bufferedShape.path,
          area: bufferedShape.area,
          bufferMeta: {
            originalShapeId: originalShape.id,
            distance: -distance,
          },
        },
      ]);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Buffer Error",
        description:
          e.message ||
          "Could not create buffer. The distance may be too large.",
      });
    }
  };

  const handleZoneDrawn = useCallback(
    (path: LatLng[], area: number) => {
      if (!projectBoundary) return;

      const toTurfCoords = (p: LatLng[]) => {
        const coords = p.map((point) => [point.lng, point.lat]);
        if (
          coords.length > 0 &&
          (coords[0][0] !== coords[coords.length - 1][0] ||
            coords[0][1] !== coords[coords.length - 1][1])
        ) {
          coords.push(coords[0]);
        }
        return coords;
      };

      const turfZone = turf.polygon([toTurfCoords(path)]);
      const turfBoundary = turf.polygon([toTurfCoords(projectBoundary.path)]);

      // Simple containment check - zone should be within boundary
      if (false) {
        // Temporarily disabled for testing
        toast({
          variant: "destructive",
          title: "Invalid Zone",
          description:
            "Zones must be drawn completely inside the main site boundary.",
        });
        return;
      }

      setZoneDialogState({ isOpen: true, path, area });
    },
    [projectBoundary, toast]
  );

  const handleCreateZone = useCallback(
    async (
      name: string,
      kind: "residential" | "commercial" | "green_space" | "amenity" | "solar"
    ) => {
      if (!zoneDialogState.path || !zoneDialogState.area) return;
      const newZone: Shape = {
        id: uuid(),
        type: "zone",
        path: zoneDialogState.path,
        area: zoneDialogState.area,
        zoneMeta: { name, kind },
      };
      setShapes((prev) => [...prev, newZone]);
      setZoneDialogState({ isOpen: false, path: null, area: null });
      setSelectedShapeIds([newZone.id]);
      // Auto-save after zone creation
      if (onAutoSave) {
        onAutoSave();
      }
    },
    [zoneDialogState, setShapes, setSelectedShapeIds, onAutoSave]
  );

  const handleFreehandDrawEnd = (path: LatLng[]) => {
    const area = google.maps.geometry.spherical.computeArea(path);
    onBoundaryDrawn({ type: "freehand", path, area });
  };

  // Annotation handlers
  const handleAnnotationCreate = useCallback(
    (annotation: Annotation) => {
      setAnnotations((prev) => [...prev, annotation]);
      if (onAutoSave) {
        onAutoSave();
      }
    },
    [setAnnotations, onAutoSave]
  );

  const handleAnnotationClick = useCallback((annotation: Annotation) => {
    // Handle annotation click - could show edit dialog or select annotation
    console.log("Annotation clicked:", annotation);
  }, []);

  const handleAnnotationEdit = useCallback((annotation: Annotation) => {
    // Handle annotation edit - could open edit dialog
    console.log("Annotation edit:", annotation);
  }, []);

  const handleAnnotationDelete = useCallback(
    (annotationId: string) => {
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      if (onAutoSave) {
        onAutoSave();
      }
    },
    [setAnnotations, onAutoSave]
  );

  const handleAnnotationFinish = useCallback(() => {
    setSelectedTool("pan");
  }, [setSelectedTool]);

  useEffect(() => {
    const handleClickOutside = (e: google.maps.MapMouseEvent) => {
      if (selectedTool === "pan" && !isInteractingWithShape) {
        closeContextMenu();
        setEditingShapeId(null); // Stop editing when clicking the map
        setMovingShapeId(null); // Stop moving when clicking the map
        setSelectedShapeIds([]); // Deselect all shapes
      }

      if (selectedTool === "asset" && e.latLng) {
        if (!projectBoundary) {
          toast({
            variant: "destructive",
            title: "Action Required",
            description:
              "Please define a site boundary before placing buildings.",
          });
          return;
        }

        const boundaryPoly = new google.maps.Polygon({
          paths: projectBoundary.path,
        });
        if (
          !google.maps.geometry.poly.containsLocation(e.latLng, boundaryPoly)
        ) {
          toast({
            variant: "destructive",
            title: "Invalid Placement",
            description:
              "Buildings can only be placed inside the defined site boundary.",
          });
          return;
        }

        // This is a simplified asset placement. A real implementation would have a modal to select asset type.
        const assetSize = 10; // meters
        const center = e.latLng.toJSON();
        const halfSize = assetSize / 111320; // ~meters to degrees

        const path: LatLng[] = [
          { lat: center.lat - halfSize, lng: center.lng - halfSize },
          { lat: center.lat + halfSize, lng: center.lng - halfSize },
          { lat: center.lat + halfSize, lng: center.lng + halfSize },
          { lat: center.lat - halfSize, lng: center.lng + halfSize },
        ];

        // Zone validation
        const zones = shapes
          .filter(
            (s): s is Shape & { zoneMeta: NonNullable<Shape["zoneMeta"]> } =>
              !!s.zoneMeta
          )
          .map((s) => ({
            ring: s.path as PolygonRing,
            kind: s.zoneMeta!.kind as ZoneKind,
          }));

        const validation = validateBuildingPlacement(
          path as PolygonRing,
          "house_detached", // hardcoded for now
          zones
        );

        console.log("Building placement validation:", validation); // Logging

        if (!validation.isValid) {
          toast({
            variant: "destructive",
            title: "Invalid Zone Placement",
            description: validation.reasons.join(" "),
          });
          return;
        }

        setShapes((prev) => [
          ...prev,
          {
            id: uuid(),
            type: "rectangle", // Visually it's a rect, but meta identifies it as an asset
            path,
            area: google.maps.geometry.spherical.computeArea(path),
            assetMeta: {
              assetType: "building",
              key: "house_detached",
              floors: 2,
              rotation: 0,
            },
          },
        ]);
        // Auto-save after asset placement
        if (onAutoSave) {
          onAutoSave();
        }
        return;
      }
    };

    if (map) {
      const clickListener = map.addListener("click", handleClickOutside);
      const dragListener = map.addListener("dragstart", closeContextMenu);
      return () => {
        clickListener.remove();
        dragListener.remove();
      };
    }
  }, [
    map,
    closeContextMenu,
    setSelectedShapeIds,
    selectedTool,
    setShapes,
    projectBoundary,
    toast,
    isInteractingWithShape,
  ]);

  return (
    <div className={className ?? "relative w-full h-full"}>
      <MapProviderManager
        activeProvider={mapProvider}
        onProviderChange={setMapProvider}
      >
        <Map
          center={{ lat: viewState.latitude, lng: viewState.longitude }}
          zoom={viewState.zoom}
          onCameraChanged={onCameraChanged}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          mapTypeId="satellite"
          tilt={0}
          gestureHandling={
            !isDrawing && !isInteractingWithShape ? "greedy" : "none"
          }
          zoomControl={!isDrawing && !isInteractingWithShape}
          disableDoubleClickZoom={isDrawing || isInteractingWithShape}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          className="w-full h-full"
        >
          {isLoaded && (
            <DrawingManagerComponent
              selectedTool={selectedTool}
              shapes={shapes}
              setSelectedTool={setSelectedTool}
              measurementConfig={
                measurementConfig || {
                  units: "imperial",
                  precision: 2,
                  showArea: true,
                  showPerimeter: true,
                  showVertexCount: false,
                }
              }
              onZoneDrawn={handleZoneDrawn}
              onBoundaryDrawn={onBoundaryDrawn}
            />
          )}
          {isLoaded && selectedTool === "freehand" && (
            <FreehandDrawingTool
              shapes={shapes}
              onDrawEnd={handleFreehandDrawEnd}
              setSelectedTool={setSelectedTool}
              measurementConfig={
                measurementConfig || {
                  units: "imperial",
                  precision: 2,
                  showArea: true,
                  showPerimeter: true,
                  showVertexCount: false,
                }
              }
            />
          )}
          {isLoaded && (
            <DrawnShapes
              shapes={shapes}
              setShapes={setShapes}
              onShapeRightClick={handleShapeRightClick}
              onShapeClick={handleShapeClick}
              selectedShapeIds={selectedShapeIds}
              editingShapeId={editingShapeId}
              setEditingShapeId={setEditingShapeId}
              movingShapeId={movingShapeId}
              setMovingShapeId={setMovingShapeId}
              selectedTool={selectedTool}
            />
          )}
          {isLoaded &&
            elevationGrid &&
            isAnalysisVisible &&
            (layerVisibility["elevation"] ?? true) && (
              <ElevationGridDisplay
                elevationGrid={elevationGrid}
                steepnessThreshold={steepnessThreshold}
              />
            )}
          {isLoaded && projectBoundary && (
            <SiteMarker boundary={projectBoundary} />
          )}
          {isLoaded && selectedTool === "annotate" && (
            <AnnotationTool
              mode="text"
              onAnnotationCreate={(annotation) => {
                setAnnotations((prev) => [...prev, annotation]);
                setSelectedTool("pan");
              }}
              selectedShapes={shapes.filter((s) =>
                selectedShapeIds.includes(s.id)
              )}
              onFinish={() => setSelectedTool("pan")}
            />
          )}
          {isLoaded && (
            <AnnotationOverlay
              annotations={annotations}
              onAnnotationClick={(annotation) => {
                // Handle annotation click if needed
              }}
              onAnnotationEdit={(annotation) => {
                // Handle annotation edit if needed
              }}
              onAnnotationDelete={(annotationId) => {
                setAnnotations((prev) =>
                  prev.filter((a) => a.id !== annotationId)
                );
              }}
            />
          )}
          {isLoaded && layerVisibility["local-authorities"] && (
            <LocalAuthorityLayer
              visible={layerVisibility["local-authorities"]}
              opacity={0.3}
              onAuthorityClick={(authority) => {
                console.log("Local authority clicked:", authority);
              }}
              onAuthorityHover={(authority) => {
                // Handle hover events if needed
              }}
            />
          )}
        </Map>
      </MapProviderManager>
      {contextMenu && (
        <ShapeContextMenu
          position={contextMenu.position}
          shapeId={contextMenu.shapeId}
          shapes={shapes}
          onDelete={handleDeleteShape}
          onEdit={handleEditShape}
          onBuffer={handleBufferShape}
          onClose={closeContextMenu}
        />
      )}

      <BufferDialog
        state={bufferState}
        onOpenChange={(isOpen) =>
          setBufferState((prev) => ({ ...prev, isOpen }))
        }
        onCreateBuffer={handleCreateBuffer}
      />
      <ZoneDialog
        state={zoneDialogState}
        onOpenChange={(isOpen) =>
          setZoneDialogState((prev) => ({ ...prev, isOpen }))
        }
        onCreateZone={handleCreateZone}
      />
    </div>
  );
};
