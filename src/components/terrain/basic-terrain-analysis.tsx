'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { runPythonCode } from '@/lib/sandbox';

interface BasicTerrainAnalysisProps {
    elevationPoints: { lat: number; lng: number; elevation: number }[];
}

export function BasicTerrainAnalysis({ elevationPoints }: BasicTerrainAnalysisProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<{
        maxElevation: number;
        minElevation: number;
        steepestSlope: number;
        buildableArea: number;
    } | null>(null);

    const analyzeElevation = async () => {
        setIsAnalyzing(true);
        try {
            // Simple Python code to analyze elevation data
            const pythonCode = `
import numpy as np
import json

# Parse elevation data
points = ${JSON.stringify(elevationPoints)}
elevations = [p['elevation'] for p in points]

# Basic calculations
max_elevation = max(elevations)
min_elevation = min(elevations)

# Calculate slopes between adjacent points
slopes = []
for i in range(len(points)-1):
    p1 = points[i]
    p2 = points[i+1]
    
    # Calculate distance in meters (approximate)
    dx = (p2['lng'] - p1['lng']) * 111000 * np.cos(np.radians(p1['lat']))
    dy = (p2['lat'] - p1['lat']) * 111000
    dist = np.sqrt(dx**2 + dy**2)
    
    # Calculate elevation difference
    dz = p2['elevation'] - p1['elevation']
    
    # Calculate slope percentage
    if dist > 0:
        slope = abs(dz / dist) * 100
        slopes.append(slope)

steepest_slope = max(slopes) if slopes else 0

# Calculate approximate buildable area (slopes < 15%)
buildable_count = sum(1 for slope in slopes if slope < 15)
buildable_area = buildable_count / len(slopes) * 100 if slopes else 0

result = {
    'maxElevation': max_elevation,
    'minElevation': min_elevation,
    'steepestSlope': steepest_slope,
    'buildableArea': buildable_area
}

print(json.dumps(result))
`;

            const execution = await runPythonCode(pythonCode);
            setResult(JSON.parse(execution.logs));

        } catch (error) {
            console.error('Error analyzing terrain:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Quick Terrain Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    onClick={analyzeElevation}
                    disabled={isAnalyzing}
                    className="w-full"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        'Analyze Terrain'
                    )}
                </Button>

                {result && (
                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-muted p-2">
                                <div className="text-xs text-muted-foreground">Highest Point</div>
                                <div>{result.maxElevation.toFixed(1)}m</div>
                            </div>
                            <div className="rounded-lg bg-muted p-2">
                                <div className="text-xs text-muted-foreground">Lowest Point</div>
                                <div>{result.minElevation.toFixed(1)}m</div>
                            </div>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Steepest Slope</div>
                            <div>{result.steepestSlope.toFixed(1)}%</div>
                        </div>
                        <div className="rounded-lg bg-muted p-2">
                            <div className="text-xs text-muted-foreground">Buildable Area</div>
                            <div>{result.buildableArea.toFixed(1)}% of site</div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
