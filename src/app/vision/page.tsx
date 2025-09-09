
'use client';

import type { Shape, Tool, ElevationGrid, LatLng } from '@/lib/types';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APIProvider, useMap, Map as GoogleMap, MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import Header from '@/components/layout/header';
import ToolPalette from '@/components/tools/tool-palette';
import StatisticsSidebar from '@/components/sidebar/statistics-sidebar';
import { MapCanvas, uuid } from '@/components/map/map-canvas';
import { Button } from '@/components/ui/button';
import { PanelRightClose, PanelLeftClose, Eye, Map as MapIcon, Loader2, View, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThreeDVisualization } from '@/components/dev-viz/three-d-modal';
import { NameSiteDialog } from '@/components/map/name-site-dialog';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { TutorialGuide } from '@/components/tutorial/tutorial-guide';
import { useToast } from '@/hooks/use-toast';
import { analyzeElevation } from '@/services/elevation';
import { generateSolarLayout } from '@/ai/flows/generate-solar-layout-flow';
import { proceduralGenerateLayout } from '@/ai/flows/procedural-generate-layout-flow';
import type { ProceduralGenerateLayoutInput } from '@/lib/procedural-types';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { AddressSearchBox } from '@/components/map/address-search-box';
import * as turf from '@turf/turf';


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

const INITIAL_VIEW_STATE = {
    longitude: -2.244644,
    latitude: 53.483959,
    zoom: 7,
    pitch: 0,
    bearing: 0,
};

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
  
  const [is3DMode, setIs3DMode] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [autofillTemplate, setAutofillTemplate] = useState<Shape | null>(null);

  const [siteName, setSiteName] = useState<string>('My Project');
  const [isNameSiteDialogOpen, setIsNameSiteDialogOpen] = useState(false);
  const [pendingShape, setPendingShape] = useState<Omit<Shape, 'id'> | null>(null);

  const [hasCompletedTutorial, setHasCompletedTutorial] = useLocalStorage('landvision-tutorial-complete', false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [groundStyle, setGroundStyle] = useState<'satellite' | 'color' | 'texture'>('satellite');
  const [groundColor, setGroundColor] = useState<[number, number, number]>([228, 215, 189]);

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const onMapCameraChanged = useCallback((ev: MapCameraChangedEvent) => {
    const {center, zoom} = ev.detail;
    setViewState((prev: any) => ({
      ...prev,
      latitude: center.lat,
      longitude: center.lng,
      zoom: zoom,
    }));
  }, []);

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
                    if (projectData.mapState) {
                       setViewState({
                          latitude: projectData.mapState.center.lat,
                          longitude: projectData.mapState.center.lng,
                          zoom: projectData.mapState.zoom,
                          pitch: 0,
                          bearing: 0,
                       })
                    }
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

        // Ensure this only runs on the client where google object is available
        if (typeof window !== 'undefined' && window.google && selectedShapeIds.length === 1 && shapeToAnalyze && !shapeToAnalyze.assetMeta) {
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
        } else if (elevationGrid !== null) {
            // If conditions aren't met, clear the grid.
            setElevationGrid(null);
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
            mapState: viewState ? { center: { lat: viewState.latitude, lng: viewState.longitude }, zoom: viewState.zoom } : null,
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

  const handleGenerateProceduralLayout = async (settings: Omit<ProceduralGenerateLayoutInput, 'boundary'>) => {
    if (!projectBoundary) return;

    setIsGenerating(true);
    toast({
        title: 'Generating Procedural Layout...',
        description: 'This may take a moment.',
    });
    
    try {
      const result = await proceduralGenerateLayout({
        ...settings,
        boundary: projectBoundary.path,
      });

      const turfToShape = (fc: turf.FeatureCollection, type: 'asset' | 'zone' | 'road'): Shape[] => {
        return fc.features.map((feature: any) => {
          const path = (turf.getCoords(feature)[0] as number[][]).map(c => ({ lat: c[1], lng: c[0] }));
          const shape: Shape = {
            id: uuid(),
            type: 'polygon',
            path,
            area: turf.area(feature),
          };
          if (type === 'asset') {
            shape.assetMeta = { assetType: 'building', key: 'procedural_building', floors: 2, rotation: 0 };
          }
          // could add road/parcel meta here too
          return shape;
        });
      };
      
      const newBuildings = turfToShape(result.buildings, 'asset');
      const newRoads = turfToShape(result.roads, 'road'); // TODO: handle roads, parcels, greenspace
      const newGreenSpaces = turfToShape(result.greenSpaces, 'zone');


      // Clear existing procedural items before adding new ones
      setShapes(prev => [
        ...prev.filter(s => s.assetMeta?.key !== 'procedural_building'), 
        ...newBuildings
      ]);

      toast({
        title: 'Procedural Layout Generated',
        description: `${newBuildings.length} buildings have been placed.`,
      });

    } catch (error: any) {
        console.error("Procedural layout generation failed:", error);
        toast({
            variant: 'destructive',
            title: 'Generation Failed',
            description: error.message || 'The procedural planner could not generate a layout. Please try again.',
        });
    } finally {
        setIsGenerating(false);
    }
  };


    const handleGenerateSolarLayout = async (zoneId: string, density: 'low' | 'medium' | 'high') => {
    const zone = shapes.find(s => s.id === zoneId && s.zoneMeta?.kind === 'solar');
    if (!zone) return;

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
    if (!is3DMode) {
        // Switching TO 3D view
        if (!projectBoundary) {
            toast({
              variant: 'destructive',
              title: '3D View Error',
              description: 'A project boundary is required for the 3D view.',
            });
            return;
        }
        if (!window.google) {
             toast({
              variant: 'destructive',
              title: 'API Error',
              description: 'Google Maps API not available yet. Please wait a moment and try again.',
            });
            return;
        }
        
        setIsSidebarOpen(true); // Always ensure sidebar is open when entering 3D mode
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
                setIsSidebarOpen(true); // Restore sidebar
                return; // Don't switch if data fails
            }
        }
    } else {
      // Switching back from 3D view
      setSelectedAssetId(null); // Clear 3D selection
      setIsSidebarOpen(true); // Re-open sidebar when leaving 3D mode
      setSelectedTool('pan'); // Reset to pan tool
    }
    setIs3DMode(!is3DMode);
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
            <View className="h-4 w-4 mr-2" />
            {is3DMode ? '2D View' : '3D View'}
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
          is3DView={is3DMode}
        />
        <main className="flex-1 relative bg-muted/20 flex">
            {!is3DMode && (
                <div
                    className="absolute top-2 z-10 flex justify-center"
                    style={{
                        left: 'var(--tool-palette-width, 4rem)',
                        right: isSidebarOpen ? 'var(--stats-sidebar-width, 20rem)' : '0',
                        transition: 'right 0.3s ease-in-out',
                    }}
                >
                    <AddressSearchBox onPlaceSelect={(place) => {
                        if (place.geometry?.location) {
                            setViewState({
                                ...viewState,
                                latitude: place.geometry.location.lat(),
                                longitude: place.geometry.location.lng(),
                                zoom: 18,
                            });
                        }
                    }} />
                </div>
            )}
          
            {is3DMode ? (
                 <div className='relative w-full h-full'>
                    {projectBoundary && elevationGrid ? (
                        <ThreeDVisualization
                            assets={assets}
                            zones={zones}
                            boundary={projectBoundary}
                            elevationGrid={elevationGrid}
                            onDeleteAsset={handleDeleteAsset}
                            selectedAssetId={selectedAssetId}
                            setSelectedAssetId={setSelectedAssetId}
                            initialViewState={{
                                ...viewState,
                                pitch: 45,
                                bearing: 0
                            }}
                            selectedTool={selectedTool}
                            setSelectedTool={setSelectedTool}
                            setShapes={setShapes}
                            autofillTemplate={autofillTemplate}
                            groundStyle={groundStyle}
                            groundColor={groundColor}
                            setSelectedShapeIds={setSelectedShapeIds}
                            terrainExaggeration={1.5}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    )}
                </div>
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
                    viewState={viewState}
                    onCameraChanged={onMapCameraChanged}
                />
            )}
          
          
          <Button 
            size="icon" 
            variant="outline"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className={cn("absolute top-14 right-4 z-10 bg-background/80 backdrop-blur-sm")}
          >
            {isSidebarOpen ? <PanelRightClose /> : <PanelLeftClose />}
          </Button>

        </main>
        <StatisticsSidebar 
          shapes={shapes}
          setShapes={setShapes}
          siteName={siteName}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          gridResolution={gridResolution}
          setGridResolution={setGridResolution}
          steepnessThreshold={steepnessThreshold}
          setSteepnessThreshold={setSteepnessThreshold}
          elevationGrid={elevationGrid}
          isAnalysisVisible={isAnalysisVisible}
          setIsAnalysisVisible={setIsAnalysisVisible}
          selectedShapeIds={selectedShapeIds}
          setSelectedShapeIds={setSelectedShapeIds}
          onGenerateProceduralLayout={handleGenerateProceduralLayout}
          onGenerateSolarLayout={handleGenerateSolarLayout}
          isGenerating={isGenerating}
          is3DView={is3DMode}
          selectedAssetId={selectedAssetId}
          setSelectedAssetId={setSelectedAssetId}
          onDeleteAsset={handleDeleteAsset}
          setSelectedTool={setSelectedTool}
          setAutofillTemplate={setAutofillTemplate}
          groundStyle={groundStyle}
          setGroundStyle={setGroundStyle}
          groundColor={groundColor}
          setGroundColor={setGroundColor}
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
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
      libraries={['drawing', 'geometry', 'elevation', 'places']}
    >
        <VisionPageContent />
    </APIProvider>
    )
}
