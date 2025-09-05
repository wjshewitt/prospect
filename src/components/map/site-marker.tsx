
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Shape, LatLng } from '@/lib/types';
import { useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SiteMarkerProps {
  boundary: Shape;
}

const getPolygonCenter = (path: LatLng[]): LatLng => {
    if (!path || path.length === 0) return { lat: 0, lng: 0 };
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    return bounds.getCenter().toJSON();
};

export function SiteMarker({ boundary }: SiteMarkerProps) {
  const map = useMap();
  const [isVisible, setIsVisible] = useState(false);
  const [center, setCenter] = useState<LatLng | null>(null);

  const calculateVisibility = useCallback(() => {
    if (!map || !boundary || !boundary.area) {
      setIsVisible(false);
      return;
    }

    const mapBounds = map.getBounds();
    if (!mapBounds) {
        setIsVisible(false);
        return;
    }
    
    // Calculate map viewport area
    const ne = mapBounds.getNorthEast();
    const sw = mapBounds.getSouthWest();
    const mapPolygon = [
      { lat: sw.lat(), lng: sw.lng() },
      { lat: ne.lat(), lng: sw.lng() },
      { lat: ne.lat(), lng: ne.lng() },
      { lat: sw.lat(), lng: ne.lng() },
    ];
    const mapArea = google.maps.geometry.spherical.computeArea(mapPolygon);

    // Show marker if the site area is less than 1% of the map area
    const shouldBeVisible = boundary.area < mapArea * 0.01;
    
    setIsVisible(shouldBeVisible);

  }, [map, boundary]);


  useEffect(() => {
    if (boundary?.path) {
        setCenter(getPolygonCenter(boundary.path));
    } else {
        setCenter(null);
    }
  }, [boundary]);

  useEffect(() => {
    if (!map) return;

    calculateVisibility(); // Initial check

    const idleListener = map.addListener('idle', calculateVisibility);
    const zoomListener = map.addListener('zoom_changed', calculateVisibility);

    return () => {
      if(google.maps.event) {
        google.maps.event.removeListener(idleListener);
        google.maps.event.removeListener(zoomListener);
      }
    };
  }, [map, calculateVisibility]);


  if (!isVisible || !center || !map) {
    return null;
  }

  return (
    <AdvancedMarker position={center} title="Site Location">
        <div className="flex flex-col items-center justify-center text-primary/80 transition-all hover:text-primary cursor-pointer">
            <Pin className="h-8 w-8 drop-shadow-lg" fill="currentColor" />
        </div>
    </AdvancedMarker>
  );
}
    
