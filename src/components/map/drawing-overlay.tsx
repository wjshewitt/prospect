'use client';

import React from 'react';
import {useMap} from '@vis.gl/react-google-maps';

type Tool = 'pan' | 'rectangle' | 'polygon';

export type LatLng = google.maps.LatLngLiteral;
export type Bounds = google.maps.LatLngBoundsLiteral;

export type RectangleShape = {id: string; type: 'rectangle'; bounds: Bounds};
export type PolygonShape = {id: string; type: 'polygon'; path: LatLng[]};
export type Shape = RectangleShape | PolygonShape;

interface DrawingOverlayProps {
  selectedTool: Tool;
  shapes: Shape[]; // not strictly needed for preview drawing but kept for parity with parent
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
}

function uuid() {
  // Small, collision-resistant enough for UI use
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  selectedTool,
  shapes,
  setShapes,
}) => {
  const map = useMap() as google.maps.Map | null;

  // Google overlay + DOM refs
  const overlayRef = React.useRef<google.maps.OverlayView | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);
  const projectionRef = React.useRef<google.maps.OverlayProjection | null>(null);
  const dprRef = React.useRef<number>(1);

  // Tool/state refs for event handlers
  const toolRef = React.useRef<Tool>(selectedTool);
  React.useEffect(() => {
    toolRef.current = selectedTool;
    // Clear any transient preview when switching tools
    rectStartRef.current = null;
    rectEndRef.current = null;
    isDrawingRectRef.current = false;
    hoverLatLngRef.current = null;
    polyPointsRef.current = [];
    requestDraw();
  }, [selectedTool]);

  const setShapesRef = React.useRef(setShapes);
  React.useEffect(() => {
    setShapesRef.current = setShapes;
  }, [setShapes]);

  // Rectangle state
  const isDrawingRectRef = React.useRef(false);
  const rectStartRef = React.useRef<LatLng | null>(null);
  const rectEndRef = React.useRef<LatLng | null>(null);

  // Polygon state
  const polyPointsRef = React.useRef<LatLng[]>([]);
  const hoverLatLngRef = React.useRef<LatLng | null>(null);

  const setupCanvasSize = React.useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const {clientWidth, clientHeight} = container;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    canvas.style.width = `${clientWidth}px`;
    canvas.style.height = `${clientHeight}px`;
    const width = Math.max(1, Math.floor(clientWidth * dpr));
    const height = Math.max(1, Math.floor(clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
      }
    }
  }, []);

  const clearCanvas = React.useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }, []);

  const llToPixel = React.useCallback((ll: LatLng) => {
    const projection = projectionRef.current;
    if (!projection) return null;
    const pt = projection.fromLatLngToDivPixel(new google.maps.LatLng(ll));
    return {x: pt.x, y: pt.y};
  }, []);

  const pxDistance = (a: {x: number; y: number}, b: {x: number; y: number}) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const requestDraw = React.useCallback(() => {
    // Defer to next frame to avoid flooding during frequent moves/zooms
    requestAnimationFrame(() => {
      draw();
    });
  }, []);

  const draw = React.useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    clearCanvas();

    // Styles
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a73e8';
    ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';

    // Rectangle preview
    if (
      toolRef.current === 'rectangle' &&
      isDrawingRectRef.current &&
      rectStartRef.current &&
      rectEndRef.current
    ) {
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

    // Polygon preview (existing vertices + live hover segment)
    if (toolRef.current === 'polygon') {
      const ptsLL = polyPointsRef.current;
      const liveLL = hoverLatLngRef.current;
      if (ptsLL.length > 0) {
        const pixels = ptsLL.map(llToPixel).filter(Boolean) as {x: number; y: number}[];
        if (pixels.length) {
          ctx.beginPath();
          ctx.moveTo(pixels[0].x, pixels[0].y);
          for (let i = 1; i < pixels.length; i++) {
            ctx.lineTo(pixels[i].x, pixels[i].y);
          }
          if (liveLL) {
            const livePx = llToPixel(liveLL);
            if (livePx) {
              ctx.lineTo(livePx.x, livePx.y);
            }
          }
          ctx.stroke();

          // Draw vertices
          ctx.fillStyle = '#1a73e8';
          for (const p of pixels) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          // Reset fill style for next shapes
          ctx.fillStyle = 'rgba(26, 115, 232, 0.1)';
        }
      }
    }
  }, [clearCanvas, llToPixel]);

  const getLatLngFromMouseEvent = React.useCallback((ev: MouseEvent): LatLng | null => {
    const projection = projectionRef.current;
    const container = containerRef.current;
    if (!projection || !container) return null;

    const rect = container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const latLng = projection.fromDivPixelToLatLng(new google.maps.Point(x, y));
    const ll = latLng && latLng.toJSON ? latLng.toJSON() : null;
    return ll as LatLng | null;
  }, []);

  const stopEvent = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
  };

  const finalizeRectangle = React.useCallback(() => {
    const start = rectStartRef.current;
    const end = rectEndRef.current;
    rectStartRef.current = null;
    rectEndRef.current = null;
    isDrawingRectRef.current = false;

    if (!start || !end) {
      requestDraw();
      return;
    }

    const bounds: Bounds = {
      north: Math.max(start.lat, end.lat),
      south: Math.min(start.lat, end.lat),
      east: Math.max(start.lng, end.lng),
      west: Math.min(start.lng, end.lng),
    };

    // Avoid creating zero-area rectangles
    const minSize = 1e-7;
    if (
      Math.abs(bounds.north - bounds.south) < minSize &&
      Math.abs(bounds.east - bounds.west) < minSize
    ) {
      requestDraw();
      return;
    }

    setShapesRef.current((prev: Shape[]) => [
      ...prev,
      {
        id: uuid(),
        type: 'rectangle',
        bounds,
      } as RectangleShape,
    ]);

    requestDraw();
  }, [requestDraw]);

  const finalizePolygon = React.useCallback(
    (closeWith?: LatLng | null) => {
      let pts = polyPointsRef.current;
      if (closeWith) {
        pts = [...pts, closeWith];
      }

      // Only accept polygons with 3+ vertices
      if (pts.length >= 3) {
        // It’s common to NOT repeat the first point; libraries close path automatically
        const path = pts.slice();

        setShapesRef.current((prev: Shape[]) => [
          ...prev,
          {
            id: uuid(),
            type: 'polygon',
            path,
          } as PolygonShape,
        ]);
      }

      polyPointsRef.current = [];
      hoverLatLngRef.current = null;
      requestDraw();
    },
    [requestDraw]
  );

  // Event handlers (attached imperatively to the canvas)
  const handleMouseDown = React.useCallback(
    (ev: MouseEvent) => {
      if (toolRef.current !== 'rectangle') return;
      stopEvent(ev);
      const ll = getLatLngFromMouseEvent(ev);
      if (!ll) return;
      isDrawingRectRef.current = true;
      rectStartRef.current = ll;
      rectEndRef.current = ll;
      requestDraw();
    },
    [getLatLngFromMouseEvent, requestDraw]
  );

  const handleMouseMove = React.useCallback(
    (ev: MouseEvent) => {
      const tool = toolRef.current;
      if (tool === 'rectangle') {
        if (!isDrawingRectRef.current) return;
        stopEvent(ev);
        const ll = getLatLngFromMouseEvent(ev);
        if (!ll) return;
        rectEndRef.current = ll;
        requestDraw();
      } else if (tool === 'polygon') {
        stopEvent(ev);
        const ll = getLatLngFromMouseEvent(ev);
        hoverLatLngRef.current = ll;
        requestDraw();
      }
    },
    [getLatLngFromMouseEvent, requestDraw]
  );

  const handleMouseUp = React.useCallback(
    (ev: MouseEvent) => {
      if (toolRef.current !== 'rectangle') return;
      stopEvent(ev);
      if (!isDrawingRectRef.current) return;
      const ll = getLatLngFromMouseEvent(ev);
      if (ll) {
        rectEndRef.current = ll;
      }
      finalizeRectangle();
    },
    [finalizeRectangle, getLatLngFromMouseEvent]
  );

  const handleClick = React.useCallback(
    (ev: MouseEvent) => {
      if (toolRef.current !== 'polygon') return;
      stopEvent(ev);
      const ll = getLatLngFromMouseEvent(ev);
      if (!ll) return;

      const pts = polyPointsRef.current;
      if (pts.length >= 1) {
        // If click is near the first vertex, close the polygon
        const first = pts[0];
        const firstPx = llToPixel(first);
        const clickPx = llToPixel(ll);
        if (firstPx && clickPx) {
          const dist = pxDistance(firstPx, clickPx);
          if (dist <= 10 && pts.length >= 3) {
            finalizePolygon(null);
            return;
          }
        }
      }

      polyPointsRef.current = [...pts, ll];
      requestDraw();
    },
    [finalizePolygon, getLatLngFromMouseEvent, llToPixel, requestDraw]
  );

  const handleDblClick = React.useCallback(
    (ev: MouseEvent) => {
      if (toolRef.current !== 'polygon') return;
      stopEvent(ev);
      // Finalize with current vertices (do not add another point on dblclick)
      finalizePolygon(null);
    },
    [finalizePolygon]
  );

  const handleContextMenu = React.useCallback(
    (ev: MouseEvent) => {
      if (toolRef.current !== 'polygon') return;
      // Right-click to finalize if 3+ points, otherwise cancel
      stopEvent(ev);
      finalizePolygon(null);
    },
    [finalizePolygon]
  );

  // Create OverlayView and canvas container
  React.useEffect(() => {
    if (!map || !('google' in window)) return;
    if (overlayRef.current) return;

    const overlay = new google.maps.OverlayView();

    overlay.onAdd = () => {
      const panes = overlay.getPanes();
      if (!panes) return;

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '0';
      container.style.top = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.pointerEvents = 'none'; // toggled dynamically
      container.style.userSelect = 'none';
      container.style.zIndex = '1';

      // Place it in overlayMouseTarget so it can receive mouse events above the map
      panes.overlayMouseTarget.appendChild(container);

      const canvas = document.createElement('canvas');
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none'; // toggled dynamically
      container.appendChild(canvas);

      containerRef.current = container;
      canvasRef.current = canvas;

      // Add listeners directly to the canvas
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('dblclick', handleDblClick);
      canvas.addEventListener('contextmenu', handleContextMenu);

      // Prevent text selection or default behaviors while drawing
      container.addEventListener('mousedown', stopEvent);
      container.addEventListener('touchstart', stopEvent);
    };

    overlay.onRemove = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;

      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.removeEventListener('click', handleClick);
        canvas.removeEventListener('dblclick', handleDblClick);
        canvas.removeEventListener('contextmenu', handleContextMenu);
      }
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }

      containerRef.current = null;
      canvasRef.current = null;
      ctxRef.current = null;
      projectionRef.current = null;
    };

    overlay.draw = () => {
      projectionRef.current = overlay.getProjection() ?? null;

      // The overlay is sized to the map's div automatically by using 100% width/height,
      // but we still need to sync the backing store and context scaling.
      setupCanvasSize();
      requestDraw();
    };

    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [
    map,
    handleClick,
    handleContextMenu,
    handleDblClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    requestDraw,
    setupCanvasSize,
  ]);

  // Toggle pointer events and cursor based on selected tool
  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const isDrawing = selectedTool !== 'pan';
    container.style.pointerEvents = isDrawing ? 'auto' : 'none';
    canvas.style.pointerEvents = isDrawing ? 'auto' : 'none';
    canvas.style.cursor = isDrawing ? 'crosshair' : '';
  }, [selectedTool]);

  // Redraw on window resize (map size might change)
  React.useEffect(() => {
    const onResize = () => {
      setupCanvasSize();
      requestDraw();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [requestDraw, setupCanvasSize]);

  return null;
};