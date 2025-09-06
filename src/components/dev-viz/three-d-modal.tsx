
'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ElevationGrid, Tool, LatLng } from '@/lib/types';
import { uuid } from '@/components/map/map-canvas';
import DeckGL, { PickingInfo } from '@deck.gl/react';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { PolygonLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import { Map } from 'react-map-gl';
import { Move3d, MousePointer, ZoomIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as turf from '@turf/turf';

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-v9';

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
}

function NavigationGuide() {
    return (
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-md p-3 rounded-lg shadow-lg border text-xs text-foreground w-60 z-10">
            <h4 className="font-bold mb-2 flex items-center gap-2"><Move3d className="h-4 w-4" /> 3D Navigation</h4>
            <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><MousePointer className="h-4 w-4 text-muted-foreground" /> <strong>Pan/Select:</strong> Left-click + Drag</li>
                <li className="flex items-center gap-2"><Move3d className="h-4 w-4 text-muted-foreground" /> <strong>Rotate/Pitch:</strong> Right-click + Drag</li>
                <li className="flex items-center gap-2"><ZoomIn className="h-4 w-4 text-muted-foreground" /> <strong>Zoom:</strong> Scroll wheel</li>
            </ul>
        </div>
    )
}

const AutofillDrawingTool: React.FC<{
    onDrawEnd: (path: LatLng[]) => void;
    setSelectedTool: (tool: Tool) => void;
}> = ({ onDrawEnd, setSelectedTool }) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const pathRef = useRef<LatLng[]>([]);
    const [polyline, setPolyline] = useState<any>(null);
    const { toast } = useToast();

    const onDragStart = (info: any) => {
        if (!info.coordinate) return;
        setIsDrawing(true);
        pathRef.current = [ { lng: info.coordinate[0], lat: info.coordinate[1] } ];
    };

    const onDrag = (info: any) => {
        if (!isDrawing || !info.coordinate) return;
        pathRef.current.push({ lng: info.coordinate[0], lat: info.coordinate[1] });
        // This is a simplified representation. In a real scenario, you'd update a layer.
        // For now, we just collect points.
    };

    const onDragEnd = (info: any) => {
        if (!isDrawing) return;
        
        setIsDrawing(false);
        if (pathRef.current.length > 2) {
            onDrawEnd([...pathRef.current, pathRef.current[0]]); // Close the polygon
        } else {
            toast({
                variant: 'destructive',
                title: 'Area Too Small',
                description: 'Please draw a larger area to fill.',
            });
        }
        pathRef.current = [];
        setSelectedTool('pan');
    };
    
    // We need to add these as props to DeckGL
    return <DeckGL onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} getCursor={() => 'crosshair'} />;
};


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
}: ThreeDVisualizationProps) {

  const { toast } = useToast();
  const [viewState, setViewState] = useState(initialViewState);
  const isFirstLoad = React.useRef(true);
  const [isDrawingAutofill, setIsDrawingAutofill] = useState(false);
  const [autofillPath, setAutofillPath] = useState<LatLng[] | null>(null);

  // Update internal view state if the initial state prop changes (e.g., when re-entering 3D mode)
  useEffect(() => {
    if (isFirstLoad.current) {
        setViewState(initialViewState);
        isFirstLoad.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewState]);

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

        const fillPolygon = turf.polygon([fillAreaPath.map(p => [p.lng, p.lat])]);
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

  const onDragStart = (info: PickingInfo) => {
    if (selectedTool !== 'autofill' || !info.coordinate) return;
    setIsDrawingAutofill(true);
    setAutofillPath([{ lng: info.coordinate[0], lat: info.coordinate[1] }]);
  };

  const onDrag = (info: PickingInfo) => {
    if (!isDrawingAutofill || !info.coordinate) return;
    setAutofillPath(prev => prev ? [...prev, { lng: info.coordinate[0], lat: info.coordinate[1] }] : null);
  };
  
  const onDragEnd = (info: PickingInfo) => {
    if (!isDrawingAutofill) return;
    
    setIsDrawingAutofill(false);
    if (autofillPath && autofillPath.length > 2) {
        handleAutofill([...autofillPath, autofillPath[0]]);
    } else {
        toast({
            variant: 'destructive',
            title: 'Area Too Small',
            description: 'Please draw a larger area to fill.',
        });
    }
    setAutofillPath(null);
    setSelectedTool('pan');
  };

  const handleClick = (info: PickingInfo) => {
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

  // Memoize layer creation for performance.
  const layers = useMemo(() => {
    if (!elevationGrid.pointGrid || !elevationGrid.xyBounds) return [];

    const { grid } = elevationGrid.pointGrid;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds;

    // Terrain Layer for elevation visualization.
    const terrainLayer = new TerrainLayer({
      id: 'terrain',
      minZoom: 0,
      maxZoom: 20,
      elevationData: grid,
      texture: MAP_STYLE,
      bounds: [minX, minY, maxX, maxY],
      material: {
        diffuse: 0.9,
      },
      zScaler: 1.2,
    });
    
    // Polygon layer for building assets.
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

    // Polygon layer for zones
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
        data: autofillPath ? [autofillPath] : [],
        getPolygon: d => d.map(p => [p.lng, p.lat]),
        getFillColor: [255, 193, 7, 50],
        getLineColor: [255, 193, 7, 200],
        getLineWidth: 2,
        lineWidthMinPixels: 2,
    });


    return [terrainLayer, boundaryLayer, zoneLayer, buildingLayer, autofillDrawLayer];
  }, [elevationGrid, assets, zones, selectedAssetId, boundary, autofillPath]);

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
    controller: true,
    style: { position: 'relative', width: '100%', height: '100%' },
    onClick: handleClick,
    getCursor: ({ isDragging }: { isDragging: boolean }) => {
        if (isDrawingAutofill) return 'crosshair';
        if (isDragging) return 'grabbing';
        if (selectedTool === 'asset') return 'copy';
        if (selectedTool === 'autofill') return 'crosshair';
        return 'grab';
    },
    onDragStart: selectedTool === 'autofill' ? onDragStart : undefined,
    onDrag: selectedTool === 'autofill' ? onDrag : undefined,
    onDragEnd: selectedTool === 'autofill' ? onDragEnd : undefined,
  };

  return (
    <div className="w-full h-full relative">
      <DeckGL {...deckProps}>
        <Map 
          mapStyle={MAP_STYLE} 
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          preventStyleDiffing
          interactive={false}
        />
      </DeckGL>
      <NavigationGuide />
    </div>
  );
}
