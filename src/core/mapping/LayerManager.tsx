"use client";

import React, { useEffect } from 'react';
import { useMapLibre } from './MapLibreProvider';
import type { Shape, LayerOverlay } from '@/lib/types';

interface LayerManagerProps {
  shapes: Shape[];
  selectedShapeIds: string[];
  overlays: LayerOverlay[];
  onShapeClick: (shapeId: string) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  shapes,
  selectedShapeIds,
  overlays,
  onShapeClick,
}) => {
  const { map, isLoaded } = useMapLibre();

  // Initialize base layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Add shapes source if it doesn't exist
    if (!map.getSource('shapes')) {
      map.addSource('shapes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Add shape layers if they don't exist
    if (!map.getLayer('shapes-fill')) {
      map.addLayer({
        id: 'shapes-fill',
        type: 'fill',
        source: 'shapes',
        paint: {
          'fill-color': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedShapeIds]],
            '#fbb03b', // Selected color
            '#3bb2d0'  // Default color
          ],
          'fill-opacity': 0.3,
        },
      });
    }

    if (!map.getLayer('shapes-outline')) {
      map.addLayer({
        id: 'shapes-outline',
        type: 'line',
        source: 'shapes',
        paint: {
          'line-color': [
            'case',
            ['in', ['get', 'id'], ['literal', selectedShapeIds]],
            '#fbb03b', // Selected color
            '#3bb2d0'  // Default color
          ],
          'line-width': 2,
        },
      });
    }

    // Add click handler
    const handleClick = (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['shapes-fill'],
      });

      if (features.length > 0) {
        const shapeId = features[0].properties?.id;
        if (shapeId) {
          onShapeClick(shapeId);
        }
      }
    };

    map.on('click', 'shapes-fill', handleClick);

    // Change cursor on hover
    map.on('mouseenter', 'shapes-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'shapes-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      if (map) {
        map.off('click', 'shapes-fill', handleClick);
        map.off('mouseenter', 'shapes-fill');
        map.off('mouseleave', 'shapes-fill');
      }
    };
  }, [map, isLoaded, selectedShapeIds, onShapeClick]);

  // Update shapes data
  useEffect(() => {
    if (!map || !isLoaded) return;

    const source = map.getSource('shapes') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: GeoJSON.Feature[] = shapes.map((shape) => ({
      type: 'Feature',
      properties: {
        id: shape.id,
        name: shape.properties?.name || '',
        type: shape.type,
      },
      geometry: {
        type: 'Polygon',
        coordinates: shape.coordinates || [],
      },
    }));

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [map, isLoaded, shapes]);

  // Update selected shapes styling
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Update fill layer paint property
    map.setPaintProperty('shapes-fill', 'fill-color', [
      'case',
      ['in', ['get', 'id'], ['literal', selectedShapeIds]],
      '#fbb03b', // Selected color
      '#3bb2d0'  // Default color
    ]);

    // Update outline layer paint property
    map.setPaintProperty('shapes-outline', 'line-color', [
      'case',
      ['in', ['get', 'id'], ['literal', selectedShapeIds]],
      '#fbb03b', // Selected color
      '#3bb2d0'  // Default color
    ]);
  }, [map, isLoaded, selectedShapeIds]);

  // Handle overlay layers
  useEffect(() => {
    if (!map || !isLoaded) return;

    // This is where we would add overlay layers like local authority boundaries,
    // elevation data, etc. For now, we'll keep it simple.
    
    overlays.forEach((overlay) => {
      if (overlay.visible && !map.getLayer(overlay.id)) {
        // Add overlay layer based on type
        // This would be implemented based on the specific overlay requirements
      } else if (!overlay.visible && map.getLayer(overlay.id)) {
        // Remove overlay layer
        map.removeLayer(overlay.id);
        if (map.getSource(overlay.id)) {
          map.removeSource(overlay.id);
        }
      }
    });
  }, [map, isLoaded, overlays]);

  return null; // This component doesn't render anything visible
};