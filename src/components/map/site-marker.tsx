
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Shape, LatLng } from '@/lib/types';
import { useMap } from '@vis.gl/react-google-maps';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom OverlayView component
const CustomOverlayView: React.FC<{
  position: LatLng;
  map: google.maps.Map;
  children: React.ReactNode;
}> = ({ position, map, children }) => {
  const markerRef = useRef<HTMLDivElement>(null);
  const [overlay, setOverlay] = useState<google.maps.OverlayView | null>(null);

  useEffect(() => {
    class CustomMarker extends google.maps.OverlayView {
      private position: google.maps.LatLng;
      private container: HTMLDivElement;

      constructor(position: google.maps.LatLng, container: HTMLDivElement) {
        super();
        this.position = position;
        this.container = container;
      }
      onAdd() {
        const panes = this.getPanes();
        panes?.floatPane?.appendChild(this.container);
      }
      onRemove() {
        if (this.container.parentElement) {
          this.container.parentElement.removeChild(this.container);
        }
      }
      draw() {
        const overlayProjection = this.getProjection();
        if (!overlayProjection) return;
        const sw = overlayProjection.fromLatLngToDivPixel(this.position);
        if (sw && this.container) {
          this.container.style.left = `${sw.x}px`;
          this.container.style.top = `${sw.y}px`;
          this.container.style.position = 'absolute';
          // Center the marker over the position
          this.container.style.transform = 'translate(-50%, -100%)'; 
        }
      }
    }

    if (markerRef.current) {
        const ov = new CustomMarker(new google.maps.LatLng(position), markerRef.current);
        setOverlay(ov);
    }
  }, [position]);

  useEffect(() => {
    if (overlay) {
        overlay.setMap(map);
    }
    return () => {
        overlay?.setMap(null);
    }
  }, [overlay, map]);


  return createPortal(<div ref={markerRef}>{children}</div>, document.body);
};


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
      idleListener.remove();
      zoomListener.remove();
    };
  }, [map, calculateVisibility]);


  if (!isVisible || !center || !map) {
    return null;
  }

  return (
    <CustomOverlayView position={center} map={map}>
        <div className="flex flex-col items-center justify-center text-primary/80 transition-all hover:text-primary cursor-pointer">
            <Pin className="h-8 w-8 drop-shadow-lg" fill="currentColor" />
        </div>
    </CustomOverlayView>
  );
}
