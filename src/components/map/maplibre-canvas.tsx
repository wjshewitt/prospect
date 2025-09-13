"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
import { ShapeContextMenu } from "./shape-context-menu";
import { useToast } from "@/hooks/use-toast";
import { BufferDialog, type BufferState } from "./buffer-dialog";
import { ZoneDialog, type ZoneDialogState } from "./zone-dialog";
import { applyBuffer } from "@/services/buffer";
import { SiteMarker } from "./site-marker";
import { LayerControl } from "./layer-control";
import { AnnotationTool } from "../annotation/annotation-tool";
import { AnnotationOverlay } from "../annotation/annotation-overlay";
import { LocalAuthorityLayer } from "./local-authority-layer";

// MapLibre imports
import { MapLibreProvider, useMapLibre } from "@/core/mapping/MapLibreProvider";
import { DrawingManager } from "@/core/mapping/DrawingManager";
import { LayerManager } from "@/core/mapping/LayerManager";

interface MapLibreCanvasProps {
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
  onCameraChanged: (e: any) => void;
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

const MapLibreCanvasInner: React.FC<MapLibreCanvasProps> = ({
  shapes,
  setShapes,
  selectedTool,
  setSelectedTool,
  selectedShapeIds,
  setSelectedShapeIds,
  onBoundaryDrawn,
  viewState,
  onCameraChanged,
  measurementConfig,
  layerVisibility,
  annotations,
  setAnnotations,
}) => {
  const { map, isLoaded } = useMapLibre();
  const { toast } = useToast();
  
  // State management
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [bufferDialog, setBufferDialog] = useState<BufferState | null>(null);
  const [zoneDialog, setZoneDialog] = useState<ZoneDialogState | null>(null);
  const [liveMeasurement, setLiveMeasurement] = useState<LiveMeasurement | null>(null);

  // Callbacks
  const handleShapeComplete = useCallback((shape: Shape) => {
    const newShape = {
      ...shape,
      id: uuid(),
    };
    setShapes(prev => [...prev, newShape]);
    
    if (selectedTool === 'boundary') {
      onBoundaryDrawn(newShape);
    }
    
    // Auto-switch back to select tool after drawing
    setSelectedTool('select');
  }, [setShapes, selectedTool, onBoundaryDrawn, setSelectedTool]);

  const handleShapeSelect = useCallback((shapeId: string) => {
    setSelectedShapeIds([shapeId]);
  }, [setSelectedShapeIds]);

  const handleShapeClick = useCallback((shapeId: string) => {
    if (selectedTool === 'select') {
      handleShapeSelect(shapeId);
    }
  }, [selectedTool, handleShapeSelect]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle camera changes
  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleMove = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      onCameraChanged({
        detail: {
          center: { lat: center.lat, lng: center.lng },
          zoom,
        },
      });
    };

    map.on('move', handleMove);
    return () => {
      map.off('move', handleMove);
    };
  }, [map, isLoaded, onCameraChanged]);

  // Layer overlays for measurements, annotations, etc.
  const layerOverlays: LayerOverlay[] = useMemo(() => {
    return Object.entries(layerVisibility)
      .filter(([, visible]) => visible)
      .map(([id]) => ({
        id,
        visible: true,
        type: 'vector', // Default type
      }));
  }, [layerVisibility]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading map...</div>
      </div>
    );
  }

  return (
    <>
      <DrawingManager
        selectedTool={selectedTool}
        onShapeComplete={handleShapeComplete}
        shapes={shapes}
        selectedShapeIds={selectedShapeIds}
        onShapeSelect={handleShapeSelect}
      />
      
      <LayerManager
        shapes={shapes}
        selectedShapeIds={selectedShapeIds}
        overlays={layerOverlays}
        onShapeClick={handleShapeClick}
      />

      {measurementConfig && (
        <MeasurementOverlay
          liveMeasurement={liveMeasurement}
          config={measurementConfig}
        />
      )}

      <AnnotationOverlay annotations={annotations} />

      {contextMenu && (
        <ShapeContextMenu
          shapeId={contextMenu.shapeId}
          position={contextMenu.position}
          onClose={closeContextMenu}
          onEdit={() => {
            // Handle edit
            closeContextMenu();
          }}
          onDelete={() => {
            setShapes(prev => prev.filter(s => s.id !== contextMenu.shapeId));
            closeContextMenu();
          }}
          onBuffer={() => {
            setBufferDialog({
              shapeId: contextMenu.shapeId,
              distance: 10,
              isOpen: true,
            });
            closeContextMenu();
          }}
          onZone={() => {
            setZoneDialog({
              shapeId: contextMenu.shapeId,
              zoneKind: 'residential',
              isOpen: true,
            });
            closeContextMenu();
          }}
        />
      )}

      {bufferDialog && (
        <BufferDialog
          isOpen={bufferDialog.isOpen}
          shapeId={bufferDialog.shapeId}
          distance={bufferDialog.distance}
          onConfirm={(distance) => {
            const shape = shapes.find(s => s.id === bufferDialog.shapeId);
            if (shape) {
              const buffered = applyBuffer(shape, distance);
              if (buffered) {
                setShapes(prev => [...prev, buffered]);
              }
            }
            setBufferDialog(null);
          }}
          onCancel={() => setBufferDialog(null)}
        />
      )}

      {zoneDialog && (
        <ZoneDialog
          isOpen={zoneDialog.isOpen}
          shapeId={zoneDialog.shapeId}
          zoneKind={zoneDialog.zoneKind}
          onConfirm={(zoneKind) => {
            // Handle zone creation
            setZoneDialog(null);
          }}
          onCancel={() => setZoneDialog(null)}
        />
      )}
    </>
  );
};

export const MapLibreCanvas: React.FC<MapLibreCanvasProps> = (props) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={mapContainerRef} className={props.className ?? "relative w-full h-full"}>
      <MapLibreProvider
        containerRef={mapContainerRef}
        center={[props.viewState.longitude, props.viewState.latitude]}
        zoom={props.viewState.zoom}
      >
        <MapLibreCanvasInner {...props} />
        
        <LayerControl
          layerVisibility={props.layerVisibility}
          setLayerVisibility={props.setLayerVisibility}
        />
        
        <AnnotationTool
          selectedTool={props.selectedTool}
          annotations={props.annotations}
          setAnnotations={props.setAnnotations}
        />
      </MapLibreProvider>
    </div>
  );
};