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

  // For polygon drawing
  const [polygonPoints, setPolygonPoints] = useState<google.maps.Point[]>([]);

  const redrawCanvas = useCallback(() => {
    if (!overlayRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const projection = overlayRef.current.getProjection();
    if (!projection) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mapDiv = map?.getDiv();
    if(mapDiv) {
        canvas.width = mapDiv.clientWidth;
        canvas.height = mapDiv.clientHeight;
    }

    ctx.strokeStyle = '#F4A460';
    ctx.fillStyle = 'rgba(244, 164, 96, 0.2)';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);

    shapes.forEach(shape => {
      if (!projection) return;
      ctx.beginPath();
      const firstPoint = projection.fromLatLngToDivPixel(new google.maps.LatLng(shape.path[0]));
      if (!firstPoint) return;
      ctx.moveTo(firstPoint.x, firstPoint.y);
      shape.path.slice(1).forEach(latLng => {
        const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(latLng));
        if (point) {
          ctx.lineTo(point.x, point.y);
        }
      });
      if (shape.type === 'polygon') {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.fill();
    });

    // Draw the current shape being drawn
    if (isDrawing && startPos && currentPos && selectedTool === 'rectangle') {
      ctx.strokeStyle = '#388E3C';
      ctx.fillStyle = 'rgba(56, 142, 60, 0.2)';
      ctx.setLineDash([5, 5]);

      const width = currentPos.x - startPos.x;
      const height = currentPos.y - startPos.y;
      ctx.strokeRect(startPos.x, startPos.y, width, height);
      ctx.fillRect(startPos.x, startPos.y, width, height);
    }
    
    // Draw current polygon being created
    if (selectedTool === 'polygon' && polygonPoints.length > 0) {
      ctx.strokeStyle = '#388E3C';
      ctx.fillStyle = 'rgba(56, 142, 60, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
      for (let i = 1; i < polygonPoints.length; i++) {
        ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
      }
      if (currentPos) {
          ctx.lineTo(currentPos.x, currentPos.y);
      }
      ctx.stroke();

      // Draw vertices
      ctx.fillStyle = '#388E3C';
      polygonPoints.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

  }, [map, shapes, isDrawing, startPos, currentPos, selectedTool, polygonPoints]);

  useEffect(() => {
    if (!apiIsLoaded || !map) return;

    class CustomOverlay extends google.maps.OverlayView {
        private container: HTMLElement;
        private onDraw: () => void;
        private onClick: (e: MouseEvent) => void;

        constructor(container: HTMLElement, onDraw: () => void, onClick: (e: MouseEvent) => void) {
            super();
            this.container = container;
            this.onDraw = onDraw;
            this.onClick = onClick;
            this.onAdd = this.onAdd.bind(this);
            this.onRemove = this.onRemove.bind(this);
            this.draw = this.draw.bind(this);
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
    if (canvasRef.current) {
        overlayRef.current = new CustomOverlay(canvasRef.current, redrawCanvas, () => {});
        overlayRef.current.setMap(map);
    }
    
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

    if (selectedTool === 'rectangle') {
        setIsDrawing(true);
        const pos = new google.maps.Point(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setStartPos(pos);
        setCurrentPos(pos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool === 'pan' || !map) return;
    const pos = new google.maps.Point(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setCurrentPos(pos);

    if (isDrawing && selectedTool === 'rectangle') {
      redrawCanvas();
    }
     if (selectedTool === 'polygon' && polygonPoints.length > 0) {
      redrawCanvas();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || selectedTool !== 'rectangle' || !overlayRef.current || !startPos || !currentPos) return;

    const projection = overlayRef.current.getProjection();
    if (!projection) return;
    
    const sw = projection.fromDivPixelToLatLng(startPos);
    const ne = projection.fromDivPixelToLatLng(currentPos);

    if (sw && ne) {
      const newPath: google.maps.LatLngLiteral[] = [
        { lat: Math.min(sw.lat(), ne.lat()), lng: Math.min(sw.lng(), ne.lng()) },
        { lat: newPath[0].lat, lng: Math.max(sw.lng(), ne.lng())},
        { lat: Math.max(sw.lat(), ne.lat()), lng: Math.max(sw.lng(), ne.lng()) },
        { lat: Math.max(sw.lat(), ne.lat()), lng: Math.min(sw.lng(), ne.lng()) }
      ];

      const areaInMeters = apiIsLoaded ? google.maps.geometry.spherical.computeArea(newPath.map(p => new google.maps.LatLng(p))) : 0;

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
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'polygon' || !overlayRef.current) return;
    const projection = overlayRef.current.getProjection();
    if(!projection) return;
    
    const clickPos = new google.maps.Point(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    
    // Finish polygon on click near start point
    if (polygonPoints.length > 2) {
      const startPos = polygonPoints[0];
      const distance = Math.sqrt(Math.pow(clickPos.x - startPos.x, 2) + Math.pow(clickPos.y - startPos.y, 2));
      if (distance < 10) { // 10px tolerance
        const path = polygonPoints.map(p => projection.fromDivPixelToLatLng(p) as google.maps.LatLng);
        const areaInMeters = apiIsLoaded ? google.maps.geometry.spherical.computeArea(path) : 0;
        
        const newShape: Shape = {
          id: new Date().toISOString(),
          type: 'polygon',
          path: path.map(p => p.toJSON()),
          area: areaInMeters,
        };
        setShapes(prev => [...prev, newShape]);
        setPolygonPoints([]);
        return;
      }
    }
    
    setPolygonPoints(prev => [...prev, clickPos]);
  };
  
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
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
