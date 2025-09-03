
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BarChart3, LandPlot, Waves } from 'lucide-react';
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
}: StatisticsSidebarProps) {
  const totalAreaMeters = shapes.reduce((acc, shape) => acc + (shape.area || 0), 0);
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;

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
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalAreaAcres.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">acres</p>
              <Separator className="my-2" />
              <p className="text-lg font-semibold">{totalAreaMeters.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">square meters</p>
            </CardContent>
          </Card>

          <ElevationAnalysis
            shape={shapes.length === 1 ? shapes[0] : null}
            gridResolution={gridResolution}
            setGridResolution={setGridResolution}
            steepnessThreshold={steepnessThreshold}
            setSteepnessThreshold={setSteepnessThreshold}
            elevationGrid={elevationGrid}
            isAnalysisVisible={isAnalysisVisible}
            setIsAnalysisVisible={setIsAnalysisVisible}
          />

           <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Water Features</span>
                <Waves className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                No water features detected.
              </CardDescription>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </aside>
  );
}
