"use client";

import React, { useEffect, useRef, useState } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useMapLibre } from './MapLibreProvider';
import type { Shape, Tool } from '@/lib/types';

interface DrawingManagerProps {
  selectedTool: Tool;
  onShapeComplete: (shape: Shape) => void;
  shapes: Shape[];
  selectedShapeIds: string[];
  onShapeSelect: (shapeId: string) => void;
}

export const DrawingManager: React.FC<DrawingManagerProps> = ({
  selectedTool,
  onShapeComplete,
  shapes,
  selectedShapeIds,
  onShapeSelect,
}) => {
  const { map, isLoaded } = useMapLibre();
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Initialize Mapbox Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      modes: {
        ...MapboxDraw.modes,
      },
      styles: [
        // Custom styles for drawn features
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3bb2d0',
            'fill-opacity': 0.1,
          },
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#3bb2d0',
            'line-width': 2,
          },
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: {
            'fill-color': '#fbb03b',
            'fill-opacity': 0.1,
          },
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#fbb03b',
            'line-width': 2,
          },
        },
        // Vertex styles
        {
          id: 'gl-draw-polygon-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: {
            'circle-radius': 3,
            'circle-color': '#fbb03b',
          },
        },
        {
          id: 'gl-draw-polygon-vertex-stroke-inactive',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#fff',
          },
        },
        {
          id: 'gl-draw-polygon-vertex-inactive',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 3,
            'circle-color': '#fbb03b',
          },
        },
      ],
    });

    map.addControl(draw);
    drawRef.current = draw;

    // Handle drawing events
    const onDrawCreate = (e: any) => {
      const feature = e.features[0];
      if (feature && feature.geometry) {
        const shape: Shape = {
          id: feature.id || Math.random().toString(36).substr(2, 9),
          type: feature.geometry.type === 'Polygon' ? 'polygon' : 'polygon', // Map all to polygon for now
          coordinates: feature.geometry.coordinates,
          properties: {
            name: `Shape ${shapes.length + 1}`,
            description: '',
          },
        };
        onShapeComplete(shape);
      }
    };

    const onDrawUpdate = (e: any) => {
      // Handle shape updates
    };

    const onDrawSelectionChange = (e: any) => {
      if (e.features.length > 0) {
        onShapeSelect(e.features[0].id);
      }
    };

    map.on('draw.create', onDrawCreate);
    map.on('draw.update', onDrawUpdate);
    map.on('draw.selectionchange', onDrawSelectionChange);

    return () => {
      if (map && drawRef.current) {
        map.off('draw.create', onDrawCreate);
        map.off('draw.update', onDrawUpdate);
        map.off('draw.selectionchange', onDrawSelectionChange);
        map.removeControl(drawRef.current);
      }
    };
  }, [map, isLoaded, onShapeComplete, onShapeSelect, shapes.length]);

  // Handle tool changes
  useEffect(() => {
    if (!drawRef.current) return;

    const draw = drawRef.current;

    switch (selectedTool) {
      case 'polygon':
        draw.changeMode('draw_polygon');
        break;
      case 'select':
        draw.changeMode('simple_select');
        break;
      case 'pan':
        draw.changeMode('simple_select');
        break;
      default:
        draw.changeMode('simple_select');
        break;
    }
  }, [selectedTool]);

  // Sync shapes with draw control
  useEffect(() => {
    if (!drawRef.current || !map) return;

    const draw = drawRef.current;
    
    // Clear existing features
    draw.deleteAll();

    // Add current shapes to draw control
    shapes.forEach((shape) => {
      if (shape.coordinates && shape.coordinates.length > 0) {
        const feature: GeoJSON.Feature = {
          type: 'Feature',
          properties: { id: shape.id },
          geometry: {
            type: 'Polygon',
            coordinates: shape.coordinates,
          },
        };
        draw.add(feature);
      }
    });
  }, [shapes, map]);

  return null; // This component doesn't render anything visible
};