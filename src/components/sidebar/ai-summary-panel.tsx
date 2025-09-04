
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { Shape, ElevationGrid } from '@/lib/types';
import { Loader2, Sparkles } from 'lucide-react';
import { summarizeSite } from '@/ai/flows/summarize-site-flow';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const SQ_METERS_TO_ACRES = 0.000247105;

interface AiSummaryPanelProps {
    siteName: string;
    shapes: Shape[];
    elevationGrid: ElevationGrid | null;
}

export function AiSummaryPanel({ siteName, shapes, elevationGrid }: AiSummaryPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectBoundary = useMemo(() => shapes.find(s => s.type !== 'buffer' && !s.zoneMeta && !s.assetMeta), [shapes]);
  const isReady = useMemo(() => !!projectBoundary && !!elevationGrid, [projectBoundary, elevationGrid]);

  useEffect(() => {
    // Automatically generate the summary when the component becomes visible and is ready.
    if (isReady) {
      setIsLoading(true);
      setError(null);
      setSummary(null);
      
      const generateSummary = async () => {
        try {
            const siteAreaAcres = (projectBoundary!.area || 0) * SQ_METERS_TO_ACRES;
            const elevationDifference = (elevationGrid!.maxElevation || 0) - (elevationGrid!.minElevation || 0);

            const steepnessThreshold = 8; // Define a standard steepness threshold
            const validCells = elevationGrid!.cells.filter(cell => isFinite(cell.slope));
            const steepCells = validCells.filter(cell => cell.slope > steepnessThreshold);
            const steepPercent = validCells.length > 0 ? (steepCells.length / validCells.length) * 100 : 0;
            const averageSlope = validCells.length > 0 ? validCells.reduce((acc, cell) => acc + cell.slope, 0) / validCells.length : 0;

            const input = {
                siteName,
                siteAreaAcres,
                elevationDifference,
                steepPercent,
                averageSlope,
            };
            
            const result = await summarizeSite(input);
            setSummary(result.summary);

        } catch (err) {
            console.error(err);
            setError("Failed to generate the AI summary. Please ensure the site has been analyzed first.");
        } finally {
            setIsLoading(false);
        }
      };

      generateSummary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, siteName]); // Re-run when readiness changes

  return (
    <div className="p-4">
        <Card className="border-0 shadow-none bg-transparent">
            <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                    <span>AI Site Assessment</span>
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
                <CardDescription>
                    A natural-language summary of the site's key development characteristics.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="mt-4 text-muted-foreground text-sm">The AI is analyzing the data...</p>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {summary && (
                    <div className="p-4 rounded-md border bg-muted/30 text-card-foreground">
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">{summary}</p>
                    </div>
                )}

                {!isReady && !isLoading && (
                     <CardDescription className="text-center text-xs pt-2">
                        Draw a project boundary and select it to enable the AI summary.
                    </CardDescription>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
