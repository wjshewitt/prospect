
'use client';

import type { Shape, Tool, ElevationGrid, LatLng } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APIProvider, useMap } from '@vis.gl/react-google-maps';
import Header from '@/components/layout/header';
import ToolPalette from '@/components/tools/tool-palette';
import StatisticsSidebar from '@/components/sidebar/statistics-sidebar';
import { MapCanvas, uuid } from '@/components/map/map-canvas';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelLeftClose, Eye, Map as MapIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThreeDVisualizationModal } from '@/components/dev-viz/three-d-modal';
import { NameSiteDialog } from '@/components/map/name-site-dialog';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { TutorialGuide } from '@/components/tutorial/tutorial-guide';
import { useToast } from '@/hooks/use-toast';
import { analyzeElevation } from '@/services/elevation';
import { generateBuildingLayout } from '@/ai/flows/generate-building-layout-flow';
import { generateSolarLayout } from '@/ai/flows/generate-solar-layout-flow';

import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';

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

function VisionPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>('pan');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [gridResolution, setGridResolution] = useState<number>(30); // UI state
  const debouncedGridResolution = useDebounce(gridResolution, 1000); // Debounced state for API
  
  const [steepnessThreshold, setSteepnessThreshold] = useState<number>(8); // default 8 percent
  const [elevationGrid, setElevationGrid] = useState<ElevationGrid | null>(null);
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(true);
  const [is3DView, setIs3DView] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [siteName, setSiteName] = useState<string>('My Project');
  const [isNameSiteDialogOpen, setIsNameSiteDialogOpen] = useState(false);
  const [pendingShape, setPendingShape] = useState<Omit<Shape, 'id'> | null>(null);

  const [hasCompletedTutorial, setHasCompletedTutorial] = useLocalStorage('landvision-tutorial-complete', false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // State to preserve map position
  const [mapState, setMapState] = useState<{center: LatLng, zoom: number} | null>(null);
  const { toast } = useToast();
  const map = useMap();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // This now runs only on the client, after hydration
    if (!hasCompletedTutorial) {
        setIsTutorialActive(true);
    }
  }, [hasCompletedTutorial]);

  // Effect for loading project data
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    if (user && projectIdFromUrl) {
        const loadProject = async () => {
            setIsLoading(true);
            try {
                const projectDocRef = doc(db, 'users', user.uid, 'projects', projectIdFromUrl);
                const docSnap = await getDoc(projectDocRef);
                if (docSnap.exists()) {
                    const projectData = docSnap.data();
                    setSiteName(projectData.siteName || 'My Project');
                    setShapes(projectData.shapes || []);
                    setMapState(projectData.mapState || null);
                    setProjectId(projectIdFromUrl);
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Project Not Found',
                        description: 'The requested project could not be loaded.',
                    });
                    router.push('/welcome');
                }
            } catch (error) {
                console.error("Error loading project:", error);
                toast({
                    variant: 'destructive',
                    title: 'Load Failed',
                    description: 'Could not load project data.',
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadProject();
    } else {
        setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams, router]);


  useEffect(() => {
    const runAnalysis = async () => {
        const shapeToAnalyze = shapes.find(s => s.id === selectedShapeIds[0]);

        if (selectedShapeIds.length === 1 && shapeToAnalyze && window.google && !shapeToAnalyze.assetMeta) { // Don't analyze individual assets
            try {
                const elevationService = new window.google.maps.ElevationService();
                const grid = await analyzeElevation(shapeToAnalyze, elevationService, debouncedGridResolution);
                setElevationGrid(grid);
            } catch (err) {
                console.error("Error getting elevation grid:", err);
                toast({
                    variant: 'destructive',
                    title: 'Elevation API Error',
                    description: 'Could not fetch elevation data. Please check your API key and permissions.'
                });
                setElevationGrid(null); // Clear grid on error
            }
        } else {
            // If not exactly one shape is selected, clear the grid
            if (elevationGrid !== null) {
                setElevationGrid(null);
            }
        }
    };
    runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShapeIds, debouncedGridResolution]);
  

  const projectBoundary = shapes.find(s => !s.bufferMeta && !s.zoneMeta && !s.assetMeta);
  const assets = shapes.filter(s => !!s.assetMeta);
  const zones = shapes.filter(s => !!s.zoneMeta);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all drawings and data? This will start a new, unsaved project.')) {
        setProjectId(null);
        setShapes([]);
        setSelectedShapeIds([]);
        setElevationGrid(null);
        setSiteName('My Project');
    }
  }

  const handleSave = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Not Logged In', description: 'You must be logged in to save a project.' });
        return;
    }
    try {
        const projectData = {
            siteName,
            shapes,
            mapState: map ? { center: map.getCenter()!.toJSON(), zoom: map.getZoom()! } : null,
            lastModified: new Date().toISOString(),
        };

        let docRef;
        if (projectId) {
            // Update existing project
            docRef = doc(db, 'users', user.uid, 'projects', projectId);
            await setDoc(docRef, projectData, { merge: true });
        } else {
            // Create new project
            const projectsCollectionRef = collection(db, 'users', user.uid, 'projects');
            docRef = await addDoc(projectsCollectionRef, projectData);
            setProjectId(docRef.id);
            // Update URL to reflect new project ID without full page reload
            router.push(`/vision?projectId=${docRef.id}`, { scroll: false });
        }
        
        toast({
            title: 'Project Saved',
            description: `Project "${siteName}" has been saved successfully.`,
        });
    } catch (error) {
        console.error("Failed to save project to Firestore:", error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'Could not save project data to the database.',
        });
    }
  };

  const handleGenerateLayout = async (zoneId: string, density: 'low' | 'medium' | 'high') => {
    const zone = shapes.find(s => s.id === zoneId && !!s.zoneMeta);
    if (!zone || !map) return;

    toast({
      title: 'Generating AI Layout...',
      description: `The AI is designing a ${density}-density layout. This may take a moment.`,
    });

    try {
      const result = await generateBuildingLayout({ 
          zonePolygon: zone.path,
          density,
      });
      
      const newAssets: Shape[] = result.buildings.map(b => {
        const path = b.footprint.map(p => ({ lat: p.lat, lng: p.lng }));
        const area = google.maps.geometry.spherical.computeArea(path);
        return {
          id: uuid(),
          type: 'rectangle', // The asset is a rectangular shape
          path,
          area,
          assetMeta: {
            assetType: 'building',
            key: b.type,
            floors: b.floors,
            rotation: b.rotation,
          },
        }
      });
      
      // Remove existing assets within that zone first
      const assetsInZone = assets.filter(asset => {
          const assetCenter = new google.maps.LatLng(asset.path[0].lat, asset.path[0].lng);
          const zonePolygon = new google.maps.Polygon({ paths: zone.path });
          return google.maps.geometry.poly.containsLocation(assetCenter, zonePolygon);
      });
      const assetIdsInZone = new Set(assetsInZone.map(a => a.id));

      setShapes(prev => {
          const shapesWithoutOldAssets = prev.filter(s => !assetIdsInZone.has(s.id));
          return [...shapesWithoutOldAssets, ...newAssets];
      });

      toast({
        title: 'AI Layout Generated',
        description: `${newAssets.length} buildings have been placed in the zone.`,
      });

    } catch (error) {
      console.error("AI Layout generation failed:", error);
      toast({
        variant: 'destructive',
        title: 'AI Layout Failed',
        description: 'The AI could not generate a layout. Please try again.',
      });
    }
  }

    const handleGenerateSolarLayout = async (zoneId: string, density: 'low' | 'medium' | 'high') => {
    const zone = shapes.find(s => s.id === zoneId && s.zoneMeta?.kind === 'solar');
    if (!zone || !map) return;

    toast({
      title: 'Generating Solar Layout...',
      description: `The AI is designing a ${density}-density solar array. This may take a moment.`,
    });

    try {
      const result = await generateSolarLayout({ 
          roofPolygon: zone.path,
          density,
      });
      
      const newPanels: Shape[] = result.panels.map(p => {
        const path = p.footprint.map(point => ({ lat: point.lat, lng: point.lng }));
        const area = google.maps.geometry.spherical.computeArea(path);
        return {
          id: uuid(),
          type: 'rectangle', // Visually a rectangle
          path,
          area,
          assetMeta: {
            assetType: 'solar_panel',
            key: 'solar_panel',
            rotation: p.rotation,
            floors: 0, // Not applicable
          },
        }
      });

       // Remove existing solar panels within that zone first
      const assetsInZone = assets.filter(asset => {
          if (asset.assetMeta?.assetType !== 'solar_panel') return false;
          const assetCenter = new google.maps.LatLng(asset.path[0].lat, asset.path[0].lng);
          const zonePolygon = new google.maps.Polygon({ paths: zone.path });
          return google.maps.geometry.poly.containsLocation(assetCenter, zonePolygon);
      });
      const assetIdsInZone = new Set(assetsInZone.map(a => a.id));

      setShapes(prev => {
          const shapesWithoutOldAssets = prev.filter(s => !assetIdsInZone.has(s.id));
          return [...shapesWithoutOldAssets, ...newPanels];
      });

      toast({
        title: 'Solar Layout Generated',
        description: `${newPanels.length} solar panels have been placed on the roof.`,
      });

    } catch (error) {
      console.error("Solar Layout generation failed:", error);
      toast({
        variant: 'destructive',
        title: 'Solar Layout Failed',
        description: 'The AI could not generate a solar layout. Please try again.',
      });
    }
  }


  const handleNameSite = (name: string) => {
    setSiteName(name);
    if (pendingShape) {
        const newShape = { id: `${Date.now()}`, ...pendingShape };
        setShapes(prev => [...prev, newShape]);
        setSelectedShapeIds([newShape.id]); // Auto-select new boundary
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

  const handleDeleteAsset = (assetId: string) => {
    setShapes(prev => prev.filter(s => s.id !== assetId));
    setSelectedAssetId(null);
    toast({ title: 'Asset Deleted', description: 'The selected building has been removed.' });
  }


  const handleToggle3DView = async () => {
    if (!is3DView) {
        // Switching TO 3D view
        setSelectedShapeIds([]); // Clear 2D selections
        if (!projectBoundary) {
            toast({
              variant: 'destructive',
              title: '3D View Error',
              description: 'A project boundary is required for the 3D view.',
            });
            return;
        }
        if (!window.google || !map) {
             toast({
              variant: 'destructive',
              title: 'API Error',
              description: 'Google Maps API not available yet. Please wait a moment and try again.',
            });
            return;
        }

        toast({ title: 'Generating 3D View...', description: 'Please wait, this may take a moment.' });
        
        let grid = elevationGrid;
        // If there's no elevation grid, or the grid is for a different shape, calculate it for the boundary
        if (!grid || selectedShapeIds[0] !== projectBoundary.id) {
            try {
                const elevationService = new window.google.maps.ElevationService();
                grid = await analyzeElevation(projectBoundary, elevationService, gridResolution);
                setElevationGrid(grid);
            } catch(e) {
                 toast({
                    variant: 'destructive',
                    title: 'Elevation API Error',
                    description: 'Could not fetch elevation data for 3D view.',
                });
                return; // Don't switch to 3D if data fails
            }
        }
    } else {
      // Switching back to 2D
      setSelectedAssetId(null); // Clear 3D selection
    }
    setIs3DView(!is3DView);
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div id="capture-area" className="flex flex-col h-screen bg-background text-foreground font-body">
      <Header 
        siteName={siteName}
        onSiteNameClick={() => setIsNameSiteDialogOpen(true)}
        onClear={handleClear}
        onSave={handleSave}
        hasShapes={shapes.length > 0}
        shapes={shapes}
        elevationGrid={elevationGrid}
      >
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggle3DView}
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
          onTutorialStart={handleTutorialStart}
          is3DView={is3DView}
        />
        <main className="flex-1 relative bg-muted/20">
          {is3DView && projectBoundary && elevationGrid ? (
            <ThreeDVisualizationModal
              assets={assets}
              zones={zones}
              boundary={projectBoundary}
              elevationGrid={elevationGrid}
              onDeleteAsset={handleDeleteAsset}
              selectedAssetId={selectedAssetId}
              setSelectedAssetId={setSelectedAssetId}
            />
          ) : (
            <MapCanvas
              shapes={shapes}
              setShapes={setShapes}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              steepnessThreshold={steepnessThreshold}
              elevationGrid={elevationGrid}
              isAnalysisVisible={isAnalysisVisible}
              selectedShapeIds={selectedShapeIds}
              setSelectedShapeIds={setSelectedShapeIds}
              onBoundaryDrawn={handleBoundaryDrawn}
              mapState={mapState}
              onMapStateChange={setMapState}
            />
          )}
          
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
          siteName={siteName}
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
          onGenerateSolarLayout={handleGenerateSolarLayout}
          is3DView={is3DView}
          selectedAssetId={selectedAssetId}
          onDeleteAsset={handleDeleteAsset}
        />
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
    </div>
  );
}


export default function VisionPage() {

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
        <VisionPageContent />
    </APIProvider>
    )
}
