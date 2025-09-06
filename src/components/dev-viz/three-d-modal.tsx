
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Shape, ElevationGrid } from '@/lib/types';
import DeckGL from '@deck.gl/react';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { PolygonLayer, PathStyleExtension } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import { Move3d, MousePointer, ZoomIn } from 'lucide-react';

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
}: ThreeDVisualizationProps) {

  const [viewState, setViewState] = useState(initialViewState);

  // Update internal view state if the initial state prop changes (e.g., when re-entering 3D mode)
  useEffect(() => {
    setViewState(initialViewState);
  }, [initialViewState]);

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
        getFillColor: d => selectedAssetId === d.id ? [255, 193, 7, 255] : [228, 228, 231, 255], // Light gray, nearly white
        getLineColor: d => selectedAssetId === d.id ? [255, 255, 255, 255] : [100, 116, 139, 255], // Slate-500 for outlines
        lineWidthMinPixels: d => selectedAssetId === d.id ? 2 : 1,
        extruded: true,
        getElevation: (d: any) => (d.assetMeta?.floors || 1) * 3, // 3 meters per floor
        pickable: true,
        onClick: ({ object }) => {
            setSelectedAssetId(object.id);
        }
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
        onClick={(info, event) => {
            // Deselect asset if clicking on something other than a building (info.object will be null)
             if (!info.object) {
                setSelectedAssetId(null);
             }
        }}
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
