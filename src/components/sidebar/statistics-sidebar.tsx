

'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { BarChart3, LandPlot, Waves, HelpCircle, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ElevationAnalysis } from './elevation-analysis';

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
  onGenerateLayout: (zoneId: string) => void;
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
  const totalAreaMeters = shapes.reduce((acc, shape) => acc + (shape.area || 0), 0);
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;

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
                <span>Statistics</span>
                <LandPlot className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
              {selectedShapeIds.length > 0 && (
                 <CardDescription>
                    {selectedShapeIds.length} shape{selectedShapeIds.length > 1 ? 's' : ''} selected
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {selectedAreaAcres > 0 ? (
                <>
                  <p className="text-3xl font-bold">{selectedAreaAcres.toFixed(3)}</p>
                  <p className="text-sm text-muted-foreground">acres in selection</p>
                  <Separator className="my-2" />
                  <p className="text-lg font-semibold">{totalAreaAcres.toFixed(3)}</p>
                  <p className="text-xs text-muted-foreground">acres total</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold">{totalAreaAcres.toFixed(3)}</p>
                  <p className="text-sm text-muted-foreground">total acres</p>
                </>
              )}
            </CardContent>
          </Card>

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
                    <Button className="w-full" onClick={() => onGenerateLayout(selectedShapeIds[0])}>
                        Generate Layout
                    </Button>
                    <CardDescription className="text-xs mt-2 text-center">
                        Automatically place buildings in the selected zone. This will replace any existing buildings in this zone.
                    </CardDescription>
                </CardContent>
            </Card>
          )}

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
