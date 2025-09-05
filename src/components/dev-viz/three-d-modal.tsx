
'use client';

import React, { useMemo, useState } from 'react';
import type { Shape, ElevationGrid } from '@/lib/types';
import DeckGL from '@deck.gl/react';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { PolygonLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl';
import { useMap } from '@vis.gl/react-google-maps';
import { Button } from '../ui/button';
import { Trash2, Star, Move3d, MousePointer, ZoomIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAP_STYLE = 'mapbox://styles/mapbox/satellite-v9';

interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

// Function to calculate the center of the boundary for the initial view state.
const getBoundaryCenter = (boundary: Shape) => {
  const bounds = new window.google.maps.LatLngBounds();
  boundary.path.forEach(p => bounds.extend(p));
  const center = bounds.getCenter();
  return {
    longitude: center.lng(),
    latitude: center.lat(),
  };
};

function NavigationGuide() {
    return (
        <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-md p-3 rounded-lg shadow-lg border text-xs text-foreground w-60">
            <h4 className="font-bold mb-2 flex items-center gap-2"><Move3d className="h-4 w-4" /> 3D Navigation</h4>
            <ul className="space-y-1.5">
                <li className="flex items-center gap-2"><MousePointer className="h-4 w-4 text-muted-foreground" /> <strong>Pan:</strong> Left-click + Drag</li>
                <li className="flex items-center gap-2"><Move3d className="h-4 w-4 text-muted-foreground" /> <strong>Rotate/Pitch:</strong> Right-click + Drag</li>
                <li className="flex items-center gap-2"><ZoomIn className="h-4 w-4 text-muted-foreground" /> <strong>Zoom:</strong> Scroll wheel</li>
            </ul>
        </div>
    )
}

export function ThreeDVisualizationModal({
  assets,
  zones,
  boundary,
  elevationGrid,
  onDeleteAsset
}: ThreeDVisualizationProps) {
  const map = useMap();
  const { toast } = useToast();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Set the initial view state to focus on the center of the boundary.
  const initialViewState = useMemo(() => {
    if (!boundary) return null;
    const { latitude, longitude } = getBoundaryCenter(boundary);
    return {
      latitude,
      longitude,
      zoom: 15,
      pitch: 60,
      bearing: 0,
    };
  }, [boundary]);

  // Memoize layer creation for performance.
  const layers = useMemo(() => {
    if (!elevationGrid.pointGrid || !elevationGrid.xyBounds) return [];

    const { grid, nx, ny } = elevationGrid.pointGrid;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds;

    // A neutral grey for the terrain for a clean, analytical look.
    const TERRAIN_COLOR: [number, number, number] = [170, 170, 180];

    // Terrain Layer for elevation visualization.
    const terrainLayer = new TerrainLayer({
      id: 'terrain',
      minZoom: 0,
      maxZoom: 20,
      elevationData: grid,
      bounds: [minX, minY, maxX, maxY],
      color: TERRAIN_COLOR,
      wireframe: false,
      elevationDecoder: {
        rScaler: 1 / 256,
        gScaler: 1,
        bScaler: 256,
        offset: 0,
      },
      zScaler: 1.2,
    });
    
    // Polygon layer for building assets.
    const buildingLayer = new PolygonLayer({
        id: 'buildings',
        data: assets,
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: d => selectedAssetId === d.id ? [255, 193, 7, 255] : [51, 65, 85, 255],
        getLineColor: [15, 23, 42, 255],
        lineWidthMinPixels: 1,
        extruded: true,
        getElevation: (d: any) => (d.assetMeta?.floors || 1) * 3, // 3 meters per floor
        pickable: true,
        onClick: ({ object }) => {
            setSelectedAssetId(object.id);
        }
    });

    // Polygon layer for zones
    const zoneLayer = new PolygonLayer({
        id: 'zones',
        data: zones,
        getPolygon: d => d.path.map(p => [p.lng, p.lat]),
        getFillColor: [255, 152, 0, 80], // Orange with some transparency
        getLineColor: [255, 152, 0, 200],
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
        getLineDashArray: [8, 4],
        extruded: false,
    });


    return [terrainLayer, boundaryLayer, zoneLayer, buildingLayer];
  }, [elevationGrid, assets, zones, selectedAssetId, boundary]);

  if (!initialViewState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p>Loading 3D View...</p>
      </div>
    );
  }

  const handleDelete = () => {
    if(selectedAssetId) {
        onDeleteAsset(selectedAssetId);
        setSelectedAssetId(null);
        toast({ title: 'Asset Deleted', description: 'The selected building has been removed.' });
    }
  }

  return (
    <div className="w-full h-full relative">
      <DeckGL
        layers={layers}
        initialViewState={initialViewState}
        controller={true}
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onClick={(info, event) => {
            // Deselect asset if clicking on something other than a building (info.object will be null)
             if (!info.object) {
                setSelectedAssetId(null);
             }
        }}
      >
        <Map reuseMaps mapLib={map} mapStyle={MAP_STYLE} mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
      </DeckGL>

      <NavigationGuide />

      {selectedAssetId && (
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-primary/50 w-60">
           <div className="flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-primary" />
            <span className="font-bold text-base">Selected Building</span>
          </div>
          <p className="text-sm text-muted-foreground truncate mb-3">ID: {selectedAssetId}</p>
          <Button 
            variant="destructive" 
            size="sm" 
            className="w-full"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Building
          </Button>
        </div>
      )}
    </div>
  );
}
