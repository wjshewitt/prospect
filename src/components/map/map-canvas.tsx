
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {Map, useMap, useApiIsLoaded} from '@vis.gl/react-google-maps';
import type { LatLng, Shape, Tool } from '@/lib/types';
import { ShapeContextMenu } from './shape-context-menu';
import { useToast } from '@/hooks/use-toast';

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
          { lat: ne.lat(), lng: ne.lng() },
          { lat: ne.lat(), lng: sw.lng() },
          { lat: sw.lat(), lng: sw.lng() },
          { lat: sw.lat(), lng: ne.lng() },
        ];

        // Ensure the path is clockwise for consistent area calculation
        if (google.maps.geometry.spherical.computeArea(path) > 0) {
            path.reverse();
        }
        
        setShapes(prev => [...prev, {
            id: uuid(),
            type: 'rectangle',
            bounds: {
                north: ne.lat(),
                south: sw.lat(),
                east: ne.lng(),
                west: sw.lng()
            },
            area: google.maps.geometry.spherical.computeArea(path)
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
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  onShapeClick: (shapeId: string, event: google.maps.MapMouseEvent) => void;
  editingShapeId: string | null;
  setEditingShapeId: (id: string | null) => void;
  movingShapeId: string | null;
  setMovingShapeId: (id: string | null) => void;
}> = ({ shapes, setShapes, onShapeClick, editingShapeId, setEditingShapeId, movingShapeId, setMovingShapeId }) => {
    const map = useMap();
    const [polygons, setPolygons] = useState<{[id: string]: google.maps.Polygon}>({});
    const { toast } = useToast();
    const [hasShownMovePrompt, setHasShownMovePrompt] = useState(false);
  
    // Effect to create and manage polygon instances on the map
    useEffect(() => {
      if (!map) return;
  
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
  
        const isEditing = shape.id === editingShapeId;
        const isMoving = shape.id === movingShapeId;

        const poly = new google.maps.Polygon({
          paths: path,
          strokeColor: 'hsl(var(--primary))',
          strokeOpacity: isMoving ? 1.0 : 0.8,
          strokeWeight: isMoving ? 3 : 2,
          fillColor: 'hsl(var(--primary))',
          fillOpacity: isMoving ? 0.5 : 0.3,
          map: map,
          clickable: true,
          editable: isEditing,
          draggable: isMoving,
        });

        poly.addListener('rightclick', (e: google.maps.MapMouseEvent) => onShapeClick(shape.id, e));
        poly.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.domEvent.button === 1) { // Middle click
                onShapeClick(shape.id, e);
            } else if (editingShapeId && editingShapeId !== shape.id) {
                // If another shape is being edited, clicking this one stops the other edit
                setEditingShapeId(null);
            }
        });
        
        poly.addListener('dblclick', () => {
            setEditingShapeId(null);
            setMovingShapeId(shape.id);
            if (!hasShownMovePrompt) {
                toast({
                    title: "Shape is now movable",
                    description: "Click and drag to move the shape. Click the map to stop.",
                });
                setHasShownMovePrompt(true);
            }
        });

        if (isEditing) {
            const path = poly.getPath();
            google.maps.event.addListener(path, 'set_at', () => updateShape(shape.id, poly));
            google.maps.event.addListener(path, 'insert_at', () => updateShape(shape.id, poly));
        }

        if (isMoving) {
            google.maps.event.addListener(poly, 'dragend', () => {
                updateShape(shape.id, poly);
            });
        }
        
        newPolygons[shape.id] = poly;
      });
  
      // Clean up polygons that are no longer in the shapes array
      Object.keys(polygons).forEach(id => {
        if (!newPolygons[id]) {
          polygons[id].setMap(null);
          google.maps.event.clearInstanceListeners(polygons[id]);
        }
      });
      
      setPolygons(newPolygons);
  
      return () => {
        Object.values(newPolygons).forEach(p => {
            google.maps.event.clearInstanceListeners(p);
            p.setMap(null)
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapes, map, editingShapeId, movingShapeId, onShapeClick]);


    // Effect to update the editable/draggable properties of polygons when editing/moving state changes
    useEffect(() => {
        Object.entries(polygons).forEach(([id, poly]) => {
            const isEditing = id === editingShapeId;
            const isMoving = id === movingShapeId;
            if (poly.getEditable() !== isEditing) {
                poly.setEditable(isEditing);
            }
            if (poly.getDraggable() !== isMoving) {
                poly.setDraggable(isMoving);
            }
        });
    }, [editingShapeId, movingShapeId, polygons]);


    const updateShape = (id: string, poly: google.maps.Polygon) => {
        const newPath = poly.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        const newArea = google.maps.geometry.spherical.computeArea(newPath);
        
        setShapes(prev => prev.map(s => {
            if (s.id === id) {
                // Any edit/move converts a rectangle to a polygon
                return {
                    id: s.id,
                    type: 'polygon',
                    path: newPath,
                    area: newArea
                };
            }
            return s;
        }));
    };
  
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
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<string | null>(null);

  const isInteractingWithShape = !!editingShapeId || !!movingShapeId;

  const handleShapeClick = useCallback((shapeId: string, event: google.maps.MapMouseEvent) => {
    if (!map || !event.domEvent) return;
    event.domEvent.preventDefault();
    event.domEvent.stopPropagation();
    
    // Stop editing/moving other shapes when opening context menu
    setEditingShapeId(null);
    setMovingShapeId(null);
    
    const projection = map.getProjection();
    if (!projection) return;
    
    const scale = Math.pow(2, map.getZoom()!);
    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const nw = new google.maps.LatLng(ne.lat(), sw.lng());
    
    const worldPoint = projection.fromLatLngToPoint(event.latLng!);
    const mapTopLeft = projection.fromLatLngToPoint(nw);
    
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
    if (editingShapeId === shapeId) {
      setEditingShapeId(null);
    }
    if (movingShapeId === shapeId) {
      setMovingShapeId(null);
    }
    closeContextMenu();
  };
  
  const handleEditShape = (shapeId: string) => {
    setMovingShapeId(null);
    setEditingShapeId(shapeId);
    closeContextMenu();
  }

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      setEditingShapeId(null); // Stop editing when clicking the map
      setMovingShapeId(null); // Stop moving when clicking the map
    };
    if (map) {
      map.addListener('click', handleClickOutside);
      map.addListener('dragstart', closeContextMenu);
    }
    return () => {
      if (map) {
        google.maps.event.clearInstanceListeners(map);
      }
    }
  }, [map, closeContextMenu]);


  return (
    <div className={className ?? 'relative w-full h-full'}>
      <Map
        defaultCenter={{lat: 53.483959, lng: -2.244644}}
        defaultZoom={7}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
        gestureHandling={selectedTool === 'pan' && !isInteractingWithShape ? 'greedy' : 'none'}
        zoomControl={selectedTool === 'pan' && !isInteractingWithShape}
        disableDoubleClickZoom={selectedTool !== 'pan'}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        className="w-full h-full"
      >
        {isLoaded && <DrawingManagerComponent selectedTool={selectedTool} setShapes={setShapes} setSelectedTool={setSelectedTool} />}
        {isLoaded && <DrawnShapes shapes={shapes} setShapes={setShapes} onShapeClick={handleShapeClick} editingShapeId={editingShapeId} setEditingShapeId={setEditingShapeId} movingShapeId={movingShapeId} setMovingShapeId={setMovingShapeId} />}
      </Map>

       {contextMenu && (
        <ShapeContextMenu
          position={contextMenu.position}
          shapeId={contextMenu.shapeId}
          onDelete={handleDeleteShape}
          onEdit={handleEditShape}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
