'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { analyzeTerrainForBuilding, estimateExcavationVolume } from '@/lib/terrain-analysis';
import type { ElevationGrid } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface TerrainAnalysisPanelProps {
    elevationGrid: ElevationGrid;
    onSuitableAreasFound?: (areas: number[][]) => void;
    onSteepAreasFound?: (areas: number[][]) => void;
    onBuildingPadsFound?: (pads: { coordinates: number[]; sizeSquareMeters: number }[]) => void;
}

export function TerrainAnalysisPanel({
    elevationGrid,
    onSuitableAreasFound,
    onSteepAreasFound,
    onBuildingPadsFound,
}: TerrainAnalysisPanelProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState<{
        maxSlope: number;
        meanSlope: number;
        cutVolume?: number;
        fillVolume?: number;
    } | null>(null);

    const runAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            // Convert elevation grid to points array
            const points = elevationGrid.cells.map(cell => ({
                lat: cell.center.lat,
                lng: cell.center.lng,
                elevation: cell.elevation,
            }));

            // Run terrain analysis
            const analysis = await analyzeTerrainForBuilding(points);
            
            // Update state with results
            setAnalysisResults({
                maxSlope: analysis.maxSlope,
                meanSlope: analysis.meanSlope,
            });

            // Calculate cut/fill volumes for a potential building pad
            // Using mean elevation as target for this example
            const meanElevation = points.reduce((sum, p) => sum + p.elevation, 0) / points.length;
            const volumes = await estimateExcavationVolume(points, meanElevation);
            
            setAnalysisResults(prev => ({
                ...prev!,
                cutVolume: volumes.cutVolume,
                fillVolume: volumes.fillVolume,
            }));

            // Notify parent components of results
            onSuitableAreasFound?.(analysis.suitableAreas);
            onSteepAreasFound?.(analysis.steepSlopes);
            onBuildingPadsFound?.(analysis.recommendedBuildingPads);

        } catch (error) {
            console.error('Error in terrain analysis:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="text-lg font-semibold">Terrain Analysis</h3>
            
            <Button 
                onClick={runAnalysis} 
                disabled={isAnalyzing || !elevationGrid}
                className="w-full"
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Terrain...
                    </>
                ) : (
                    'Analyze Terrain'
                )}
            </Button>

            {analysisResults && (
                <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Max Slope</div>
                            <div>{analysisResults.maxSlope.toFixed(1)}°</div>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Mean Slope</div>
                            <div>{analysisResults.meanSlope.toFixed(1)}°</div>
                        </div>
                    </div>

                    {analysisResults.cutVolume !== undefined && (
                        <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Estimated Earthwork</div>
                            <div>Cut: {(analysisResults.cutVolume / 1000).toFixed(1)}k m³</div>
                            <div>Fill: {(analysisResults.fillVolume! / 1000).toFixed(1)}k m³</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
