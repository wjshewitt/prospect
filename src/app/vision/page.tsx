"use client";

import type {
  Shape,
  Tool,
  ElevationGrid,
  LatLng,
  MeasurementConfig,
  Annotation,
} from "@/lib/types";

// Force dynamic rendering for this page
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  APIProvider,
  useMap,
  Map as GoogleMap,
  MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import Header from "@/components/layout/header";
import ToolPalette from "@/components/tools/tool-palette";
import StatisticsSidebar from "@/components/sidebar/statistics-sidebar";
import { MapCanvas, uuid } from "@/components/map/map-canvas";
import { Button } from "@/components/ui/button";
import {
  PanelRightClose,
  PanelLeftClose,
  Eye,
  Map as MapIcon,
  Loader2,
  View,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThreeDVisualization } from "@/components/dev-viz/three-d-modal";
import { NameSiteDialog } from "@/components/map/name-site-dialog";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { TutorialGuide } from "@/components/tutorial/tutorial-guide";
import { useToast } from "@/hooks/use-toast";
import { analyzeElevation } from "@/services/elevation";
import { generateSolarLayout } from "@/ai/flows/generate-solar-layout-flow";
import { proceduralGenerateLayout } from "@/ai/flows/procedural-generate-layout-flow";
import type { ProceduralGenerateLayoutOutput } from "@/lib/procedural-types";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";
import { AddressSearchBox } from "@/components/map/address-search-box";
import { area, getCoords } from "@turf/turf";
import * as turf from "@turf/turf";
import { LocalAuthorityLayer } from "@/components/map/local-authority-layer";

interface AutosaveData {
  projectId: string;
  siteName: string;
  shapes: Shape[];
  viewState: any;
  measurementConfig: MeasurementConfig;
  mapProvider: string;
  layerVisibility: Record<string, boolean>;
  annotations: Annotation[];
  lastModified: string;
}

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
  const [selectedTool, setSelectedTool] = useState<Tool>("pan");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(480); // ~1/3 of typical screen width (1440px)
  const [isResizing, setIsResizing] = useState(false);

  const [gridResolution, setGridResolution] = useState<number>(30); // UI state
  const debouncedGridResolution = useDebounce(gridResolution, 1000); // Debounced state for API

  const [steepnessThreshold, setSteepnessThreshold] = useState<number>(8); // default 8 percent
  const [elevationGrid, setElevationGrid] = useState<ElevationGrid | null>(
    null
  );
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(true);

  const [is3DMode, setIs3DMode] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [autofillTemplate, setAutofillTemplate] = useState<Shape | null>(null);

  const [siteName, setSiteName] = useState<string>("My Project");
  const [isNameSiteDialogOpen, setIsNameSiteDialogOpen] = useState(false);
  const [pendingShape, setPendingShape] = useState<Omit<Shape, "id"> | null>(
    null
  );

  const [hasCompletedTutorial, setHasCompletedTutorial] = useLocalStorage(
    "landvision-tutorial-complete",
    false
  );
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [isGenerating, setIsGenerating] = useState(false);

  const [groundStyle, setGroundStyle] = useState<
    "satellite" | "color" | "texture"
  >("satellite");
  const [groundColor, setGroundColor] = useState<[number, number, number]>([
    228, 215, 189,
  ]);

  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Measurement configuration from localStorage
  const [measurementConfig, setMeasurementConfig] =
    useLocalStorage<MeasurementConfig>("measurement-config", {
      units: "imperial",
      precision: 2,
      showArea: true,
      showPerimeter: true,
      showVertexCount: false,
    });

  const [mapProvider, setMapProvider] = useLocalStorage(
    "map-provider",
    "google-satellite"
  );
  const [layerVisibility, setLayerVisibility] = useLocalStorage<
    Record<string, boolean>
  >("layer-visibility", {});

  // Annotations state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Local storage for auto-save snapshots
  const [autosaveData, setAutosaveData] = useLocalStorage<AutosaveData | null>(
    "project-autosave",
    null
  );

  // Hook for clearing autosave data
  const clearAutosave = useCallback(
    () => setAutosaveData(null),
    [setAutosaveData]
  );

  const onMapCameraChanged = useCallback((ev: MapCameraChangedEvent) => {
    const { center, zoom } = ev.detail;
    setViewState((prev: any) => ({
      ...prev,
      latitude: center.lat,
      longitude: center.lng,
      zoom: zoom,
    }));
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
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
    const projectIdFromUrl = searchParams.get("projectId");
    const latFromUrl = searchParams.get("lat");
    const lngFromUrl = searchParams.get("lng");
    const zoomFromUrl = searchParams.get("zoom");

    const loadProject = async () => {
      setIsLoading(true);
      let loadSuccess = false;

      if (user && projectIdFromUrl) {
        try {
          const projectDocRef = doc(
            db,
            "users",
            user.uid,
            "projects",
            projectIdFromUrl
          );
          const docSnap = await getDoc(projectDocRef);
          if (docSnap.exists()) {
            const projectData = docSnap.data();
            setSiteName(projectData.siteName || "My Project");
            setShapes(projectData.shapes || []);

            if (latFromUrl && lngFromUrl) {
              setViewState({
                latitude: parseFloat(latFromUrl),
                longitude: parseFloat(lngFromUrl),
                zoom: zoomFromUrl ? parseFloat(zoomFromUrl) : 16,
                pitch: 0,
                bearing: 0,
              });
            } else if (projectData.mapState) {
              setViewState({
                latitude: projectData.mapState.center.lat,
                longitude: projectData.mapState.center.lng,
                zoom: projectData.mapState.zoom,
                pitch: 0,
                bearing: 0,
              });
            }
            setProjectId(projectIdFromUrl);
            loadSuccess = true;
            clearAutosave();
          } else {
            toast({
              variant: "destructive",
              title: "Project Not Found",
              description: "The requested project could not be loaded.",
            });
            router.push("/welcome");
          }
        } catch (error) {
          console.error("Error loading project from server:", error);
        }
      }

      if (!loadSuccess) {
        if (
          autosaveData &&
          (!projectIdFromUrl ||
            autosaveData.projectId === projectIdFromUrl ||
            autosaveData.projectId === "temp")
        ) {
          toast({
            title: "Restored from Auto-save",
            description: "Your previous session has been restored.",
            duration: 3000,
          });
          setSiteName(autosaveData.siteName || "My Project");
          setShapes(autosaveData.shapes || []);
          setViewState(autosaveData.viewState || INITIAL_VIEW_STATE);
          setMeasurementConfig(
            autosaveData.measurementConfig || {
              units: "imperial",
              precision: 2,
              showArea: true,
              showPerimeter: true,
              showVertexCount: false,
            }
          );
          setMapProvider(autosaveData.mapProvider || "google-satellite");
          setLayerVisibility(autosaveData.layerVisibility || {});
          setAnnotations(autosaveData.annotations || []);
          if (
            autosaveData.projectId !== "temp" &&
            autosaveData.projectId !== projectIdFromUrl
          ) {
            setProjectId(autosaveData.projectId);
            if (user) {
              router.push(`/vision?projectId=${autosaveData.projectId}`, {
                scroll: false,
              });
            }
          }
          clearAutosave();
        } else if (projectIdFromUrl) {
          toast({
            variant: "destructive",
            title: "Load Failed",
            description:
              "Could not load project data from server or local storage.",
          });
        }
      }
      setIsLoading(false);
    };

    if (!authLoading) {
      loadProject();
    }
  }, [
    user,
    authLoading,
    searchParams,
    router,
    autosaveData,
    clearAutosave,
    toast,
  ]);

  useEffect(() => {
    const runAnalysis = async () => {
      const shapeToAnalyze = shapes.find((s) => s.id === selectedShapeIds[0]);

      // Ensure this only runs on the client where google object is available
      if (
        typeof window !== "undefined" &&
        window.google &&
        window.google.maps &&
        window.google.maps.ElevationService &&
        selectedShapeIds.length === 1 &&
        shapeToAnalyze &&
        !shapeToAnalyze.assetMeta
      ) {
        try {
          const elevationService = new window.google.maps.ElevationService();
          const grid = await analyzeElevation(
            shapeToAnalyze,
            elevationService,
            debouncedGridResolution
          );
          setElevationGrid(grid);
        } catch (err: any) {
          console.error("Error getting elevation grid:", err);

          // Check if it's an Elevation API permission error
          const isElevationError =
            err?.message?.includes("ELEVATION") ||
            err?.code === "UNKNOWN_ERROR" ||
            err?.status === "UNKNOWN_ERROR";

          if (isElevationError) {
            toast({
              variant: "destructive",
              title: "Elevation API Unavailable",
              description:
                "Elevation data requires Elevation API to be enabled. Topography analysis is disabled.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Elevation API Error",
              description:
                "Could not fetch elevation data. Please try again later.",
            });
          }
          setElevationGrid(null); // Clear grid on error
        }
      }
    };
    runAnalysis();
  }, [selectedShapeIds, debouncedGridResolution, shapes]);

  // Separate effect to clear elevation grid when conditions aren't met
  useEffect(() => {
    const shapeToAnalyze = shapes.find((s) => s.id === selectedShapeIds[0]);

    // Clear elevation grid if conditions aren't met and we currently have a grid
    if (elevationGrid !== null) {
      const shouldClearGrid =
        typeof window === "undefined" ||
        !window.google ||
        !window.google.maps ||
        !window.google.maps.ElevationService ||
        selectedShapeIds.length !== 1 ||
        !shapeToAnalyze ||
        !!shapeToAnalyze.assetMeta;

      if (shouldClearGrid) {
        setElevationGrid(null);
      }
    }
  }, [selectedShapeIds, shapes, elevationGrid]);

  const projectBoundary = shapes.find(
    (s) => !s.bufferMeta && !s.zoneMeta && !s.assetMeta
  );
  const assets = shapes.filter((s) => !!s.assetMeta);
  const zones = shapes.filter((s) => !!s.zoneMeta);

  const handleClear = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all drawings and data? This will start a new, unsaved project."
      )
    ) {
      setProjectId(null);
      setShapes([]);
      setSelectedShapeIds([]);
      setElevationGrid(null);
      setSiteName("My Project");
    }
  };

  const handleSave = async (isAutoSave = false) => {
    if (!user) {
      if (!isAutoSave) {
        toast({
          variant: "destructive",
          title: "Not Logged In",
          description: "You must be logged in to save a project.",
        });
      }
      return false;
    }

    // Save to local storage immediately for snapshot
    const localProjectData: AutosaveData = {
      projectId: projectId || "temp",
      siteName,
      shapes,
      viewState,
      measurementConfig,
      mapProvider,
      layerVisibility,
      annotations,
      lastModified: new Date().toISOString(),
    };
    setAutosaveData(localProjectData);

    try {
      const projectData = {
        siteName,
        shapes,
        mapState: viewState
          ? {
              center: { lat: viewState.latitude, lng: viewState.longitude },
              zoom: viewState.zoom,
            }
          : null,
        measurementConfig,
        mapProvider,
        layerVisibility,
        annotations,
        lastModified: new Date().toISOString(),
      };

      let docRef;
      if (projectId) {
        // Update existing project
        docRef = doc(db, "users", user.uid, "projects", projectId);
        await setDoc(docRef, projectData, { merge: true });
      } else {
        // Create new project
        const projectsCollectionRef = collection(
          db,
          "users",
          user.uid,
          "projects"
        );
        docRef = await addDoc(projectsCollectionRef, projectData);
        setProjectId(docRef.id);
        // Update URL to reflect new project ID without full page reload
        router.push(`/vision?projectId=${docRef.id}`, { scroll: false });
      }

      if (!isAutoSave) {
        toast({
          title: "Project Saved",
          description: `Project "${siteName}" has been saved successfully.`,
        });
      } else {
        // Subtle feedback for auto-save
        toast({
          title: "Auto-saved",
          description: "Your progress has been saved.",
          duration: 2000,
          variant: "default",
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return true;
    } catch (error) {
      console.error("Failed to save project to Firestore:", error);
      if (!isAutoSave) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save project data to the database.",
        });
      } else {
        console.warn("Auto-save failed, but local snapshot is preserved");
      }
      return false;
    }
  };

  // Auto-save function for background saves
  const handleAutoSave = useCallback(async () => {
    await handleSave(true);
  }, [handleSave]);

  const handleGenerateProceduralLayout = async (
    settings: Omit<ProceduralGenerateLayoutOutput, "boundary">
  ) => {
    if (!projectBoundary) return;

    setIsGenerating(true);
    toast({
      title: "Generating Procedural Layout...",
      description: "This may take a moment.",
    });

    try {
      const result = await proceduralGenerateLayout({
        ...settings,
        boundary: projectBoundary.path,
      });

      const turfToShape = (
        fc: any,
        type: "asset" | "zone" | "road"
      ): Shape[] => {
        return fc.features.map((feature: any) => {
          const path = (getCoords(feature)[0] as number[][]).map((c) => ({
            lat: c[1],
            lng: c[0],
          }));
          const shape: Shape = {
            id: uuid(),
            type: "polygon",
            path,
            area: area(feature),
          };
          if (type === "asset") {
            shape.assetMeta = {
              assetType: "building",
              key: "procedural_building",
              floors: 2,
              rotation: 0,
            };
          }
          // could add road/parcel meta here too
          return shape;
        });
      };

      const newBuildings = turfToShape(result.buildings, "asset");
      const newRoads = turfToShape(result.roads, "road"); // TODO: handle roads, parcels, greenspace
      const newGreenSpaces = turfToShape(result.greenSpaces, "zone");

      // Clear existing procedural items before adding new ones
      setShapes((prev) => [
        ...prev.filter((s) => s.assetMeta?.key !== "procedural_building"),
        ...newBuildings,
      ]);

      toast({
        title: "Procedural Layout Generated",
        description: `${newBuildings.length} buildings have been placed.`,
      });
      // Auto-save after procedural generation
      await handleSave(true);
    } catch (error: any) {
      console.error("Procedural layout generation failed:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description:
          error.message ||
          "The procedural planner could not generate a layout. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSolarLayout = async (
    zoneId: string,
    density: "low" | "medium" | "high"
  ) => {
    const zone = shapes.find(
      (s) => s.id === zoneId && s.zoneMeta?.kind === "solar"
    );
    if (!zone) return;

    toast({
      title: "Generating Solar Layout...",
      description: `The AI is designing a ${density}-density solar array. This may take a moment.`,
    });

    try {
      const result = await generateSolarLayout({
        roofPolygon: zone.path,
        density,
      });

      const newPanels: Shape[] = result.panels.map((p) => {
        const path = p.footprint.map((point) => ({
          lat: point.lat,
          lng: point.lng,
        }));
        const area = google.maps.geometry.spherical.computeArea(path);
        return {
          id: uuid(),
          type: "rectangle", // Visually a rectangle
          path,
          area,
          assetMeta: {
            assetType: "solar_panel",
            key: "solar_panel",
            rotation: p.rotation,
            floors: 0, // Not applicable
          },
        };
      });

      // Remove existing solar panels within that zone first
      const assetsInZone = assets.filter((asset) => {
        if (asset.assetMeta?.assetType !== "solar_panel") return false;
        const assetCenter = new google.maps.LatLng(
          asset.path[0].lat,
          asset.path[0].lng
        );
        const zonePolygon = new google.maps.Polygon({ paths: zone.path });
        return google.maps.geometry.poly.containsLocation(
          assetCenter,
          zonePolygon
        );
      });
      const assetIdsInZone = new Set(assetsInZone.map((a) => a.id));

      setShapes((prev) => {
        const shapesWithoutOldAssets = prev.filter(
          (s) => !assetIdsInZone.has(s.id)
        );
        return [...shapesWithoutOldAssets, ...newPanels];
      });

      toast({
        title: "Solar Layout Generated",
        description: `${newPanels.length} solar panels have been placed on the roof.`,
      });
    } catch (error) {
      console.error("Solar Layout generation failed:", error);
      toast({
        variant: "destructive",
        title: "Solar Layout Failed",
        description:
          "The AI could not generate a solar layout. Please try again.",
      });
    }
  };

  const handleNameSite = async (name: string) => {
    setSiteName(name);
    if (pendingShape) {
      const newShape = { id: `${Date.now()}`, ...pendingShape };
      setShapes((prev) => [...prev, newShape]);
      setSelectedShapeIds([newShape.id]); // Auto-select new boundary
      setPendingShape(null);
      // Auto-save after boundary creation
      await handleSave(true);
    }
    setIsNameSiteDialogOpen(false);
    if (isTutorialActive) {
      setTutorialStep((prev) => prev + 1);
    }
  };

  const handleBoundaryDrawn = (shape: Omit<Shape, "id">) => {
    setPendingShape(shape);
    setIsNameSiteDialogOpen(true);
    if (isTutorialActive) {
      setTutorialStep((prev) => prev + 1);
    }
  };

  const handleTutorialFinish = () => {
    setIsTutorialActive(false);
    setHasCompletedTutorial(true);
  };

  const handleTutorialStart = () => {
    setTutorialStep(0);
    setIsTutorialActive(true);
  };

  const handleDeleteAsset = (assetId: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== assetId));
    setSelectedAssetId(null);
    toast({
      title: "Asset Deleted",
      description: "The selected building has been removed.",
    });
  };

  const handleToggle3DView = async () => {
    if (!is3DMode) {
      // Switching TO 3D view
      if (!projectBoundary) {
        toast({
          variant: "destructive",
          title: "3D View Error",
          description: "A project boundary is required for the 3D view.",
        });
        return;
      }
      if (
        !window.google ||
        !window.google.maps ||
        !window.google.maps.ElevationService
      ) {
        toast({
          variant: "destructive",
          title: "API Error",
          description:
            "Google Maps Elevation API not available. Please check your API key configuration.",
        });
        return;
      }

      setIsSidebarOpen(true); // Always ensure sidebar is open when entering 3D mode
      toast({
        title: "Generating 3D View...",
        description: "Please wait, this may take a moment.",
      });

      let grid = elevationGrid;
      // If there's no elevation grid, or the grid is for a different shape, calculate it for the boundary
      if (!grid || selectedShapeIds[0] !== projectBoundary.id) {
        try {
          const elevationService = new window.google.maps.ElevationService();
          grid = await analyzeElevation(
            projectBoundary,
            elevationService,
            gridResolution
          );
          setElevationGrid(grid);
        } catch (e: any) {
          console.error("3D elevation error:", e);

          // Check if it's an Elevation API permission error
          const isElevationError =
            e?.message?.includes("ELEVATION") ||
            e?.code === "UNKNOWN_ERROR" ||
            e?.status === "UNKNOWN_ERROR";

          if (isElevationError) {
            toast({
              variant: "destructive",
              title: "Elevation API Required",
              description:
                "3D view requires Elevation API to be enabled for your Google Maps API key.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Elevation API Error",
              description: "Could not fetch elevation data for 3D view.",
            });
          }
          setIsSidebarOpen(true); // Restore sidebar
          return; // Don't switch if data fails
        }
      }
    } else {
      // Switching back from 3D view
      setSelectedAssetId(null); // Clear 3D selection
      setIsSidebarOpen(true); // Re-open sidebar when leaving 3D mode
      setSelectedTool("pan"); // Reset to pan tool
    }
    setIs3DMode(!is3DMode);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div
      id="capture-area"
      className="flex flex-col h-screen bg-background text-foreground font-body"
    >
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
          className="hover:bg-gradient-to-r hover:from-green-500 hover:to-orange-500 hover:text-white hover:border-green-500 transition-all duration-200"
        >
          <View className="h-4 w-4 mr-2" />
          {is3DMode ? "2D View" : "3D View"}
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
          measurementConfig={measurementConfig}
          setMeasurementConfig={setMeasurementConfig}
          mapProvider={mapProvider}
          setMapProvider={setMapProvider}
          layerVisibility={layerVisibility}
          setLayerVisibility={setLayerVisibility}
        />
        <main className="flex-1 relative bg-muted/20 sidebar-layout-main">
          {!is3DMode && (
            <div
              className="absolute top-2 z-10 flex justify-center sidebar-layout-search"
              style={{
                left: "var(--tool-palette-width, 4rem)",
                right: isSidebarOpen ? `${sidebarWidth}px` : "0",
                transition: isResizing ? "none" : "right 0.3s ease-in-out",
              }}
            >
              <AddressSearchBox
                onPlaceSelect={(place) => {
                  if (place.geometry?.location) {
                    setViewState({
                      ...viewState,
                      latitude: place.geometry.location.lat(),
                      longitude: place.geometry.location.lng(),
                      zoom: 18,
                    });
                  }
                }}
              />
            </div>
          )}

          {is3DMode ? (
            <div className="relative w-full h-full">
              {projectBoundary && elevationGrid ? (
                <ThreeDVisualization
                  assets={assets}
                  zones={zones}
                  boundary={projectBoundary}
                  onDeleteAsset={handleDeleteAsset}
                  selectedAssetId={selectedAssetId}
                  setSelectedAssetId={setSelectedAssetId}
                  initialViewState={{
                    ...viewState,
                    pitch: 45,
                    bearing: 0,
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
              onAutoSave={handleAutoSave}
              viewState={viewState}
              onCameraChanged={onMapCameraChanged}
              measurementConfig={measurementConfig}
              mapProvider={mapProvider}
              setMapProvider={setMapProvider}
              layerVisibility={layerVisibility}
              setLayerVisibility={setLayerVisibility}
              annotations={annotations}
              setAnnotations={setAnnotations}
            />
          )}

          {/* Local Authority Layer */}
          {!is3DMode && (
            <LocalAuthorityLayer
              visible={layerVisibility["local-authorities"] || false}
            />
          )}

          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn(
              "absolute top-4 z-10 bg-background/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-200",
              isSidebarOpen ? "right-4" : "right-4"
            )}
            title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </main>
        <StatisticsSidebar
          shapes={shapes}
          setShapes={setShapes}
          siteId={projectId}
          siteName={siteName}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          width={sidebarWidth}
          setWidth={setSidebarWidth}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
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
          layerVisibility={layerVisibility}
          setLayerVisibility={setLayerVisibility}
          mapProvider={mapProvider}
          setMapProvider={setMapProvider}
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
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      {...(process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID && {
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
      })}
      libraries={["drawing", "geometry", "elevation", "places"]}
    >
      <VisionPageContent />
    </APIProvider>
  );
}
