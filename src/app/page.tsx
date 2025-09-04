
'use client';

import type { Shape, Tool, ElevationGrid } from '@/lib/types';
import { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import Header from '@/components/layout/header';
import ToolPalette from '@/components/tools/tool-palette';
import StatisticsSidebar from '@/components/sidebar/statistics-sidebar';
import { MapCanvas } from '@/components/map/map-canvas';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom hook for debouncing a value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}


export default function Home() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>('pan');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [gridResolution, setGridResolution] = useState<number>(12); // UI state
  const debouncedGridResolution = useDebounce(gridResolution, 1000); // Debounced state for API
  
  const [steepnessThreshold, setSteepnessThreshold] = useState<number>(8); // default 8 percent
  const [elevationGrid, setElevationGrid] = useState<ElevationGrid | null>(null);
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(true);


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
    <APIProvider 
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      libraries={['drawing', 'geometry', 'elevation', 'places']}
    >
      <div id="capture-area" className="flex flex-col h-screen bg-background text-foreground font-body">
        <Header shapes={shapes} setShapes={setShapes} elevationGrid={elevationGrid} />
        <div className="flex flex-1 overflow-hidden">
          <ToolPalette 
            selectedTool={selectedTool} 
            setSelectedTool={setSelectedTool}
            selectedShapeIds={selectedShapeIds}
            shapes={shapes}
            setShapes={setShapes}
            setSelectedShapeIds={setSelectedShapeIds}
          />
          <main className="flex-1 relative bg-muted/20">
            <MapCanvas
              shapes={shapes}
              setShapes={setShapes}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              gridResolution={debouncedGridResolution} // Use debounced value for analysis
              steepnessThreshold={steepnessThreshold}
              elevationGrid={elevationGrid}
              setElevationGrid={setElevationGrid}
              isAnalysisVisible={isAnalysisVisible}
              selectedShapeIds={selectedShapeIds}
              setSelectedShapeIds={setSelectedShapeIds}
            />
            <Button 
              size="icon" 
              variant="outline"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className={cn("absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm", !isSidebarOpen && "right-4")}
            >
              {isSidebarOpen ? <PanelRightClose /> : <PanelLeftClose />}
            </Button>
          </main>
          <StatisticsSidebar 
            shapes={shapes} 
            isOpen={isSidebarOpen}
            gridResolution={gridResolution} // Use immediate value for slider UI
            setGridResolution={setGridResolution}
            steepnessThreshold={steepnessThreshold}
            setSteepnessThreshold={setSteepnessThreshold}
            elevationGrid={elevationGrid}
            isAnalysisVisible={isAnalysisVisible}
            setIsAnalysisVisible={setIsAnalysisVisible}
            selectedShapeIds={selectedShapeIds}
          />
        </div>
      </div>
    </APIProvider>
  );
}
