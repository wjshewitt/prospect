"use client";

import React, { useState, useRef } from 'react';
import { MapLibreProvider } from '@/core/mapping/MapLibreProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MapLibreTestPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapStyle, setMapStyle] = useState('https://demotiles.maplibre.org/style.json');

  const styles = [
    { 
      name: 'OSM Bright', 
      url: 'https://demotiles.maplibre.org/style.json' 
    },
    { 
      name: 'CartoDB Positron', 
      url: 'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json' 
    },
    { 
      name: 'CartoDB Dark Matter', 
      url: 'https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' 
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">MapLibre GL JS Test</h1>
        <p className="text-gray-600">Testing the MapLibre foundation for three-tier migration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Map Styles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {styles.map((style) => (
              <Button
                key={style.name}
                variant={mapStyle === style.url ? "default" : "outline"}
                className="w-full"
                onClick={() => setMapStyle(style.url)}
              >
                {style.name}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Map */}
        <div className="lg:col-span-3">
          <div 
            ref={mapContainerRef} 
            className="w-full h-[600px] border rounded-lg bg-gray-100"
          >
            {mapContainerRef.current && (
              <MapLibreProvider
                containerRef={mapContainerRef}
                center={[-2.244644, 53.483959]} // UK center
                zoom={6}
                style={mapStyle}
              >
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm p-2 rounded shadow">
                  <div className="text-sm font-medium">MapLibre GL JS</div>
                  <div className="text-xs text-gray-600">Phase 1 Implementation</div>
                </div>
              </MapLibreProvider>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Migration Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">70%</div>
                <div className="text-sm text-gray-600">Bundle Size Reduction</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">Phase 1</div>
                <div className="text-sm text-gray-600">MapLibre Foundation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">0</div>
                <div className="text-sm text-gray-600">API Keys Required</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}