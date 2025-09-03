'use client';

import type { Shape, Tool } from '@/lib/types';
import { useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import Header from '@/components/layout/header';
import ToolPalette from '@/components/tools/tool-palette';
import StatisticsSidebar from '@/components/sidebar/statistics-sidebar';
import MapCanvas from '@/components/map/map-canvas';

export default function Home() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>('pan');
  
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configuration Error</h1>
          <p className="text-muted-foreground">
            Please provide a Google Maps API key in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
      <div id="capture-area" className="flex flex-col h-screen bg-background text-foreground font-body">
        <Header shapes={shapes} setShapes={setShapes} />
        <div className="flex flex-1 overflow-hidden">
          <ToolPalette selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
          <main className="flex-1 relative bg-muted/20">
            <MapCanvas
              shapes={shapes}
              setShapes={setShapes}
              selectedTool={selectedTool}
            />
          </main>
          <StatisticsSidebar shapes={shapes} />
        </div>
      </div>
    </APIProvider>
  );
}
