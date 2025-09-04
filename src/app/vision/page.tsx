
'use client';

import type { Shape, Tool, ElevationGrid } from '@/lib/types';
import { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import Header from '@/components/layout/header';
import ToolPalette from '@/components/tools/tool-palette';
import StatisticsSidebar from '@/components/sidebar/statistics-sidebar';
import { MapCanvas, uuid } from '@/components/map/map-canvas';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelLeftClose, Eye, Map as MapIcon, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThreeDVisualizationModal } from '@/components/dev-viz/three-d-modal';
import { NameSiteDialog } from '@/components/map/name-site-dialog';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { TutorialGuide } from '@/components/tutorial/tutorial-guide';
import { layoutAssetsInZone } from '@/services/procedural-generation';

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


export default function VisionPage() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>('pan');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [gridResolution, setGridResolution] = useState<number>(12); // UI state
  const debouncedGridResolution = useDebounce(gridResolution, 1000); // Debounced state for API
  
  const [steepnessThreshold, setSteepnessThreshold] = useState<number>(8); // default 8 percent
  const [elevationGrid, setElevationGrid] = useState<ElevationGrid | null>(null);
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(true);
  const [is3DView, setIs3DView] = useState(false);

  const [siteName, setSiteName] = useState<string>('');
  const [isNameSiteDialogOpen, setIsNameSiteDialogOpen] = useState(false);
  const [pendingShape, setPendingShape] = useState<Omit<Shape, 'id'> | null>(null);

  const [hasCompletedTutorial, setHasCompletedTutorial] = useLocalStorage('landvision-tutorial-complete', false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    // This now runs only on the client, after hydration
    if (!hasCompletedTutorial) {
        setIsTutorialActive(true);
    }
  }, [hasCompletedTutorial]);


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

  const projectBoundary = shapes.find(s => s.type !== 'buffer' && !s.zoneMeta && !s.assetMeta);
  const assets = shapes.filter(s => !!s.assetMeta);
  const zones = shapes.filter(s => !!s.zoneMeta);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all drawings and data? This cannot be undone.')) {
        setShapes([]);
        setSelectedShapeIds([]);
        setElevationGrid(null);
        setSiteName('');
    }
  }

  const handleGenerateLayout = (zoneId: string) => {
    const zone = shapes.find(s => s.id === zoneId && !!s.zoneMeta);
    if (!zone) return;

    // Remove existing assets within that zone first
    const assetsInZone = assets.filter(asset => {
        const assetCenter = new google.maps.LatLng(asset.path[0].lat, asset.path[0].lng);
        const zonePolygon = new google.maps.Polygon({ paths: zone.path });
        return google.maps.geometry.poly.containsLocation(assetCenter, zonePolygon);
    });
    const assetIdsInZone = new Set(assetsInZone.map(a => a.id));

    const newAssets = layoutAssetsInZone(zone);
    
    setShapes(prev => {
        const shapesWithoutOldAssets = prev.filter(s => !assetIdsInZone.has(s.id));
        return [...shapesWithoutOldAssets, ...newAssets];
    });
  }

  const handleNameSite = (name: string) => {
    setSiteName(name);
    if (pendingShape) {
        setShapes(prev => [...prev, { id: `${Date.now()}`, ...pendingShape }]);
        setPendingShape(null);
    }
    setIsNameSiteDialogOpen(false);
    if (isTutorialActive) {
      setTutorialStep(prev => prev + 1);
    }
  }

  const handleBoundaryDrawn = (shape: Omit<Shape, 'id'>) => {
    setPendingShape(shape);
    setIsNameSiteDialogOpen(true);
    if(isTutorialActive) {
        setTutorialStep(prev => prev + 1);
    }
  }
  
  const handleTutorialFinish = () => {
    setIsTutorialActive(false);
    setHasCompletedTutorial(true);
  }
  
  const handleTutorialStart = () => {
    setTutorialStep(0);
    setIsTutorialActive(true);
  }


  return (
    <APIProvider 
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      libraries={['drawing', 'geometry', 'elevation', 'places']}
    >
      <div id="capture-area" className="flex flex-col h-screen bg-background text-foreground font-body">
        <Header 
          siteName={siteName}
          onSiteNameClick={() => setIsNameSiteDialogOpen(true)}
          onClear={handleClear}
          hasShapes={shapes.length > 0}
          elevationGrid={elevationGrid}
          shapes={shapes}
        >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIs3DView(!is3DView)}
              disabled={!projectBoundary}
              data-tutorial="step-4"
            >
              {is3DView ? <MapIcon className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {is3DView ? '2D View' : '3D View'}
            </Button>
        </Header>
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
            {is3DView && projectBoundary ? (
              <ThreeDVisualizationModal
                assets={assets}
                zones={zones}
                boundary={projectBoundary}
              />
            ) : (
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
                onBoundaryDrawn={handleBoundaryDrawn}
              />
            )}
            
            {!is3DView && (
              <Button 
                size="icon" 
                variant="outline"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className={cn("absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm", !isSidebarOpen && "right-4")}
              >
                {isSidebarOpen ? <PanelRightClose /> : <PanelLeftClose />}
              </Button>
            )}

            <Button
                variant="default"
                size="icon"
                className="absolute bottom-4 left-4 z-10 rounded-full h-12 w-12 shadow-lg"
                onClick={handleTutorialStart}
            >
                <HelpCircle />
            </Button>
          </main>
          {!is3DView && (
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
              onGenerateLayout={handleGenerateLayout}
            />
          )}
        </div>
      </div>
      <NameSiteDialog 
        isOpen={isNameSiteDialogOpen}
        onOpenChange={setIsNameSiteDialogOpen}
        onSubmit={handleNameSite}
        initialName={siteName}
        isTutorialActive={isTutorialActive && tutorialStep === 1}
      />
       {isTutorialActive && (
        <TutorialGuide
          step={tutorialStep}
          setStep={setTutorialStep}
          onFinish={handleTutorialFinish}
        />
      )}
    </APIProvider>
  );
}
