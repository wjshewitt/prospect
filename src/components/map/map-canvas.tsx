'use client';

import type { Shape, Tool } from '@/lib/types';
import { Map } from '@vis.gl/react-google-maps';
import { DrawingOverlay } from './drawing-overlay';

type MapCanvasProps = {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedTool: Tool;
};

const MAP_ID = 'a2a91d1962296f30'; // Hybrid map style

export default function MapCanvas({ shapes, setShapes, selectedTool }: MapCanvasProps) {
  return (
    <div className="w-full h-full">
      <Map
        defaultCenter={{ lat: 34.0522, lng: -118.2437 }}
        defaultZoom={12}
        mapId={MAP_ID}
        disableDefaultUI={true}
        gestureHandling={'greedy'}
        className="w-full h-full"
      >
        <DrawingOverlay shapes={shapes} setShapes={setShapes} selectedTool={selectedTool} />
      </Map>
    </div>
  );
}
