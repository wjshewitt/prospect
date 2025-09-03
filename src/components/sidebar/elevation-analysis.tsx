
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { TrendingUp, Percent } from 'lucide-react';
import { useMemo } from 'react';

type ElevationAnalysisProps = {
  shape: Shape | null;
  gridResolution: number;
  setGridResolution: (res: number) => void;
  steepnessThreshold: number;
  setSteepnessThreshold: (threshold: number) => void;
  elevationGrid: ElevationGrid | null;
};

export function ElevationAnalysis({
  shape,
  gridResolution,
  setGridResolution,
  steepnessThreshold,
  setSteepnessThreshold,
  elevationGrid,
}: ElevationAnalysisProps) {

  const analysis = useMemo(() => {
    if (!elevationGrid || !elevationGrid.cells || elevationGrid.cells.length === 0) {
      return { flatPercent: 0, steepPercent: 0, totalCells: 0 };
    }
    const flatCount = elevationGrid.cells.filter(cell => cell.slope <= steepnessThreshold).length;
    const steepCount = elevationGrid.cells.length - flatCount;
    
    return {
      flatPercent: (flatCount / elevationGrid.cells.length) * 100,
      steepPercent: (steepCount / elevationGrid.cells.length) * 100,
      totalCells: elevationGrid.cells.length,
    }
  }, [elevationGrid, steepnessThreshold]);

  if (!shape) {
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
                Draw a single shape to analyze its slope.
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
        <CardContent className="space-y-6">
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
                    disabled // Will be enabled when debouncing is properly implemented
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

            {elevationGrid && analysis.totalCells > 0 && (
                <div className="space-y-4 pt-2">
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
                    </CardDescription>
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
