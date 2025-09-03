
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {Map, useMap, useApiIsLoaded} from '@vis.gl/react-google-maps';
import type { LatLng, Shape, Tool } from '@/lib/types';
import { ShapeContextMenu } from './shape-context-menu';

interface MapCanvasProps {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  className?: string;
}

interface ContextMenuState {
  shapeId: string;
  position: { x: number; y: number };
}

function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}


const DrawingManagerComponent: React.FC<{
  selectedTool: Tool,
  setSelectedTool: (tool: Tool) => void,
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>
}> = ({ selectedTool, setShapes, setSelectedTool }) => {
  const map = useMap();
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);

  useEffect(() => {
    if (!map) return;

    const dm = new google.maps.drawing.DrawingManager({
      map,
      drawingControl: false,
      drawingMode: null,
      rectangleOptions: {
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 0.1,
        strokeWeight: 2,
        strokeColor: 'hsl(var(--primary))',
        clickable: false,
        editable: false,
        zIndex: 1,
      },
      polygonOptions: {
        fillColor: 'hsl(var(--primary))',
        fillOpacity: 0.1,
        strokeWeight: 2,
        strokeColor: 'hsl(var(--primary))',
        clickable: false,
        editable: false,
        zIndex: 1,
      },
    });

    setDrawingManager(dm);

    return () => {
      dm.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!drawingManager) return;
    
    const drawingMode = selectedTool === 'rectangle' 
        ? google.maps.drawing.OverlayType.RECTANGLE
        : selectedTool === 'polygon'
        ? google.maps.drawing.OverlayType.POLYGON
        : null;

    drawingManager.setDrawingMode(drawingMode);

  }, [selectedTool, drawingManager]);

  useEffect(() => {
    if (!drawingManager) return;

    const onRectangleComplete = (rect: google.maps.Rectangle) => {
        const bounds = rect.getBounds()!;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        const path = [
          { lat: ne.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: ne.lng() },
          { lat: sw.lat(), lng: sw.lng() },
        ];
        const area = google.maps.geometry.spherical.computeArea(path);
        
        setShapes(prev => [...prev, {
            id: uuid(),
            type: 'rectangle',
            bounds: {
                north: ne.lat(),
                south: sw.lat(),
                east: ne.lng(),
                west: sw.lng()
            },
            area
        }]);
        rect.setMap(null); 
        setSelectedTool('pan');
    };
    
    const onPolygonComplete = (poly: google.maps.Polygon) => {
        const path = poly.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        const area = google.maps.geometry.spherical.computeArea(path);
        setShapes(prev => [...prev, {
            id: uuid(),
            type: 'polygon',
            path,
            area
        }]);
        poly.setMap(null); 
        setSelectedTool('pan');
    };

    const rectListener = google.maps.event.addListener(drawingManager, 'rectanglecomplete', onRectangleComplete);
    const polyListener = google.maps.event.addListener(drawingManager, 'polygoncomplete', onPolygonComplete);

    return () => {
      google.maps.event.removeListener(rectListener);
      google.maps.event.removeListener(polyListener);
    };
  }, [drawingManager, setShapes, setSelectedTool]);
  
  return null;
}

const DrawnShapes: React.FC<{
  shapes: Shape[],
  onShapeClick: (shapeId: string, event: google.maps.MapMouseEvent) => void,
}> = ({ shapes, onShapeClick }) => {
    const map = useMap();
    const [polygons, setPolygons] = useState<{[id: string]: google.maps.Polygon}>({});
  
    useEffect(() => {
      // Clean up old polygons
      Object.values(polygons).forEach(p => p.setMap(null));
      
      if (!map) {
          setPolygons({});
          return;
      };
  
      const newPolygons: {[id: string]: google.maps.Polygon} = {};
      shapes.forEach(shape => {
        let path: LatLng[];
        if (shape.type === 'rectangle') {
          const { north, south, east, west } = shape.bounds;
          path = [
            { lat: north, lng: west },
            { lat: north, lng: east },
            { lat: south, lng: east },
            { lat: south, lng: west },
          ];
        } else {
          path = shape.path;
        }
  
        const poly = new google.maps.Polygon({
          paths: path,
          strokeColor: 'hsl(var(--primary))',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: 'hsl(var(--primary))',
          fillOpacity: 0.3,
          map: map,
          clickable: true
        });

        poly.addListener('rightclick', (e: google.maps.MapMouseEvent) => onShapeClick(shape.id, e));
        poly.addListener('click', (e: google.maps.MapMouseEvent) => {
            // Check for middle click (button 1)
            if (e.domEvent.button === 1) {
                onShapeClick(shape.id, e);
            }
        });
        
        newPolygons[shape.id] = poly;
      });
  
      setPolygons(newPolygons);
  
      return () => {
        Object.values(newPolygons).forEach(p => {
            google.maps.event.clearInstanceListeners(p);
            p.setMap(null)
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapes, map, onShapeClick]);
  
    return null;
  };


export const MapCanvas: React.FC<MapCanvasProps> = ({
  selectedTool,
  shapes,
  setShapes,
  setSelectedTool,
  className,
}) => {
  const isLoaded = useApiIsLoaded();
  const map = useMap();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleShapeClick = useCallback((shapeId: string, event: google.maps.MapMouseEvent) => {
    if (!map || !event.domEvent) return;
    event.domEvent.preventDefault();
    event.domEvent.stopPropagation();
    
    const mapContainer = map.getDiv();
    const projection = map.getProjection();
    if (!projection) return;
    
    const worldPoint = projection.fromLatLngToPoint(event.latLng!);
    const point = {
        x: worldPoint.x * Math.pow(2, map.getZoom()!) - (mapContainer.offsetParent as HTMLElement)?.offsetLeft,
        y: worldPoint.y * Math.pow(2, map.getZoom()!) - (mapContainer.offsetParent as HTMLElement)?.offsetTop,
    };
    
    const rect = mapContainer.getBoundingClientRect();
    const scale = Math.pow(2, map.getZoom()!);

    const mapTopLeft = projection.fromLatLngToPoint(map.getBounds()!.getNorthWest());
    
    setContextMenu({
        shapeId: shapeId,
        position: {
            x: (worldPoint.x - mapTopLeft.x) * scale,
            y: (worldPoint.y - mapTopLeft.y) * scale,
        }
    });

  }, [map]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteShape = (shapeId: string) => {
    setShapes(prev => prev.filter(s => s.id !== shapeId));
    closeContextMenu();
  };

  useEffect(() => {
    if (map) {
      map.addListener('click', closeContextMenu);
      map.addListener('dragstart', closeContextMenu);
    }
  }, [map, closeContextMenu]);


  return (
    <div className={className ?? 'relative w-full h-full'}>
      <Map
        defaultCenter={{lat: 53.483959, lng: -2.244644}}
        defaultZoom={7}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling={selectedTool === 'pan' ? 'greedy' : 'none'}
        zoomControl={selectedTool === 'pan'}
        disableDoubleClickZoom={selectedTool !== 'pan'}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        className="w-full h-full"
        onClick={closeContextMenu}
      >
        {isLoaded && <DrawingManagerComponent selectedTool={selectedTool} setShapes={setShapes} setSelectedTool={setSelectedTool} />}
        {isLoaded && <DrawnShapes shapes={shapes} onShapeClick={handleShapeClick} />}
      </Map>

       {contextMenu && (
        <ShapeContextMenu
          position={contextMenu.position}
          shapeId={contextMenu.shapeId}
          onDelete={handleDeleteShape}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
