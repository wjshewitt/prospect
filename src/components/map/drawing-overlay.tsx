'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMap, useApiIsLoaded } from '@vis.gl/react-google-maps';
import type { Shape, Tool } from '@/lib/types';

type DrawingOverlayProps = {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedTool: Tool;
};

export function DrawingOverlay({ shapes, setShapes, selectedTool }: DrawingOverlayProps) {
  const map = useMap();
  const apiIsLoaded = useApiIsLoaded();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<google.maps.Point | null>(null);
  const [currentPos, setCurrentPos] = useState<google.maps.Point | null>(null);

  const redrawCanvas = useCallback(() => {
    if (!overlayRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const projection = overlayRef.current.getProjection();
    if (!projection) return;

    // The canvas needs to be cleared and sized correctly on every frame.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mapDiv = map?.getDiv();
    if(mapDiv) {
        canvas.width = mapDiv.clientWidth;
        canvas.height = mapDiv.clientHeight;
    }


    ctx.strokeStyle = '#F4A460'; // Sandy Brown
    ctx.fillStyle = 'rgba(244, 164, 96, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    shapes.forEach(shape => {
      if (shape.type === 'rectangle' && shape.path.length >= 2) {
        const sw = projection.fromLatLngToDivPixel(new google.maps.LatLng(shape.path[0]));
        const ne = projection.fromLatLngToDivPixel(new google.maps.LatLng(shape.path[1]));
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
    if (!apiIsLoaded || !map || !canvasRef.current) return;

    // This is a custom overlay component that will host our canvas
    // See https://developers.google.com/maps/documentation/javascript/react-map/custom-components#adding_a_custom_overlay
    class CustomOverlay extends google.maps.OverlayView {
        private container: HTMLElement;
        private onDraw: () => void;
        private onClick: (e: MouseEvent) => void;

        constructor(container: HTMLElement, onDraw: () => void, onClick: (e: MouseEvent) => void) {
            super();
            this.container = container;
            this.onDraw = onDraw;
            this.onClick = onClick;
        }

        onAdd() {
            this.getPanes()?.overlayMouseTarget.appendChild(this.container);
            this.getPanes()?.overlayMouseTarget.addEventListener('click', this.onClick);
        }

        onRemove() {
            if (this.container.parentElement) {
                this.container.parentElement.removeChild(this.container);
            }
            this.getPanes()?.overlayMouseTarget.removeEventListener('click', this.onClick);
        }

        draw() {
            this.onDraw();
        }
    }

    overlayRef.current = new CustomOverlay(canvasRef.current, redrawCanvas, () => {});
    overlayRef.current.setMap(map);
    
    return () => {
        if(overlayRef.current) {
            overlayRef.current.setMap(null);
        }
    }
  }, [apiIsLoaded, map, redrawCanvas]);

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
    redrawCanvas();
  };

  const handleMouseUp = () => {
    if (!isDrawing || selectedTool === 'pan' || !overlayRef.current || !startPos || !currentPos) return;

    const projection = overlayRef.current.getProjection();
    if (!projection) return;
    
    // fromDivPixelToLatLng is available on the projection from an OverlayView
    const sw = projection.fromDivPixelToLatLng(startPos);
    const ne = projection.fromDivPixelToLatLng(currentPos);

    if (sw && ne) {
      const newPath: google.maps.LatLngLiteral[] = [
        { lat: Math.min(sw.lat(), ne.lat()), lng: Math.min(sw.lng(), ne.lng()) },
        { lat: Math.max(sw.lat(), ne.lat()), lng: Math.max(sw.lng(), ne.lng()) }
      ];

      const polygonPathForArea = [
          newPath[0],
          {lat: newPath[0].lat, lng: newPath[1].lng},
          newPath[1],
          {lat: newPath[1].lat, lng: newPath[0].lng},
      ];
      
      const areaInMeters = apiIsLoaded ? google.maps.geometry.spherical.computeArea(polygonPathForArea.map(p => new google.maps.LatLng(p))) : 0;

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
