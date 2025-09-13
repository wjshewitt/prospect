"use client";

import type { Shape, ElevationGrid, Tool } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  LandPlot,
  HelpCircle,
  LayoutGrid,
  Info,
  ChevronDown,
  Sparkles,
  Building,
  Trash2,
  Pencil,
  Users,
  PanelLeftClose,
  PanelRightClose,
  Layers3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ElevationAnalysis } from "./elevation-analysis";
import { DevelopmentDetails } from "./development-details";
import { SolarAnalysis } from "./solar-analysis";
import { useState, useEffect } from "react";
import { AiSummaryPanel } from "./ai-summary-panel";
import {
  ProceduralPlannerPanel,
  type PlannerSettings,
} from "./procedural-planner-panel";
import { AiPlacementPanel } from "./ai-placement-panel";
import { ThreeDEditorPanel } from "./three-d-editor-panel";
import { DemographicsPanel } from "./demographics/demographics-panel";
import { LayersPanel } from "./layers-panel";
import * as turf from "@turf/turf";

type StatisticsSidebarProps = {
  shapes: Shape[];
  setShapes: (shapes: Shape[] | ((prev: Shape[]) => Shape[])) => void;
  siteId: string | null;
  siteName: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  width: number;
  setWidth: (width: number) => void;
  isResizing?: boolean;
  setIsResizing?: (resizing: boolean) => void;
  gridResolution: number;
  setGridResolution: (res: number) => void;
  steepnessThreshold: number;
  setSteepnessThreshold: (threshold: number) => void;
  elevationGrid: ElevationGrid | null;
  isAnalysisVisible: boolean;
  setIsAnalysisVisible: (visible: boolean) => void;
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
  onGenerateProceduralLayout: (settings: PlannerSettings) => void;
  onGenerateSolarLayout: (
    zoneId: string,
    density: "low" | "medium" | "high"
  ) => void;
  isGenerating: boolean;
  is3DView: boolean;
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  onDeleteAsset: (assetId: string) => void;
  setSelectedTool: (tool: Tool) => void;
  setAutofillTemplate: (asset: Shape | null) => void;
  groundStyle: "satellite" | "color" | "texture";
  setGroundStyle: (style: "satellite" | "color" | "texture") => void;
  groundColor: [number, number, number];
  setGroundColor: (color: [number, number, number]) => void;
  layerVisibility: Record<string, boolean>;
  setLayerVisibility: (visibility: Record<string, boolean>) => void;
  mapProvider: string;
  setMapProvider: (provider: string) => void;
};

const SQ_METERS_TO_ACRES = 0.000247105;

export default function StatisticsSidebar({
  shapes,
  setShapes,
  siteId,
  siteName,
  isOpen,
  setIsOpen,
  width,
  setWidth,
  isResizing = false,
  setIsResizing,
  gridResolution,
  setGridResolution,
  steepnessThreshold,
  setSteepnessThreshold,
  elevationGrid,
  isAnalysisVisible,
  setIsAnalysisVisible,
  selectedShapeIds,
  setSelectedShapeIds,
  onGenerateProceduralLayout,
  onGenerateSolarLayout,
  isGenerating,
  is3DView,
  selectedAssetId,
  setSelectedAssetId,
  onDeleteAsset,
  setSelectedTool,
  setAutofillTemplate,
  groundStyle,
  setGroundStyle,
  groundColor,
  setGroundColor,
  layerVisibility,
  setLayerVisibility,
  mapProvider,
  setMapProvider,
}: StatisticsSidebarProps) {
  const projectBoundary = shapes.find(
    (s) => !s.bufferMeta && !s.zoneMeta && !s.assetMeta
  );
  const zones = shapes.filter((s) => !!s.zoneMeta);
  const developedAreaMeters = zones.reduce((acc, z) => acc + (z.area || 0), 0);
  const developedAreaAcres = developedAreaMeters * SQ_METERS_TO_ACRES;

  const totalAreaMeters = projectBoundary?.area || 0;
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;
  const developedPercentage =
    totalAreaMeters > 0 ? (developedAreaMeters / totalAreaMeters) * 100 : 0;

  const selectedShapes = shapes.filter((s) => selectedShapeIds.includes(s.id));
  const selectedAreaAcres =
    selectedShapes.reduce((acc, shape) => acc + (shape.area || 0), 0) *
    SQ_METERS_TO_ACRES;

  return (
    <aside
      id="stats-sidebar"
      className={cn(
        "border-l bg-background/80 backdrop-blur-sm flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative",
        isOpen ? "flex" : "w-0 hidden"
      )}
      style={
        {
          width: isOpen ? `${width}px` : "0px",
          "--stats-sidebar-width": `${width}px`,
          minWidth: isOpen ? `${Math.max(280, width)}px` : "0px",
          maxWidth: isOpen ? `${Math.min(800, width)}px` : "0px",
        } as React.CSSProperties
      }
    >
      {/* Resizable handle */}
      {isOpen && (
        <div
          className="absolute left-0 top-0 w-2 h-full bg-transparent hover:bg-accent/20 cursor-col-resize z-10 transition-colors group flex items-center justify-center"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing?.(true);
            const startX = e.clientX;
            const startWidth = width;

            const handleMouseMove = (e: MouseEvent) => {
              const deltaX = startX - e.clientX;
              const newWidth = Math.max(
                280,
                Math.min(800, startWidth + deltaX)
              );
              setWidth(newWidth);
            };

            const handleMouseUp = () => {
              setIsResizing?.(false);
              document.removeEventListener("mousemove", handleMouseMove);
              document.removeEventListener("mouseup", handleMouseUp);
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
            };

            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
          }}
          title="Drag to resize sidebar"
        >
          <div className="w-0.5 h-8 bg-border group-hover:bg-accent rounded-full transition-colors" />
        </div>
      )}
      {is3DView ? (
        <div className="h-full flex flex-col">
          <ThreeDEditorPanel
            shapes={shapes}
            setShapes={setShapes}
            selectedAssetId={selectedAssetId}
            setSelectedAssetId={setSelectedAssetId}
            onDeleteAsset={onDeleteAsset}
            setSelectedTool={setSelectedTool}
            setAutofillTemplate={setAutofillTemplate}
            groundStyle={groundStyle}
            setGroundStyle={setGroundStyle}
            groundColor={groundColor}
            setGroundColor={setGroundColor}
            selectedShapeIds={selectedShapeIds}
          />
        </div>
      ) : (
        <Tabs defaultValue="stats" className="flex flex-col h-full">
          <div className="p-2">
            <TabsList className="flex w-full overflow-hidden">
              <TabsTrigger
                value="stats"
                className="flex-1 min-w-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Statistics</span>
              </TabsTrigger>
              <TabsTrigger
                value="planner"
                className="flex-1 min-w-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <LayoutGrid className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Planner</span>
              </TabsTrigger>
              <TabsTrigger
                value="summary"
                className="flex-1 min-w-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <Info className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Summary</span>
              </TabsTrigger>
              <TabsTrigger
                value="demographics"
                className="flex-1 min-w-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Demographics</span>
              </TabsTrigger>
              <TabsTrigger
                value="layers"
                className="flex-1 min-w-0 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <Layers3 className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Layers</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <TabsContent value="stats">
              <div className="p-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Site Areas</span>
                      <LandPlot className="h-5 w-5 text-muted-foreground" />
                    </CardTitle>
                    {selectedShapeIds.length > 0 && selectedAreaAcres > 0 && (
                      <CardDescription>
                        {selectedAreaAcres.toFixed(3)} acres in selection
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {projectBoundary && (
                      <div className="flex justify-between items-baseline">
                        <span className="font-medium text-muted-foreground">
                          Total Site
                        </span>
                        <span className="font-mono font-semibold">
                          {totalAreaAcres.toFixed(3)} acres
                        </span>
                      </div>
                    )}
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex justify-between items-baseline"
                      >
                        <span className="text-muted-foreground truncate pr-2">
                          {zone.zoneMeta?.name}
                        </span>
                        <span className="font-mono font-semibold">
                          {(zone.area! * SQ_METERS_TO_ACRES).toFixed(3)} acres
                        </span>
                      </div>
                    ))}
                    {developedAreaAcres > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between items-baseline">
                          <span className="font-medium text-muted-foreground">
                            Total Developed
                          </span>
                          <div className="text-right font-mono font-semibold">
                            <span>{developedAreaAcres.toFixed(3)} acres</span>
                            <span className="ml-2 text-muted-foreground">
                              ({developedPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    {!projectBoundary && zones.length === 0 && (
                      <CardDescription className="text-center">
                        Draw a boundary to see area statistics.
                      </CardDescription>
                    )}
                  </CardContent>
                </Card>

                <DevelopmentDetails
                  shapes={shapes}
                  selectedShapeIds={selectedShapeIds}
                />

                <SolarAnalysis
                  shapes={shapes}
                  selectedShapeIds={selectedShapeIds}
                  onGenerateSolarLayout={onGenerateSolarLayout}
                />

                <div data-tutorial="step-3">
                  <ElevationAnalysis
                    gridResolution={gridResolution}
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
            </TabsContent>

            <TabsContent value="demographics">
              <div className="p-4">
                <DemographicsPanel siteId={siteId} />
              </div>
            </TabsContent>
            <TabsContent value="summary">
              <AiSummaryPanel
                siteName={siteName}
                shapes={shapes}
                elevationGrid={elevationGrid}
              />
            </TabsContent>
            <TabsContent value="planner">
              <div className="p-4 space-y-6">
                <ProceduralPlannerPanel
                  onGenerate={onGenerateProceduralLayout}
                  isGenerating={isGenerating}
                  isReady={!!projectBoundary}
                />
                <AiPlacementPanel />
              </div>
            </TabsContent>
            <TabsContent value="layers">
              <LayersPanel
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
                mapProvider={mapProvider}
                setMapProvider={setMapProvider}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      )}
    </aside>
  );
}
