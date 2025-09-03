'use client';

import React from 'react';
import {Map} from '@vis.gl/react-google-maps';
import {DrawingOverlay} from './drawing-overlay';
import type { Shape, Tool } from '@/lib/types';


interface MapCanvasProps {
  selectedTool: Tool;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
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
        defaultCenter={{lat: 53.483959, lng: -2.244644}}
        defaultZoom={7}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling={isPanMode ? 'greedy' : 'none'}
        zoomControl={isPanMode}
        disableDoubleClickZoom={!isPanMode}
        className="w-full h-full"
      >
        <DrawingOverlay selectedTool={selectedTool} setShapes={setShapes} />
      </Map>
    </div>
  );
};
