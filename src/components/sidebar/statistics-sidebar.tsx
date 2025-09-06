
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, LandPlot, HelpCircle, LayoutGrid, Info, ChevronDown, Sparkles, Building, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElevationAnalysis } from './elevation-analysis';
import { DevelopmentDetails } from './development-details';
import { SolarAnalysis } from './solar-analysis';
import { useState } from 'react';
import { AiSummaryPanel } from './ai-summary-panel';
import { ProceduralPlannerPanel, type PlannerSettings } from './procedural-planner-panel';
import { AiPlacementPanel } from './ai-placement-panel';

type StatisticsSidebarProps = {
  shapes: Shape[];
  siteName: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  gridResolution: number;
  setGridResolution: (res: number) => void;
  steepnessThreshold: number;
  setSteepnessThreshold: (threshold: number) => void;
  elevationGrid: ElevationGrid | null;
  isAnalysisVisible: boolean;
  setIsAnalysisVisible: (visible: boolean) => void;
  selectedShapeIds: string[];
  onGenerateProceduralLayout: (settings: PlannerSettings) => void;
  onGenerateSolarLayout: (zoneId: string, density: 'low' | 'medium' | 'high') => void;
  isGenerating: boolean;
  is3DView: boolean;
  selectedAssetId: string | null;
  onDeleteAsset: (assetId: string) => void;
};

const SQ_METERS_TO_ACRES = 0.000247105;

const ThreeDAssetPanel = ({ shapes, selectedAssetId, onDeleteAsset }: { shapes: Shape[], selectedAssetId: string | null, onDeleteAsset: (id: string) => void }) => {
    
    const selectedAsset = shapes.find(s => s.id === selectedAssetId);

    return (
        <div className="p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>3D Mode</span>
                        <Building className="h-5 w-5 text-muted-foreground" />
                    </CardTitle>
                    {!selectedAssetId && <CardDescription>Select a building in the 3D view to see its details and actions.</CardDescription>}
                </CardHeader>
                {selectedAssetId && selectedAsset && (
                  <CardContent className="space-y-4">
                      <div>
                          <p className="text-sm font-medium capitalize">{selectedAsset.assetMeta?.key.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground break-all">ID: {selectedAssetId}</p>
                      </div>

                       <Button 
                          variant="outline"
                          className="w-full"
                          disabled // Future functionality
                      >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Properties
                      </Button>
                      <Button 
                          variant="destructive"
                          className="w-full"
                          onClick={() => onDeleteAsset(selectedAssetId)}
                      >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Building
                      </Button>
                  </CardContent>
                )}
            </Card>
        </div>
    );
}

export default function StatisticsSidebar({ 
    shapes, 
    siteName,
    isOpen,
    setIsOpen,
    gridResolution,
    setGridResolution,
    steepnessThreshold,
    setSteepnessThreshold,
    elevationGrid,
    isAnalysisVisible,
    setIsAnalysisVisible,
    selectedShapeIds,
    onGenerateProceduralLayout,
    onGenerateSolarLayout,
    isGenerating,
    is3DView,
    selectedAssetId,
    onDeleteAsset,
}: StatisticsSidebarProps) {

  const projectBoundary = shapes.find(s => !s.bufferMeta && !s.zoneMeta && !s.assetMeta);
  const zones = shapes.filter(s => !!s.zoneMeta);
  const developedAreaMeters = zones.reduce((acc, z) => acc + (z.area || 0), 0);
  const developedAreaAcres = developedAreaMeters * SQ_METERS_TO_ACRES;


  const totalAreaMeters = projectBoundary?.area || 0;
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;
  const developedPercentage = totalAreaMeters > 0 ? (developedAreaMeters / totalAreaMeters) * 100 : 0;

  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id));
  const selectedAreaAcres = selectedShapes.reduce((acc, shape) => acc + (shape.area || 0), 0) * SQ_METERS_TO_ACRES;

  return (
    <aside 
      id="stats-sidebar" 
      className={cn(
        "border-l bg-background/80 backdrop-blur-sm flex-col transition-all duration-300 ease-in-out",
        isOpen ? "w-80 flex" : "w-0 hidden"
      )}
      style={{'--stats-sidebar-width': '20rem'} as React.CSSProperties}
    >
      {is3DView ? (
        <ThreeDAssetPanel shapes={shapes} selectedAssetId={selectedAssetId} onDeleteAsset={onDeleteAsset} />
      ) : (
        <Tabs defaultValue="stats" className="flex flex-col h-full">
            <div className="p-2">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="stats">Statistics</TabsTrigger>
                    <TabsTrigger value="planner">Planner</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
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
                                    <span className="font-medium text-muted-foreground">Total Site</span>
                                    <span className="font-mono font-semibold">{totalAreaAcres.toFixed(3)} acres</span>
                                </div>
                            )}
                            {zones.map(zone => (
                                <div key={zone.id} className="flex justify-between items-baseline">
                                    <span className="text-muted-foreground truncate pr-2">{zone.zoneMeta?.name}</span>
                                    <span className="font-mono font-semibold">{(zone.area! * SQ_METERS_TO_ACRES).toFixed(3)} acres</span>
                                </div>
                            ))}
                            {developedAreaAcres > 0 && (
                                <>
                                <Separator />
                                <div className="flex justify-between items-baseline">
                                    <span className="font-medium text-muted-foreground">Total Developed</span>
                                    <div className="text-right font-mono font-semibold">
                                    <span>{developedAreaAcres.toFixed(3)} acres</span>
                                    <span className="ml-2 text-muted-foreground">({developedPercentage.toFixed(1)}%)</span>
                                    </div>
                                </div>
                                </>
                            )}
                            {!projectBoundary && zones.length === 0 && (
                                <CardDescription className="text-center">Draw a boundary to see area statistics.</CardDescription>
                            )}
                        </CardContent>
                    </Card>

                    <DevelopmentDetails shapes={shapes} selectedShapeIds={selectedShapeIds} />

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
            </ScrollArea>
        </Tabs>
      )}
    </aside>
  );
}
