
'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ElevationGrid, Tool, LatLng } from '@/lib/types';
import { uuid } from '@/components/map/map-canvas';
import DeckGL, { PickingInfo } from '@deck.gl/react';
import { TerrainLayer, MjolnirEvent } from '@deck.gl/geo-layers';
import { PolygonLayer } from '@deck.gl/layers';
import { PathStyleExtension, DrapingExtension } from '@deck.gl/extensions';
import { Map } from 'react-map-gl';
import { Move3d, MousePointer, ZoomIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as turf from '@turf/turf';

const GRASS_TEXTURE_URL = 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/grass.png';


interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  initialViewState: any;
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  autofillTemplate: Shape | null;
  groundStyle: 'satellite' | 'color' | 'texture';
  groundColor: [number, number, number];
}

function NavigationGuide() {
    return (
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-md p-3 rounded-lg shadow-lg border text-xs text-foreground w-60 z-10">
            <h4 className="font-bold mb-2 flex items-center gap-2"><Move3d className="h-4 w-4" /> 3D Navigation</h4>
            <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><MousePointer className="h-4 w-4 text-muted-foreground" /> <strong>Select/Drag:</strong> Left-click + Drag</li>
                <li className="flex items-center gap-2"><Move3d className="h-4 w-4 text-muted-foreground" /> <strong>Rotate/Pitch:</strong> Right-click + Drag</li>
                <li className="flex items-center gap-2"><ZoomIn className="h-4 w-4 text-muted-foreground" /> <strong>Zoom:</strong> Scroll wheel</li>
            </ul>
        </div>
    )
}

export function ThreeDVisualization({
  assets,
  zones,
  boundary,
  elevationGrid,
  onDeleteAsset,
  selectedAssetId,
  setSelectedAssetId,
  initialViewState,
  selectedTool,
  setSelectedTool,
  setShapes,
  autofillTemplate,
  groundStyle,
  groundColor,
}: ThreeDVisualizationProps) {

  const { toast } = useToast();
  const [viewState, setViewState] = useState(initialViewState);
  const [isDrawingAutofill, setIsDrawingAutofill] = useState(false);
  const [autofillPath, setAutofillPath] = useState<LatLng[] | null>(null);
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dragInfo, setDragInfo] = useState<{ id: string; dx: number; dy: number } | null>(null);


  // Update internal view state if the initial state prop changes (e.g., when re-entering 3D mode)
  useEffect(() => {
    setViewState(initialViewState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewState]);

  useEffect(() => {
    // Start drawing when the tool is selected
    if (selectedTool === 'autofill' && !isDrawingAutofill) {
        setIsDrawingAutofill(true);
        setAutofillPath([]);
    }
    // Cancel drawing if the tool changes
    if (selectedTool !== 'autofill' && isDrawingAutofill) {
        setIsDrawingAutofill(false);
        setAutofillPath(null);
    }
  }, [selectedTool, isDrawingAutofill]);

  const handlePlaceBuilding = useCallback((info: PickingInfo) => {
    if (!info.coordinate) return;
    
    const boundaryCoords = boundary.path.map(p => [p.lng, p.lat]);
    if (boundaryCoords.length > 0 && (boundaryCoords[0][0] !== boundaryCoords[boundaryCoords.length - 1][0] || boundaryCoords[0][1] !== boundaryCoords[boundaryCoords.length - 1][1])) {
        boundaryCoords.push(boundaryCoords[0]);
    }
    const boundaryPoly = turf.polygon([boundaryCoords]);
    const clickPoint = turf.point(info.coordinate);

    if (!turf.booleanPointInPolygon(clickPoint, boundaryPoly)) {
        toast({
            variant: 'destructive',
            title: 'Out of Bounds',
            description: 'Buildings can only be placed inside the main site boundary.',
        });
        return;
    }

    const buildingWidth = 8;
    const buildingDepth = 10;
    const center = { lat: info.coordinate[1], lng: info.coordinate[0] };
    
    const horizontalDistance = buildingWidth / (111.32 * Math.cos(center.lat * (Math.PI / 180)));
    const verticalDistance = buildingDepth / 111.32;
    
    const xmin = center.lng - horizontalDistance/2000;
    const xmax = center.lng + horizontalDistance/2000;
    const ymin = center.lat - verticalDistance/2000;
    const ymax = center.lat + verticalDistance/2000;

    const unrotatedPoly = turf.bboxPolygon([xmin, ymin, xmax, ymax]);
    
    const path = unrotatedPoly.geometry.coordinates[0].map((c: any) => ({ lat: c[1], lng: c[0] }));
    
    const newBuilding: Shape = {
        id: uuid(),
        type: 'rectangle',
        path,
        area: buildingWidth * buildingDepth,
        assetMeta: {
            assetType: 'building',
            key: 'default_building',
            floors: 2,
            rotation: 0,
            width: buildingWidth,
            depth: buildingDepth
        },
    };
    
    setShapes(prev => [...prev, newBuilding]);
    toast({
        title: 'Building Placed',
        description: 'A new building has been added to the site.',
    });

  }, [boundary.path, setShapes, toast]);

    const handleAutofill = (fillAreaPath: LatLng[]) => {
        if (!autofillTemplate || !autofillTemplate.assetMeta) return;

        const fillPolygon = turf.polygon([[...fillAreaPath.map(p => [p.lng, p.lat]), [fillAreaPath[0].lng, fillAreaPath[0].lat]]]);
        const { width = 10, depth = 10, rotation = 0, floors } = autofillTemplate.assetMeta;
        
        const spacingX = width + 5; // 5m spacing
        const spacingY = depth + 8;
        const fillBbox = turf.bbox(fillPolygon);

        const newBuildings: Shape[] = [];

        for (let x = fillBbox[0]; x < fillBbox[2]; x += spacingX / (111.32 * Math.cos(fillBbox[1] * (Math.PI/180))) / 1000) {
            for (let y = fillBbox[1]; y < fillBbox[3]; y += spacingY / 111.32 / 1000) {
                const center = [x, y];
                const pt = turf.point(center);

                if (turf.booleanPointInPolygon(pt, fillPolygon)) {
                     const horizontalDistance = width / (111.32 * Math.cos(center[1] * (Math.PI / 180)));
                     const verticalDistance = depth / 111.32;
        
                     const xmin = center[0] - horizontalDistance/2000;
                     const xmax = center[0] + horizontalDistance/2000;
                     const ymin = center[1] - verticalDistance/2000;
                     const ymax = center[1] + verticalDistance/2000;

                     const newPoly = turf.transformRotate(turf.bboxPolygon([xmin, ymin, xmax, ymax]), rotation, { pivot: center });
                     const newPath = newPoly.geometry.coordinates[0].map((c: number[]) => ({lat: c[1], lng: c[0]}));

                     newBuildings.push({
                        id: uuid(),
                        type: 'rectangle',
                        path: newPath,
                        area: width * depth,
                        assetMeta: { assetType: 'building', key: 'default_building', floors, rotation, width, depth },
                     });
                }
            }
        }
        
        setShapes(prev => [...prev, ...newBuildings]);
        toast({
            title: 'Area Autofilled',
            description: `${newBuildings.length} new buildings were placed.`,
        });
        setAutofillPath(null);
    };

    const handleFinishDrawing = () => {
        if (!isDrawingAutofill || !autofillPath) return;

        if (autofillPath.length > 2) {
            handleAutofill([...autofillPath, autofillPath[0]]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Area Too Small',
                description: 'Please click at least 3 points to define an area.',
            });
        }
        setIsDrawingAutofill(false);
        setAutofillPath(null);
        setSelectedTool('pan');
    };

    const handleSingleClick = (info: PickingInfo) => {
        // If drawing, add a point to the path
        if (isDrawingAutofill && info.coordinate) {
            if (!autofillPath?.length) {
                toast({
                    title: 'Drawing Area',
                    description: 'Click to add points. Double-click to finish.',
                });
            }
            setAutofillPath(prev => {
                const newPath = prev ? [...prev, { lng: info.coordinate[0], lat: info.coordinate[1] }] : [];
                return newPath;
            });
            return;
        }

        // If an asset is clicked, select it
        if (info.object) {
            setSelectedAssetId(info.object.id);
            return;
        }
        
        // If in placement mode, place an asset
        if (selectedTool === 'asset') {
            handlePlaceBuilding(info);
            return;
        }

        // Otherwise, deselect
        setSelectedAssetId(null);
    }
    
    const handleDeckClick = (info: PickingInfo, event: MjolnirEvent) => {
        if (dragInfo) return;

        if (clickTimeout.current) {
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
            if(isDrawingAutofill) handleFinishDrawing();
        } else {
            clickTimeout.current = setTimeout(() => {
                handleSingleClick(info);
                clickTimeout.current = null;
            }, 250);
        }
    };
    
    const onDragStart = (info: PickingInfo) => {
        if (info.object && info.object.id === selectedAssetId) {
            setDragInfo({
                id: info.object.id,
                dx: info.coordinate[0] - info.object.path[0].lng,
                dy: info.coordinate[1] - info.object.path[0].lat,
            });
        }
    };

    const onDrag = (info: PickingInfo) => {
        if (!dragInfo || !info.coordinate) return;

        const newLng = info.coordinate[0] - dragInfo.dx;
        const newLat = info.coordinate[1] - dragInfo.dy;
        
        const originalShape = shapes.find(s => s.id === dragInfo.id);
        if (!originalShape) return;
        
        const lngDiff = newLng - originalShape.path[0].lng;
        const latDiff = newLat - originalShape.path[0].lat;
        
        const newPath = originalShape.path.map(p => ({
            lng: p.lng + lngDiff,
            lat: p.lat + latDiff,
        }));
        
        setShapes(prev => prev.map(s => s.id === dragInfo.id ? {...s, path: newPath} : s));
    };

    const onDragEnd = () => {
        setDragInfo(null);
    };


  // Memoize layer creation for performance.
  const layers = useMemo(() => {
    if (!elevationGrid.pointGrid || !elevationGrid.xyBounds) return [];

    const { grid } = elevationGrid.pointGrid;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds;
    
    const terrainLayer = new TerrainLayer({
        id: 'terrain',
        minZoom: 0,
        maxZoom: 20,
        elevationData: grid,
        bounds: [minX, minY, maxX, maxY],
        material: {
          diffuse: 0.9,
        },
        zScaler: 1.2,
      });

    const getGroundCoverColor = () => {
        if (groundStyle === 'satellite') return [0, 0, 0, 0]; // Transparent
        if (groundStyle === 'color') return [...groundColor, 255];
        return [255, 255, 255, 255]; // White for texture base
    }

    const groundCoverLayer = new PolygonLayer({
        id: 'ground-cover',
        data: [boundary],
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: getGroundCoverColor(),
        filled: true,
        stroked: false,
        texture: groundStyle === 'texture' ? GRASS_TEXTURE_URL : undefined,
        extensions: [new DrapingExtension()],
        drapingSource: 'terrain',
        drapingTarget: 'terrain',
    });
    
    const buildingLayer = new PolygonLayer({
        id: 'buildings',
        data: assets,
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: d => selectedAssetId === d.id ? [255, 193, 7, 255] : [228, 225, 219, 255], // Light beige color
        getLineColor: d => selectedAssetId === d.id ? [255, 255, 255, 255] : [100, 116, 139, 255], // Slate-500 for outlines
        lineWidthMinPixels: d => selectedAssetId === d.id ? 2 : 1,
        extruded: true,
        getElevation: (d: any) => (d.assetMeta?.floors || 1) * 3, // 3 meters per floor
        pickable: true,
    });

    const getZoneColor = (kind: Shape['zoneMeta']['kind']) => {
        switch(kind) {
            case 'residential': return [134, 239, 172, 100]; // green
            case 'commercial': return [147, 197, 253, 100]; // blue
            case 'amenity': return [252, 211, 77, 100]; // amber
            case 'green_space': return [34, 197, 94, 80]; // darker green
            case 'solar': return [251, 146, 60, 100]; // orange
            default: return [100, 100, 100, 100];
        }
    }

    const zoneLayer = new PolygonLayer({
        id: 'zones',
        data: zones,
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: (d: any) => getZoneColor(d.zoneMeta.kind),
        getLineColor: (d: any) => {
            const color = getZoneColor(d.zoneMeta.kind);
            return [...color.slice(0,3), 200];
        },
        lineWidthMinPixels: 2,
        extruded: false,
    });

    const boundaryLayer = new PolygonLayer({
        id: 'boundary-3d',
        data: [boundary],
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: [0,0,0,0], // transparent fill
        getLineColor: [252, 165, 3, 255], // bright orange
        getLineWidth: 4,
        lineWidthMinPixels: 4,
        getDashArray: [8, 4],
        dashJustified: true,
        extensions: [new PathStyleExtension({dash: true})],
        extruded: false,
    });
    
    const autofillDrawLayer = new PolygonLayer({
        id: 'autofill-draw-layer',
        data: autofillPath ? [{polygon: autofillPath.map(p => [p.lng, p.lat])}] : [],
        getFillColor: [255, 193, 7, 50],
        getLineColor: [255, 193, 7, 200],
        getLineWidth: 2,
        lineWidthMinPixels: 2,
    });


    return [terrainLayer, groundCoverLayer, zoneLayer, buildingLayer, boundaryLayer, autofillDrawLayer];
  }, [elevationGrid, assets, zones, selectedAssetId, boundary, autofillPath, groundStyle, groundColor]);

  if (!viewState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p>Loading 3D View...</p>
      </div>
    );
  }
  
  const deckProps = {
    layers: layers,
    viewState: viewState,
    onViewStateChange: ({viewState}: {viewState: any}) => setViewState(viewState),
    controller: {doubleClickZoom: false},
    style: { position: 'relative', width: '100%', height: '100%' },
    onClick: handleDeckClick,
    onDragStart,
    onDrag,
    onDragEnd,
    getCursor: ({ isDragging }: { isDragging: boolean }) => {
        if (isDrawingAutofill) return 'crosshair';
        if (isDragging) return 'grabbing';
        if (selectedTool === 'asset') return 'copy';
        return 'grab';
    },
  };

  return (
    <div className="w-full h-full relative">
      <DeckGL {...deckProps}>
        <Map 
            mapStyle={'mapbox://styles/mapbox/satellite-v9'} 
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            preventStyleDiffing
            interactive={false}
        />
      </DeckGL>
      <NavigationGuide />
    </div>
  );
}
