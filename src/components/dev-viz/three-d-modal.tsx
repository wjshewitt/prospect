
'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { Shape, ElevationGrid, Tool } from '@/lib/types';
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
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
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
  setShapes,
}: ThreeDVisualizationProps) {

  const [viewState, setViewState] = useState(initialViewState);
  const isFirstLoad = React.useRef(true);

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
    
    // Check if click is inside the main boundary
    const boundaryPoly = turf.polygon(boundary.path.map(p => [p.lng, p.lat]));
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
    const centerPoint = turf.point([center.lng, center.lat]);
    
    // Create a rectangle and rotate it
    const halfW = buildingWidth / 2;
    const halfD = buildingDepth / 2;
    const bbox: turf.BBox = [
      centerPoint.geometry.coordinates[0] - halfW, 
      centerPoint.geometry.coordinates[1] - halfD, 
      centerPoint.geometry.coordinates[0] + halfW, 
      centerPoint.geometry.coordinates[1] + halfD
    ];
    
    const unrotatedPoly = turf.bboxPolygon(bbox);
    
    // Convert meters to degrees for turf
    const turfPoly = turf.toMercator(unrotatedPoly);
    const path = turf.getCoords(turf.toWgs84(turfPoly))[0].map((c: any) => ({ lat: c[1], lng: c[0] }));
    
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


    return [terrainLayer, boundaryLayer, zoneLayer, buildingLayer];
  }, [elevationGrid, assets, zones, selectedAssetId, boundary, setSelectedAssetId]);

  if (!viewState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p>Loading 3D View...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={({viewState}) => setViewState(viewState)}
        controller={true}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onClick={handleClick}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : (selectedTool === 'asset' ? 'crosshair' : 'grab'))}
      >
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
