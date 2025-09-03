
'use client';

import React, { useEffect, useState } from 'react';
import {Map, useMap, useApiIsLoaded} from '@vis.gl/react-google-maps';
import type { Shape, Tool } from '@/lib/types';

interface MapCanvasProps {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  className?: string;
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
    
    if (selectedTool === 'rectangle') {
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    } else if (selectedTool === 'polygon') {
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else {
        drawingManager.setDrawingMode(null);
    }
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

const DrawnShapes: React.FC<{shapes: Shape[]}> = ({ shapes }) => {
    const map = useMap();
    const [polygons, setPolygons] = useState<google.maps.Polygon[]>([]);
  
    useEffect(() => {
      polygons.forEach(p => p.setMap(null));
      
      if (!map || !shapes.length) {
          setPolygons([]);
          return;
      };
  
      const newPolygons = shapes.map(shape => {
        let path;
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
        });
        return poly;
      });
  
      setPolygons(newPolygons);
  
      return () => {
        newPolygons.forEach(p => p.setMap(null));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapes, map]);
  
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
      >
        {isLoaded && <DrawingManagerComponent selectedTool={selectedTool} setShapes={setShapes} setSelectedTool={setSelectedTool} />}
        {isLoaded && <DrawnShapes shapes={shapes} />}
      </Map>
    </div>
  );
};
