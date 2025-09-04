

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {Map, useMap, useApiIsLoaded, InfoWindow} from '@vis.gl/react-google-maps';
import type { Shape, Tool, ElevationGrid, ElevationGridCell, LatLng } from '@/lib/types';
import { ShapeContextMenu } from './shape-context-menu';
import { useToast } from '@/hooks/use-toast';
import { analyzeElevation } from '@/services/elevation';
import { BufferDialog, type BufferState } from './buffer-dialog';
import { ZoneDialog, type ZoneDialogState } from './zone-dialog';
import { applyBuffer } from '@/services/buffer';
import { SiteMarker } from './site-marker';

interface MapCanvasProps {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  gridResolution: number;
  steepnessThreshold: number;
  elevationGrid: ElevationGrid | null;
  setElevationGrid: (grid: ElevationGrid | null) => void;
  isAnalysisVisible: boolean;
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onBoundaryDrawn: (shape: Omit<Shape, 'id'>) => void;
  className?: string;
}

interface ContextMenuState {
  shapeId: string;
  position: { x: number; y: number };
}

export function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const DrawingManagerComponent: React.FC<{
  selectedTool: Tool,
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[],
  onZoneDrawn: (path: LatLng[], area: number) => void;
  onBoundaryDrawn: (shape: Omit<Shape, 'id'>) => void;
}> = ({ selectedTool, setSelectedTool, shapes, onZoneDrawn, onBoundaryDrawn }) => {
  const map = useMap();
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const { toast } = useToast();

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
    
    const isBoundaryDrawingTool = selectedTool === 'rectangle' || selectedTool === 'polygon' || selectedTool === 'freehand';
    const isZoneDrawingTool = selectedTool === 'zone';
    
    let drawingMode = null;
    if (isBoundaryDrawingTool) {
        drawingMode = selectedTool === 'rectangle'
            ? google.maps.drawing.OverlayType.RECTANGLE
            : google.maps.drawing.OverlayType.POLYGON;
    } else if (isZoneDrawingTool) {
        drawingMode = google.maps.drawing.OverlayType.POLYGON;
    }

    drawingManager.setOptions({
        polygonOptions: {
            ...drawingManager.get('polygonOptions'),
            fillColor: isZoneDrawingTool ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
            strokeColor: isZoneDrawingTool ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
        }
    })

    drawingManager.setDrawingMode(drawingMode);

  }, [selectedTool, drawingManager]);

  useEffect(() => {
    if (!drawingManager) return;

    const onComplete = (overlay: google.maps.Rectangle | google.maps.Polygon) => {
        let path: LatLng[], area: number;
        let type: Shape['type'];

        if (overlay instanceof google.maps.Rectangle) {
            const bounds = overlay.getBounds()!;
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            path = [
              { lat: sw.lat(), lng: sw.lng() },
              { lat: ne.lat(), lng: sw.lng() },
              { lat: ne.lat(), lng: ne.lng() },
              { lat: sw.lat(), lng: ne.lng() },
            ];
            type = 'rectangle';
        } else { // Polygon
            path = overlay.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
            type = selectedTool === 'zone' ? 'zone' : 'polygon';
        }
        
        area = google.maps.geometry.spherical.computeArea(path);

        if (selectedTool === 'zone') {
            onZoneDrawn(path, area);
        } else {
            // This is a boundary drawing tool
            const hasBoundary = shapes.some(s => !s.zoneMeta && !s.assetMeta && !s.bufferMeta);
            if (hasBoundary && type !== 'zone') {
                toast({
                    variant: 'destructive',
                    title: 'Boundary Exists',
                    description: 'Only one main project boundary can be drawn. Please clear the existing boundary first.',
                });
            } else {
                onBoundaryDrawn({ type, path, area });
            }
        }
        
        overlay.setMap(null); 
        setSelectedTool('pan');
    };

    const rectListener = google.maps.event.addListener(drawingManager, 'rectanglecomplete', onComplete);
    const polyListener = google.maps.event.addListener(drawingManager, 'polygoncomplete', onComplete);

    return () => {
      google.maps.event.removeListener(rectListener);
      google.maps.event.removeListener(polyListener);
    };
  }, [drawingManager, setSelectedTool, selectedTool, onZoneDrawn, onBoundaryDrawn, shapes, toast]);
  
  return null;
}

const DrawnShapes: React.FC<{
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  onShapeRightClick: (shapeId: string, event: google.maps.MapMouseEvent) => void;
  onShapeClick: (shapeId: string, isCtrlOrMeta: boolean) => void;
  selectedShapeIds: string[];
  editingShapeId: string | null;
  setEditingShapeId: (id: string | null) => void;
  movingShapeId: string | null;
  setMovingShapeId: (id: string | null) => void;
}> = ({ shapes, setShapes, onShapeRightClick, onShapeClick, selectedShapeIds, editingShapeId, setEditingShapeId, movingShapeId, setMovingShapeId }) => {
    const map = useMap();
    const [polygons, setPolygons] = useState<{[id: string]: google.maps.Polygon}>({});
    const { toast } = useToast();
    const [hasShownMovePrompt, setHasShownMovePrompt] = useState(false);
  
    // Effect to create and manage polygon instances on the map
    useEffect(() => {
      if (!map) return;
  
      const newPolygons: {[id: string]: google.maps.Polygon} = {};
      const bufferedParentIds = new Set(shapes.filter(s => s.bufferMeta).map(s => s.bufferMeta!.originalShapeId));

      const getZoneColor = (kind: Shape['zoneMeta']['kind']) => {
        switch(kind) {
            case 'residential': return 'rgba(134, 239, 172, 0.5)'; // green-300
            case 'commercial': return 'rgba(147, 197, 253, 0.5)'; // blue-300
            case 'amenity': return 'rgba(252, 211, 77, 0.5)'; // amber-300
            case 'green_space': return 'rgba(34, 197, 94, 0.5)'; // green-500
            default: return 'hsl(var(--primary))';
        }
      }

      shapes.forEach(shape => {
        const path = shape.path;
  
        const isEditing = shape.id === editingShapeId;
        const isMoving = shape.id === movingShapeId;
        const isSelected = selectedShapeIds.includes(shape.id);
        const isBuffer = shape.type === 'buffer';
        const isZone = !!shape.zoneMeta;
        const isAsset = !!shape.assetMeta;
        const isBufferedParent = bufferedParentIds.has(shape.id);
        
        let fillColor = isBuffer ? 'hsl(var(--accent))' : 'hsl(var(--primary))';
        let strokeColor = isBuffer ? 'hsl(var(--accent))' : 'hsl(var(--primary))';
        let fillOpacity = isMoving ? 0.5 : isSelected ? 0.45 : isBuffer ? 0.25 : 0.3;
        let strokeWeight = isSelected ? 3.5 : isBuffer ? 2.5 : 2;

        if (isZone) {
            fillColor = getZoneColor(shape.zoneMeta!.kind);
            strokeColor = fillColor;
            fillOpacity = 0.6;
            strokeWeight = 1.5;
        }

        if (isAsset) {
            // Asset footprints are just simple outlines
            fillOpacity = 0.4;
            fillColor = '#334155'; // slate-700
            strokeColor = '#0f172a'; // slate-900
            strokeWeight = 1;
        }


        const polyOptions: google.maps.PolygonOptions = {
          paths: path,
          strokeColor,
          strokeOpacity: isMoving ? 1.0 : 0.8,
          strokeWeight,
          fillColor,
          fillOpacity,
          map: map,
          clickable: true,
          editable: isEditing,
          draggable: isMoving,
          zIndex: isZone ? 0 : isSelected ? 2 : 1,
        };

        if (isBufferedParent) {
            polyOptions.strokeOpacity = 0; // Make solid line invisible
            polyOptions.icons = [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 1,
                    strokeWeight: 2.5,
                    strokeColor: 'hsl(var(--accent))',
                    scale: 4,
                },
                offset: '0',
                repeat: '15px'
            }];
        }

        const poly = new google.maps.Polygon(polyOptions);

        poly.addListener('rightclick', (e: google.maps.MapMouseEvent) => onShapeRightClick(shape.id, e));
        poly.addListener('click', (e: google.maps.MapMouseEvent) => {
            onShapeClick(shape.id, e.domEvent.ctrlKey || e.domEvent.metaKey);
            
            if (editingShapeId && editingShapeId !== shape.id) {
                // If another shape is being edited, clicking this one stops the other edit
                setEditingShapeId(null);
            }
        });
        
        poly.addListener('dblclick', () => {
            if (isBuffer || isAsset) {
                toast({ title: 'This shape cannot be moved or edited directly.' });
                return;
            }
            setEditingShapeId(null); // Stop editing if we start moving
            setMovingShapeId(shape.id);
            if (!hasShownMovePrompt) {
                toast({
                    title: "Shape is now movable",
                    description: "Click and drag to move the shape. Click the map to stop moving.",
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
            poly.addListener('dragend', () => {
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
        Object.values(newPolygons).forEach(poly => {
            google.maps.event.clearInstanceListeners(poly);
            poly.setMap(null)
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shapes, map, editingShapeId, movingShapeId, selectedShapeIds]);


    // Effect to update the editable/draggable properties of polygons when editing/moving state changes
    useEffect(() => {
        Object.entries(polygons).forEach(([id, poly]) => {
            const isEditing = id === editingShapeId;
            const isMoving = id === movingShapeId;
            const shape = shapes.find(s => s.id === id);

            const shouldBeEditable = isEditing && !shape?.bufferMeta && !shape?.assetMeta;
            const shouldBeDraggable = isMoving && !shape?.bufferMeta && !shape?.assetMeta;

            if (poly.getEditable() !== shouldBeEditable) {
                poly.setEditable(shouldBeEditable);
            }
            if (poly.getDraggable() !== shouldBeDraggable) {
                poly.setDraggable(shouldBeDraggable);
            }
        });
    }, [editingShapeId, movingShapeId, polygons, shapes]);


    const updateShape = (id: string, poly: google.maps.Polygon) => {
        const newPath = poly.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        const newArea = google.maps.geometry.spherical.computeArea(newPath);
        
        setShapes(prev => {
            const newShapes = prev.map(s => {
                if (s.id === id) {
                    // Any edit/move converts the original shape type to a polygon
                    return { ...s, type: s.zoneMeta ? 'zone' : 'polygon', path: newPath, area: newArea, bufferMeta: undefined };
                }
                return s;
            });
            
            // Now, find any buffers that depended on this shape and update them
            return newShapes.map(s => {
                if (s.bufferMeta?.originalShapeId === id) {
                    const originalShape = newShapes.find(os => os.id === id);
                    if (!originalShape) return s; // Should not happen
                    const buffered = applyBuffer(originalShape, s.bufferMeta.distance);
                    return { ...s, path: buffered.path, area: buffered.area };
                }
                return s;
            });
        });
    };
  
    return null;
  };

const ElevationGridDisplay: React.FC<{
  elevationGrid: ElevationGrid | null;
  steepnessThreshold: number;
}> = ({ elevationGrid, steepnessThreshold }) => {
  const map = useMap();
  const [gridPolygons, setGridPolygons] = useState<google.maps.Polygon[]>([]);
  const [activeCell, setActiveCell] = useState<ElevationGridCell | null>(null);

  useEffect(() => {
    // Clear existing polygons
    gridPolygons.forEach(poly => {
        google.maps.event.clearInstanceListeners(poly);
        poly.setMap(null);
    });
    setGridPolygons([]); // Reset state

    if (!map || !elevationGrid || !elevationGrid.cells) {
      return;
    }

    const newPolys = elevationGrid.cells.map(cell => {
      const isValid = isFinite(cell.slope);
      const isSteep = isValid && cell.slope > steepnessThreshold;
      
      let fillColor = '#808080'; // Grey for invalid data
      let strokeColor = '#606060';
      if (isValid) {
        fillColor = isSteep ? '#ef4444' : '#22c55e';
        strokeColor = isSteep ? '#dc2626' : '#16a34a';
      }

      const poly = new google.maps.Polygon({
        map,
        paths: cell.path,
        fillColor,
        strokeColor,
        fillOpacity: 0.45,
        strokeWeight: 0.5,
        strokeOpacity: 0.6,
        clickable: true,
      });

      poly.addListener('click', () => {
        setActiveCell(cell);
      });

      return poly;
    });

    setGridPolygons(newPolys);
    
    return () => {
        newPolys.forEach(poly => {
            google.maps.event.clearInstanceListeners(poly);
            poly.setMap(null);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, elevationGrid, steepnessThreshold]);

  const handleInfoWindowClose = () => {
    setActiveCell(null);
  };

  return (
    <>
      {activeCell && (
        <InfoWindow
          position={activeCell.center}
          onCloseClick={handleInfoWindowClose}
        >
          <div className="text-center p-1">
            {isFinite(activeCell.slope) ? (
              <>
                <p className="text-lg font-bold">{activeCell.slope.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Steepness</p>
              </>
            ) : (
              <p className="text-sm font-medium">No data</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const FreehandDrawingTool: React.FC<{
  onDrawEnd: (path: LatLng[]) => void;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
}> = ({ onDrawEnd, setSelectedTool, shapes }) => {
  const map = useMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const pathRef = useRef<LatLng[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!map) return;

    const onMouseDown = (e: google.maps.MapMouseEvent) => {
      // Prevent drawing a boundary if one already exists
      const hasBoundary = shapes.some(s => !s.zoneMeta && !s.assetMeta && !s.bufferMeta);
      if (hasBoundary) {
          toast({
              variant: 'destructive',
              title: 'Boundary Exists',
              description: 'Only one main project boundary can be drawn. Please clear the existing boundary first.',
          });
          setSelectedTool('pan');
          return;
      }

      setIsDrawing(true);
      pathRef.current = [];
      if (e.latLng) {
        pathRef.current.push(e.latLng.toJSON());
      }
      
      // Create a temporary polyline for visual feedback
      polylineRef.current = new google.maps.Polyline({
        map,
        path: pathRef.current,
        strokeColor: 'hsl(var(--accent))',
        strokeWeight: 3,
        strokeOpacity: 0.7,
      });
    };

    const onMouseMove = (e: google.maps.MapMouseEvent) => {
      if (!isDrawing || !e.latLng) return;
      pathRef.current.push(e.latLng.toJSON());
      // Create a new array to force a re-render of the polyline
      polylineRef.current?.setPath([...pathRef.current]);
    };

    const onMouseUp = () => {
      if (!isDrawing || pathRef.current.length < 3) {
        setIsDrawing(false);
        polylineRef.current?.setMap(null); // Clean up temp line
        return;
      }

      const finalPath = [...pathRef.current];
      onDrawEnd(finalPath);
      
      setIsDrawing(false);
      pathRef.current = [];
      polylineRef.current?.setMap(null); // Clean up temp line
      setSelectedTool('pan');
    };

    const downListener = map.addListener('mousedown', onMouseDown);
    const moveListener = map.addListener('mousemove', onMouseMove);
    const upListener = map.addListener('mouseup', onMouseUp);

    return () => {
      downListener.remove();
      moveListener.remove();
      upListener.remove();
      polylineRef.current?.setMap(null); // Cleanup on unmount
    };
  }, [map, isDrawing, onDrawEnd, setSelectedTool, shapes, toast]);

  return null;
};


export const MapCanvas: React.FC<MapCanvasProps> = ({
  selectedTool,
  shapes,
  setShapes,
  setSelectedTool,
  gridResolution,
  steepnessThreshold,
  elevationGrid,
  setElevationGrid,
  isAnalysisVisible,
  selectedShapeIds,
  setSelectedShapeIds,
  onBoundaryDrawn,
  className,
}) => {
  const isLoaded = useApiIsLoaded();
  const map = useMap();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<string | null>(null);
  const { toast } = useToast();
  const [elevationService, setElevationService] = useState<google.maps.ElevationService | null>(null);
  const [bufferState, setBufferState] = useState<BufferState>({ isOpen: false, shapeId: null });
  const [zoneDialogState, setZoneDialogState] = useState<ZoneDialogState>({ isOpen: false, path: null, area: null });

  const isInteractingWithShape = !!editingShapeId || !!movingShapeId;
  const isDrawing = ['rectangle', 'polygon', 'freehand', 'zone'].includes(selectedTool);

  const projectBoundary = shapes.find(s => !s.bufferMeta && !s.zoneMeta && !s.assetMeta);

  useEffect(() => {
    if (map) {
      let cursor = 'grab';
        if (selectedTool === 'freehand' || selectedTool === 'rectangle' || selectedTool === 'polygon' || selectedTool === 'zone') cursor = 'crosshair';
        if (selectedTool === 'asset') cursor = 'copy';
      map.setOptions({ draggableCursor: cursor });
    }
  }, [map, selectedTool]);
  
  useEffect(() => {
    if (isLoaded) {
        setElevationService(new window.google.maps.ElevationService());
    }
  }, [isLoaded]);

  useEffect(() => {
    const runAnalysis = async () => {
        if (selectedShapeIds.length === 1 && isLoaded && elevationService) {
            const shapeToAnalyze = shapes.find(s => s.id === selectedShapeIds[0]);
            if (shapeToAnalyze) {
                try {
                    const grid = await analyzeElevation(shapeToAnalyze, elevationService, gridResolution);
                    setElevationGrid(grid);
                } catch (err) {
                    console.error("Error getting elevation grid:", err);
                    toast({
                        variant: 'destructive',
                        title: 'Elevation API Error',
                        description: 'Could not fetch elevation data. Please check your API key and permissions.'
                    });
                    setElevationGrid(null); // Clear grid on error
                }
            } else {
                setElevationGrid(null);
            }
        } else {
            // If not exactly one shape is selected, clear the grid
            if (elevationGrid !== null) {
                setElevationGrid(null);
            }
        }
    };
    runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, gridResolution, isLoaded, elevationService, selectedShapeIds]);

  const handleShapeRightClick = useCallback((shapeId: string, event: google.maps.MapMouseEvent) => {
    if (!map || !event.domEvent) return;
    event.domEvent.preventDefault();
    event.domEvent.stopPropagation();
    
    // Stop editing/moving other shapes when opening context menu
    setEditingShapeId(null);
    setMovingShapeId(null);

    // If the right-clicked shape is not part of the current selection,
    // make it the only selected shape.
    if (!selectedShapeIds.includes(shapeId)) {
        setSelectedShapeIds([shapeId]);
    }
    
    const projection = map.getProjection();
    if (!projection) return;
    
    const scale = Math.pow(2, map.getZoom()!);
    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const nw = new google.maps.LatLng(ne.lat(), sw.lng());
    
    const worldPoint = projection.fromLatLngToPoint(event.latLng!);
    const mapTopLeft = projection.fromLatLngToPoint(nw)!;
    
    setContextMenu({
        shapeId: shapeId,
        position: {
            x: (worldPoint.x - mapTopLeft.x) * scale,
            y: (worldPoint.y - mapTopLeft.y) * scale,
        }
    });

  }, [map, selectedShapeIds, setSelectedShapeIds]);

  const handleShapeClick = (shapeId: string, isCtrlOrMeta: boolean) => {
    if (selectedTool !== 'pan') return;

    if (isCtrlOrMeta) {
      // Add or remove from selection
      setSelectedShapeIds(
        selectedShapeIds.includes(shapeId)
          ? selectedShapeIds.filter((id) => id !== shapeId)
          : [...selectedShapeIds, shapeId]
      );
    } else {
      // Set as the only selection
      setSelectedShapeIds([shapeId]);
    }
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteShape = (shapeId: string) => {
    // Delete all selected shapes
    setShapes(prev => prev.filter(s => !selectedShapeIds.includes(s.id)));
    setSelectedShapeIds([]);
    if (editingShapeId === shapeId) setEditingShapeId(null);
    if (movingShapeId === shapeId) setMovingShapeId(null);
    closeContextMenu();
  };
  
  const handleEditShape = (shapeId: string) => {
    setSelectedShapeIds([shapeId]);
    setMovingShapeId(null);
    setEditingShapeId(shapeId);
    closeContextMenu();
  };

  const handleBufferShape = (shapeId: string) => {
    setBufferState({ isOpen: true, shapeId });
    closeContextMenu();
  };

  const handleCreateBuffer = (distance: number) => {
    if (!bufferState.shapeId) return;

    const originalShape = shapes.find(s => s.id === bufferState.shapeId);
    if (!originalShape) return;
    
    try {
        const bufferedShape = applyBuffer(originalShape, -distance); // negative for inward buffer
        
        setShapes(prev => [...prev, {
            id: uuid(),
            type: 'buffer',
            path: bufferedShape.path,
            area: bufferedShape.area,
            bufferMeta: {
                originalShapeId: originalShape.id,
                distance: -distance,
            }
        }]);
    } catch (e: any) {
        toast({
            variant: 'destructive',
            title: 'Buffer Error',
            description: e.message || 'Could not create buffer. The distance may be too large.'
        });
    }
  };

   const handleZoneDrawn = useCallback((path: LatLng[], area: number) => {
    setZoneDialogState({ isOpen: true, path, area });
  }, []);

  const handleCreateZone = useCallback((name: string, kind: Shape['zoneMeta']['kind']) => {
    if (!zoneDialogState.path || !zoneDialogState.area) return;
    const newZone: Shape = {
      id: uuid(),
      type: 'zone',
      path: zoneDialogState.path,
      area: zoneDialogState.area,
      zoneMeta: { name, kind },
    };
    setShapes(prev => [...prev, newZone]);
    setZoneDialogState({ isOpen: false, path: null, area: null });
  }, [zoneDialogState, setShapes]);

  const handleFreehandDrawEnd = (path: LatLng[]) => {
      const area = google.maps.geometry.spherical.computeArea(path);
      onBoundaryDrawn({ type: 'freehand', path, area });
  };


  useEffect(() => {
    const handleClickOutside = (e: google.maps.MapMouseEvent) => {
      closeContextMenu();
      setEditingShapeId(null); // Stop editing when clicking the map
      setMovingShapeId(null); // Stop moving when clicking the map
      
      if(selectedTool === 'asset' && e.latLng) {
        // This is a simplified asset placement. A real implementation would have a modal to select asset type.
        const assetSize = 10; // meters
        const center = e.latLng.toJSON();
        const halfSize = assetSize / 111320; // ~meters to degrees
        
        const path = [
          { lat: center.lat - halfSize, lng: center.lng - halfSize },
          { lat: center.lat + halfSize, lng: center.lng - halfSize },
          { lat: center.lat + halfSize, lng: center.lng + halfSize },
          { lat: center.lat - halfSize, lng: center.lng + halfSize },
        ];

        setShapes(prev => [...prev, {
            id: uuid(),
            type: 'rectangle', // Visually it's a rect, but meta identifies it as an asset
            path,
            area: google.maps.geometry.spherical.computeArea(path),
            assetMeta: {
                key: 'house_detached',
                floors: 2,
                rotation: 0,
            }
        }]);
        return;
      }
      
      setSelectedShapeIds([]); // Deselect all shapes
    };

    if (map) {
      const clickListener = map.addListener('click', handleClickOutside);
      const dragListener = map.addListener('dragstart', closeContextMenu);
      return () => {
        clickListener.remove();
        dragListener.remove();
      }
    }
  }, [map, closeContextMenu, setSelectedShapeIds, selectedTool, setShapes]);


  return (
    <div className={className ?? 'relative w-full h-full'}>
      <Map
        defaultCenter={{lat: 53.483959, lng: -2.244644}}
        defaultZoom={7}
        mapTypeId="satellite"
        tilt={0}
        gestureHandling={!isDrawing && !isInteractingWithShape ? 'greedy' : 'none'}
        zoomControl={!isDrawing && !isInteractingWithShape}
        disableDoubleClickZoom={isDrawing || isInteractingWithShape}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        className="w-full h-full"
      >
        {isLoaded && <DrawingManagerComponent selectedTool={selectedTool} shapes={shapes} setSelectedTool={setSelectedTool} onZoneDrawn={handleZoneDrawn} onBoundaryDrawn={onBoundaryDrawn} />}
        {isLoaded && selectedTool === 'freehand' && <FreehandDrawingTool shapes={shapes} onDrawEnd={handleFreehandDrawEnd} setSelectedTool={setSelectedTool} />}
        {isLoaded && <DrawnShapes shapes={shapes} setShapes={setShapes} onShapeRightClick={handleShapeRightClick} onShapeClick={handleShapeClick} selectedShapeIds={selectedShapeIds} editingShapeId={editingShapeId} setEditingShapeId={setEditingShapeId} movingShapeId={movingShapeId} setMovingShapeId={setMovingShapeId} />}
        {isLoaded && elevationGrid && isAnalysisVisible && <ElevationGridDisplay elevationGrid={elevationGrid} steepnessThreshold={steepnessThreshold} />}
        {isLoaded && projectBoundary && <SiteMarker boundary={projectBoundary} />}

      </Map>

       {contextMenu && (
        <ShapeContextMenu
          position={contextMenu.position}
          shapeId={contextMenu.shapeId}
          shapes={shapes}
          onDelete={handleDeleteShape}
          onEdit={handleEditShape}
          onBuffer={handleBufferShape}
          onClose={closeContextMenu}
        />
      )}

      <BufferDialog
        state={bufferState}
        onOpenChange={(isOpen) => setBufferState(prev => ({...prev, isOpen}))}
        onCreateBuffer={handleCreateBuffer}
      />
      <ZoneDialog
        state={zoneDialogState}
        onOpenChange={(isOpen) => setZoneDialogState(prev => ({...prev, isOpen}))}
        onCreateZone={handleCreateZone}
      />
    </div>
  );
};
