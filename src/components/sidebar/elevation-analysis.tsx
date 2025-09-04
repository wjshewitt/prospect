
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TrendingUp, Percent, Eye, EyeOff, Mountain, ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Separator } from '../ui/separator';

type ElevationAnalysisProps = {
  gridResolution: number;
  setGridResolution: (res: number) => void;
  steepnessThreshold: number;
  setSteepnessThreshold: (threshold: number) => void;
  elevationGrid: ElevationGrid | null;
  isAnalysisVisible: boolean;
  setIsAnalysisVisible: (visible: boolean) => void;
  selectedShapeIds: string[];
};

export function ElevationAnalysis({
  gridResolution,
  setGridResolution,
  steepnessThreshold,
  setSteepnessThreshold,
  elevationGrid,
  isAnalysisVisible,
  setIsAnalysisVisible,
  selectedShapeIds,
}: ElevationAnalysisProps) {

  const analysis = useMemo(() => {
    if (!elevationGrid || !elevationGrid.cells) {
      return { flatPercent: 0, steepPercent: 0, totalCells: 0, minSlope: 0, maxSlope: 0 };
    }
    
    const validCells = elevationGrid.cells.filter(cell => isFinite(cell.slope));
    if (validCells.length === 0) {
      return { flatPercent: 0, steepPercent: 0, totalCells: 0, minSlope: 0, maxSlope: 0, invalidCells: elevationGrid.cells.length };
    }

    const flatCount = validCells.filter(cell => cell.slope <= steepnessThreshold).length;
    const steepCount = validCells.length - flatCount;
    
    return {
      flatPercent: (flatCount / validCells.length) * 100,
      steepPercent: (steepCount / validCells.length) * 100,
      totalCells: validCells.length,
      invalidCells: elevationGrid.cells.length - validCells.length,
      minSlope: elevationGrid.minSlope,
      maxSlope: elevationGrid.maxSlope,
    }
  }, [elevationGrid, steepnessThreshold]);

  if (selectedShapeIds.length !== 1) {
    return (
        <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Elevation Analysis</span>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Select a single shape to analyze its slope.
              </CardDescription>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
            <span>Slope Analysis</span>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <Collapsible open={isAnalysisVisible} onOpenChange={setIsAnalysisVisible}>
              <div className="flex items-center justify-between space-x-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1">
                        {isAnalysisVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <Label htmlFor="analysis-visibility" className="cursor-pointer">Show Grid</Label>
                    </button>
                  </CollapsibleTrigger>
                <Switch 
                    id="analysis-visibility"
                    checked={isAnalysisVisible}
                    onCheckedChange={setIsAnalysisVisible}
                />
              </div>
              <CollapsibleContent className="space-y-6 pt-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="grid-resolution">Grid Resolution</Label>
                        <span className="text-sm font-medium">{gridResolution}m</span>
                    </div>
                    <Slider
                        id="grid-resolution"
                        min={5}
                        max={50}
                        step={1}
                        value={[gridResolution]}
                        onValueChange={([val]) => setGridResolution(val)}
                    />
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="steepness-threshold">Steepness Threshold</Label>
                        <span className="text-sm font-medium">{steepnessThreshold}%</span>
                    </div>
                    <Slider
                        id="steepness-threshold"
                        min={0}
                        max={100}
                        step={1}
                        value={[steepnessThreshold]}
                        onValueChange={([val]) => setSteepnessThreshold(val)}
                    />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {elevationGrid && analysis.totalCells > 0 && (
                <div className="space-y-4 pt-4">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                        <Percent className="h-4 w-4" /> Slope Breakdown
                    </h4>
                    <div className="flex justify-around text-center">
                        <div>
                            <p className="text-2xl font-bold text-green-600">{analysis.flatPercent.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">Gentle</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-600">{analysis.steepPercent.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">Steep</p>
                        </div>
                    </div>
                     <CardDescription className="text-xs text-center pt-2">
                        Analysis based on {analysis.totalCells} grid cells.
                        {analysis.invalidCells > 0 && ` (${analysis.invalidCells} invalid cells ignored).`}
                        {isAnalysisVisible && " Click a grid cell to see its slope."}
                    </CardDescription>

                    <Separator />

                    <h4 className="font-medium text-sm flex items-center gap-2">
                        <Mountain className="h-4 w-4" /> Slope Extemes
                    </h4>
                    <div className="flex justify-around text-center">
                        <div>
                            <p className="text-2xl font-bold flex items-center justify-center gap-1">
                                <ArrowDown className="h-5 w-5 text-muted-foreground" />
                                {analysis.minSlope.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Lowest</p>
                        </div>
                        <div>
                           <p className="text-2xl font-bold flex items-center justify-center gap-1">
                                <ArrowUp className="h-5 w-5 text-muted-foreground" />
                                {analysis.maxSlope.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">Steepest</p>
                        </div>
                    </div>
                </div>
            )}
             {(!elevationGrid || analysis.totalCells === 0) && (
                <CardDescription className="text-center pt-2">
                    Could not generate slope analysis for this area. Try a larger area or different resolution.
                </CardDescription>
             )}
        </CardContent>
    </Card>
  );
}
