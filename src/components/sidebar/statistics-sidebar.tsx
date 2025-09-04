
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BarChart3, LandPlot, HelpCircle, LayoutGrid, Info, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElevationAnalysis } from './elevation-analysis';
import { DevelopmentDetails } from './development-details';

type StatisticsSidebarProps = {
  shapes: Shape[];
  isOpen: boolean;
  gridResolution: number;
  setGridResolution: (res: number) => void;
  steepnessThreshold: number;
  setSteepnessThreshold: (threshold: number) => void;
  elevationGrid: ElevationGrid | null;
  isAnalysisVisible: boolean;
  setIsAnalysisVisible: (visible: boolean) => void;
  selectedShapeIds: string[];
  onGenerateLayout: (zoneId: string, density: 'low' | 'medium' | 'high') => void;
};

const SQ_METERS_TO_ACRES = 0.000247105;

export default function StatisticsSidebar({ 
    shapes, 
    isOpen,
    gridResolution,
    setGridResolution,
    steepnessThreshold,
    setSteepnessThreshold,
    elevationGrid,
    isAnalysisVisible,
    setIsAnalysisVisible,
    selectedShapeIds,
    onGenerateLayout,
}: StatisticsSidebarProps) {

  const projectBoundary = shapes.find(s => s.type !== 'buffer' && !s.zoneMeta && !s.assetMeta);
  const zones = shapes.filter(s => !!s.zoneMeta);
  const developedAreaMeters = zones.reduce((acc, z) => acc + (z.area || 0), 0);
  const developedAreaAcres = developedAreaMeters * SQ_METERS_TO_ACRES;


  const totalAreaMeters = projectBoundary?.area || 0;
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;
  const developedPercentage = totalAreaMeters > 0 ? (developedAreaMeters / totalAreaMeters) * 100 : 0;

  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id));
  const selectedAreaMeters = selectedShapes.reduce((acc, shape) => acc + (shape.area || 0), 0);
  const selectedAreaAcres = selectedAreaMeters * SQ_METERS_TO_ACRES;

  const canGenerate = selectedShapes.length === 1 && selectedShapes[0].type === 'zone';

  return (
    <aside 
      id="stats-sidebar" 
      className={cn(
        "border-l bg-background/80 backdrop-blur-sm flex-col transition-all duration-300 ease-in-out",
        isOpen ? "w-80 flex" : "w-0 hidden"
      )}
    >
      <div className="p-4">
        <h2 className="text-xl font-semibold font-headline flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary"/>
            Overview
        </h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
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

          {canGenerate && (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                        <span>Zone Actions</span>
                        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="w-full">
                                Generate Layout
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                             <DropdownMenuItem onSelect={() => onGenerateLayout(selectedShapeIds[0], 'low')}>Low Density</DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => onGenerateLayout(selectedShapeIds[0], 'medium')}>Medium Density</DropdownMenuItem>
                             <DropdownMenuItem onSelect={() => onGenerateLayout(selectedShapeIds[0], 'high')}>High Density</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <CardDescription className="text-xs mt-2 text-center">
                        Automatically place buildings in the selected zone. This will replace any existing buildings in this zone.
                    </CardDescription>
                </CardContent>
            </Card>
          )}

           <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>UK Planning Guidance</span>
                <Info className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">
                The UK's National Planning Policy Framework (NPPF) prioritizes making effective use of land. Local planning authorities set specific density requirements.
                <br /><br />
                Typical residential densities often range from **30-50 dwellings per hectare** (dph), which is equivalent to about **12-20 dwellings per acre**.
              </CardDescription>
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Advanced Tools</span>
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm">
                Select two shapes to use the Union or Difference tools from the tool palette.
                <br /><br />
                Use <span className="font-mono bg-muted px-1 py-0.5 rounded">Ctrl/Cmd + Click</span> to select multiple shapes.
              </CardDescription>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </aside>
  );
}
