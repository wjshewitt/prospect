'use client';

import type { Shape, Tool } from '@/lib/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, useMap, useApiIsLoaded } from '@vis.gl/react-google-maps';

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
        <DrawingCanvas shapes={shapes} setShapes={setShapes} selectedTool={selectedTool} />
      </Map>
    </div>
  );
}

function DrawingCanvas({ shapes, setShapes, selectedTool }: MapCanvasProps) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<google.maps.Point | null>(null);
  const [currentPos, setCurrentPos] = useState<google.maps.Point | null>(null);

  const redrawCanvas = useCallback(() => {
    if (!map || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const projection = map.getProjection();
    if (!projection) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#F4A460'; // Sandy Brown
    ctx.fillStyle = 'rgba(244, 164, 96, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    shapes.forEach(shape => {
      if (shape.type === 'rectangle' && shape.path.length >= 2) {
        const sw = projection.fromLatLngToDivPixel(shape.path[0]);
        const ne = projection.fromLatLngToDivPixel(shape.path[1]);
        if(sw && ne){
            const width = ne.x - sw.x;
            const height = sw.y - ne.y;
            ctx.strokeRect(sw.x, ne.y, width, height);
            ctx.fillRect(sw.x, ne.y, width, height);
        }
      }
    });

    // Draw the current shape being drawn
    if (isDrawing && startPos && currentPos) {
      ctx.strokeStyle = '#388E3C'; // Forest Green
      ctx.fillStyle = 'rgba(56, 142, 60, 0.2)';
      ctx.setLineDash([5, 5]);

      if (selectedTool === 'rectangle') {
        const width = currentPos.x - startPos.x;
        const height = currentPos.y - startPos.y;
        ctx.strokeRect(startPos.x, startPos.y, width, height);
        ctx.fillRect(startPos.x, startPos.y, width, height);
      }
    }
  }, [map, shapes, isDrawing, startPos, currentPos, selectedTool]);

  useEffect(() => {
    if (!map) return;
    const listeners = [
      map.addListener('projection_changed', redrawCanvas),
      map.addListener('zoom_changed', redrawCanvas),
      map.addListener('center_changed', redrawCanvas),
    ];
    return () => listeners.forEach(l => l.remove());
  }, [map, redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'pan' || !map) return;
    setIsDrawing(true);
    const pos = new google.maps.Point(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setStartPos(pos);
    setCurrentPos(pos);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || selectedTool === 'pan' || !map) return;
    const pos = new google.maps.Point(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setCurrentPos(pos);
  };

  const handleMouseUp = () => {
    if (!isDrawing || selectedTool === 'pan' || !map || !startPos || !currentPos) return;

    const projection = map.getProjection();
    if (!projection) return;

    const sw = projection.fromDivPixelToLatLng(startPos);
    const ne = projection.fromDivPixelToLatLng(currentPos);

    if (sw && ne) {
      const newPath = [
        { lat: Math.min(sw.lat(), ne.lat()), lng: Math.min(sw.lng(), ne.lng()) },
        { lat: Math.max(sw.lat(), ne.lat()), lng: Math.max(sw.lng(), ne.lng()) }
      ];

      const polygonPath = [
          newPath[0],
          {lat: newPath[0].lat, lng: newPath[1].lng},
          newPath[1],
          {lat: newPath[1].lat, lng: newPath[0].lng},
      ];
      
      const areaInMeters = apiIsLoaded ? google.maps.geometry.spherical.computeArea(polygonPath.map(p => new google.maps.LatLng(p))) : 0;

      const newShape: Shape = {
        id: new Date().toISOString(),
        type: 'rectangle',
        path: newPath,
        area: areaInMeters,
      };

      setShapes(prev => [...prev, newShape]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={map?.getDiv().clientWidth}
      height={map?.getDiv().clientHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: selectedTool === 'pan' ? 'grab' : 'crosshair',
        pointerEvents: selectedTool === 'pan' ? 'none' : 'auto',
      }}
    />
  );
}
