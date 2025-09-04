'use client';

import type { Shape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, Home, Scan, Scaling } from 'lucide-react';
import { useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';


type DevelopmentDetailsProps = {
  shapes: Shape[];
  selectedShapeIds: string[];
};

const SQ_METERS_TO_ACRES = 0.000247105;

export function DevelopmentDetails({ shapes, selectedShapeIds }: DevelopmentDetailsProps) {
  const map = useMap();

  const analysis = useMemo(() => {
    if (!map || selectedShapeIds.length !== 1) return null;
    
    const selectedZone = shapes.find(s => s.id === selectedShapeIds[0] && !!s.zoneMeta);
    if (!selectedZone || !selectedZone.area) return null;

    const assets = shapes.filter(s => !!s.assetMeta);
    const zonePolygon = new google.maps.Polygon({ paths: selectedZone.path });

    const assetsInZone = assets.filter(asset => {
        // Use the first point of the footprint as its reference location
        const assetLocation = new google.maps.LatLng(asset.path[0].lat, asset.path[0].lng);
        return google.maps.geometry.poly.containsLocation(assetLocation, zonePolygon);
    });

    const propertyCount = assetsInZone.length;
    if (propertyCount === 0) return {
        zoneName: selectedZone.zoneMeta?.name,
        propertyCount: 0,
        density: 0,
    };

    const zoneAreaAcres = selectedZone.area * SQ_METERS_TO_ACRES;
    const density = propertyCount / zoneAreaAcres;
    
    return {
        zoneName: selectedZone.zoneMeta?.name,
        propertyCount,
        density
    }

  }, [shapes, selectedShapeIds, map]);

  if (!analysis) {
    return null;
  }

  return (
    <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Development Details</span>
            <Building className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
          <CardDescription>
            Analysis for zone: <span className="font-semibold text-foreground">{analysis.zoneName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Home className="h-4 w-4" />
                    <span>Total Properties</span>
                </div>
                <span className="font-mono font-semibold">{analysis.propertyCount}</span>
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Scaling className="h-4 w-4" />
                    <span>Typical Dimensions</span>
                </div>
                <span className="font-mono font-semibold">8m x 10m</span>
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Scan className="h-4 w-4" />
                    <span>Density</span>
                </div>
                <span className="font-mono font-semibold">{analysis.density.toFixed(2)} / acre</span>
            </div>
        </CardContent>
    </Card>
  );
}
