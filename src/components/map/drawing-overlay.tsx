'use client';

import React from 'react';
import {useMap} from '@vis.gl/react-google-maps';
import type { Shape, Tool } from '@/lib/types';
import { LatLng, Bounds } from '@/lib/types';

interface DrawingOverlayProps {
  selectedTool: Tool;
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
}

function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  selectedTool,
  setShapes,
}) => {
  const map = useMap();

  const overlayRef = React.useRef<google.maps.OverlayView | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  
  const toolRef = React.useRef<Tool>(selectedTool);
  const setShapesRef = React.useRef(setShapes);

  const isDrawingRectRef = React.useRef(false);
  const rectStartRef = React.useRef<LatLng | null>(null);
  const rectEndRef = React.useRef<LatLng | null>(null);

  const polyPointsRef = React.useRef<LatLng[]>([]);
  const hoverLatLngRef = React.useRef<LatLng | null>(null);

  React.useEffect(() => {
    toolRef.current = selectedTool;
    polyPointsRef.current = [];
    isDrawingRectRef.current = false;
    rectStartRef.current = null;
    rectEndRef.current = null;
    drawCanvas();
  }, [selectedTool]);

  React.useEffect(() => {
    setShapesRef.current = setShapes;
  }, [setShapes]);

  const getProjection = () => {
    return overlayRef.current?.getProjection() ?? null;
  }

  const drawCanvas = () => {
    requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        const projection = getProjection();
        if (!canvas || !projection) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const llToPixel = (ll: LatLng) => {
            const pt = projection.fromLatLngToDivPixel(new google.maps.LatLng(ll));
            return { x: pt!.x, y: pt!.y };
        };
        
        // Styles
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#1a73e8';
        ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';

        // Rectangle preview
        if (toolRef.current === 'rectangle' && isDrawingRectRef.current && rectStartRef.current && rectEndRef.current) {
            const p1 = llToPixel(rectStartRef.current);
            const p2 = llToPixel(rectEndRef.current);
            if (p1 && p2) {
                const x = Math.min(p1.x, p2.x);
                const y = Math.min(p1.y, p2.y);
                const w = Math.abs(p2.x - p1.x);
                const h = Math.abs(p2.y - p1.y);
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                ctx.fill();
                ctx.stroke();
            }
        }
        
        // Polygon preview
        if (toolRef.current === 'polygon' && polyPointsRef.current.length > 0) {
            const pixels = polyPointsRef.current.map(llToPixel).filter(Boolean) as {x: number; y: number}[];
            if (pixels.length > 0) {
                ctx.beginPath();
                ctx.moveTo(pixels[0].x, pixels[0].y);
                for (let i = 1; i < pixels.length; i++) {
                    ctx.lineTo(pixels[i].x, pixels[i].y);
                }
                
                if (hoverLatLngRef.current) {
                    const livePx = llToPixel(hoverLatLngRef.current);
                    if (livePx) ctx.lineTo(livePx.x, livePx.y);
                }
                
                ctx.stroke();
                
                ctx.fillStyle = '#1a73e8';
                for (const p of pixels) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';
            }
        }
    });
  }

  const getLatLngFromMouseEvent = (ev: MouseEvent): LatLng | null => {
    const projection = getProjection();
    const container = canvasRef.current?.parentElement;
    if (!projection || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const latLng = projection.fromDivPixelToLatLng(new google.maps.Point(x, y));
    return latLng ? { lat: latLng.lat(), lng: latLng.lng() } : null;
  };
  
  const handleMouseDown = (ev: MouseEvent) => {
    if (toolRef.current !== 'rectangle') return;
    const ll = getLatLngFromMouseEvent(ev);
    if (!ll) return;
    isDrawingRectRef.current = true;
    rectStartRef.current = ll;
    rectEndRef.current = ll;
  };

  const handleMouseMove = (ev: MouseEvent) => {
    const ll = getLatLngFromMouseEvent(ev);
    if (!ll) return;

    if (toolRef.current === 'rectangle' && isDrawingRectRef.current) {
      rectEndRef.current = ll;
    } else if (toolRef.current === 'polygon') {
      hoverLatLngRef.current = ll;
    }
    drawCanvas();
  };

  const handleMouseUp = () => {
    if (toolRef.current !== 'rectangle' || !isDrawingRectRef.current) return;
    
    const start = rectStartRef.current;
    const end = rectEndRef.current;
    
    isDrawingRectRef.current = false;
    rectStartRef.current = null;
    rectEndRef.current = null;

    if (start && end) {
      const bounds: Bounds = {
        north: Math.max(start.lat, end.lat),
        south: Math.min(start.lat, end.lat),
        east: Math.max(start.lng, end.lng),
        west: Math.min(start.lng, end.lng),
      };

      const area = google.maps.geometry.spherical.computeArea(
        google.maps.geometry.encoding.decodePath(
            new google.maps.Polygon({paths: [
                {lat: bounds.north, lng: bounds.west},
                {lat: bounds.north, lng: bounds.east},
                {lat: bounds.south, lng: bounds.east},
                {lat: bounds.south, lng: bounds.west},
            ]}).getPath().getArray().map(p => p.toUrlValue()).join('|')
        )
      );

      setShapesRef.current((prev) => [
        ...prev,
        { id: uuid(), type: 'rectangle', bounds, area },
      ]);
    }
    drawCanvas();
  };
  
  const handleClick = (ev: MouseEvent) => {
    if (toolRef.current !== 'polygon') return;
    const ll = getLatLngFromMouseEvent(ev);
    if (!ll) return;

    const pts = polyPointsRef.current;

    // Close polygon if clicking near start
    if (pts.length >= 3) {
        const projection = getProjection();
        if (projection) {
            const firstPx = projection.fromLatLngToDivPixel(new google.maps.LatLng(pts[0]));
            const clickPx = projection.fromLatLngToDivPixel(new google.maps.LatLng(ll));
            if (firstPx && clickPx) {
                const dist = Math.hypot(firstPx.x - clickPx.x, firstPx.y - clickPx.y);
                if (dist < 10) { // 10px tolerance
                    finalizePolygon();
                    return;
                }
            }
        }
    }
    
    polyPointsRef.current = [...pts, ll];
    drawCanvas();
  };

  const finalizePolygon = () => {
    const path = polyPointsRef.current;
    polyPointsRef.current = [];
    hoverLatLngRef.current = null;

    if (path.length >= 3) {
      const area = google.maps.geometry.spherical.computeArea(path);
      setShapesRef.current((prev) => [
        ...prev,
        { id: uuid(), type: 'polygon', path, area },
      ]);
    }
    drawCanvas();
  }

  const handleContextMenu = (ev: MouseEvent) => {
    if (toolRef.current !== 'polygon') return;
    ev.preventDefault();
    finalizePolygon();
  }

  React.useEffect(() => {
    if (!map || overlayRef.current) return;

    class DrawingOverlay extends google.maps.OverlayView {
      private container: HTMLDivElement;
      private canvas: HTMLCanvasElement;

      constructor() {
        super();
        this.container = document.createElement('div');
        this.canvas = document.createElement('canvas');
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.container.appendChild(this.canvas);
        canvasRef.current = this.canvas;
      }

      onAdd() {
        this.getPanes()?.overlayMouseTarget.appendChild(this.container);
        this.canvas.addEventListener('mousedown', handleMouseDown);
        this.canvas.addEventListener('mousemove', handleMouseMove);
        this.canvas.addEventListener('mouseup', handleMouseUp);
        this.canvas.addEventListener('click', handleClick);
        this.canvas.addEventListener('contextmenu', handleContextMenu);
      }

      onRemove() {
        this.canvas.removeEventListener('mousedown', handleMouseDown);
        this.canvas.removeEventListener('mousemove', handleMouseMove);
        this.canvas.removeEventListener('mouseup', handleMouseUp);
        this.canvas.removeEventListener('click', handleClick);
        this.canvas.removeEventListener('contextmenu', handleContextMenu);
        this.container.remove();
      }

      draw() {
        const projection = this.getProjection();
        if (!projection || !this.canvas) return;
        
        const {width, height} = this.container.getBoundingClientRect();
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        drawCanvas();
      }
    }

    const overlay = new DrawingOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);


  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isDrawingTool = selectedTool !== 'pan';
    canvas.style.pointerEvents = isDrawingTool ? 'auto' : 'none';
    canvas.style.cursor = isDrawingTool ? 'crosshair' : '';
  }, [selectedTool]);

  return null;
};
