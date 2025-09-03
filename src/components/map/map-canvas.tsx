'use client';

import React from 'react';
import {Map} from '@vis.gl/react-google-maps';
import {DrawingOverlay} from './drawing-overlay';

type Tool = 'pan' | 'rectangle' | 'polygon';

export type LatLng = google.maps.LatLngLiteral;
export type Bounds = google.maps.LatLngBoundsLiteral;

export type RectangleShape = {id: string; type: 'rectangle'; bounds: Bounds};
export type PolygonShape = {id: string; type: 'polygon'; path: LatLng[]};
export type Shape = RectangleShape | PolygonShape;

interface MapCanvasProps {
  selectedTool: Tool;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  // You likely already pass other Map props (center, zoom, mapId, etc.) higher up.
  // Keep them as-is. If you need to forward them, add to this interface and spread on <Map />.
  className?: string;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  selectedTool,
  shapes,
  setShapes,
  className,
}) => {
  const isPanMode = selectedTool === 'pan';

  return (
    <div className={className ?? 'relative w-full h-full'}>
      <Map
        // Keep your existing props (mapId, defaultCenter, defaultZoom, etc.) unchanged.
        // The two key lines below toggle map interactivity while drawing:
        gestureHandling={isPanMode ? 'greedy' : 'none'}
        zoomControl={isPanMode}
        // Optional but recommended to avoid accidental double-click zoom during drawing:
        disableDoubleClickZoom={!isPanMode}
        // You may keep your own className for sizing if needed:
        className="w-full h-full"
      >
        {/* Your shape rendering components (Rectangles/Polygons) can live here if you have them */}
        <DrawingOverlay selectedTool={selectedTool} shapes={shapes} setShapes={setShapes} />
      </Map>
    </div>
  );
};