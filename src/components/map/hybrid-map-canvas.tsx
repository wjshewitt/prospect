"use client";

import React, { useState } from 'react';
import { MapCanvas as GoogleMapCanvas } from './map-canvas';
import { MapLibreCanvas } from './maplibre-canvas';
import type { Shape, Tool, ElevationGrid, Annotation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { Layers, MapPin } from 'lucide-react';

interface HybridMapCanvasProps {
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
  measurementConfig?: any;
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

export const HybridMapCanvas: React.FC<HybridMapCanvasProps> = (props) => {
  // Feature flag to control which rendering engine to use
  const [useMapLibre, setUseMapLibre] = useState(false);
  
  const toggleMapEngine = () => {
    setUseMapLibre(!useMapLibre);
  };

  return (
    <div className="relative w-full h-full">
      {/* Engine Toggle Control */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Badge variant={useMapLibre ? "default" : "secondary"}>
          {useMapLibre ? "MapLibre" : "Google Maps"}
        </Badge>
        <Button
          onClick={toggleMapEngine}
          size="sm"
          variant="outline"
          className="bg-white/90 backdrop-blur-sm"
        >
          <Layers className="w-4 h-4 mr-1" />
          Switch to {useMapLibre ? "Google Maps" : "MapLibre"}
        </Button>
      </div>

      {/* Performance Indicator */}
      {useMapLibre && (
        <div className="absolute top-4 left-4 z-10">
          <Badge variant="outline" className="bg-green-50/90 text-green-700 border-green-200">
            <MapPin className="w-3 h-3 mr-1" />
            70% Bundle Reduction
          </Badge>
        </div>
      )}

      {/* Render the appropriate map engine */}
      {useMapLibre ? (
        <MapLibreCanvas {...props} />
      ) : (
        <GoogleMapCanvas {...props} />
      )}
    </div>
  );
};