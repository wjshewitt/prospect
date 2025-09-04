
'use client';

import React, { useState, useMemo } from 'react';
import type { Shape, ElevationGrid } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { summarizeSite } from '@/ai/flows/summarize-site-flow';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const SQ_METERS_TO_ACRES = 0.000247105;
const STEEPNESS_THRESHOLD = 8; // Default steepness in percent

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
  const isDisabled = !projectBoundary || !elevationGrid;

  const handleGenerateSummary = async () => {
    if (isDisabled) return;

    setIsLoading(true);
    setError(null);
    setSummary(null);
    
    try {
        const siteAreaAcres = (projectBoundary.area || 0) * SQ_METERS_TO_ACRES;
        const elevationDifference = (elevationGrid.maxElevation || 0) - (elevationGrid.minElevation || 0);

        const validCells = elevationGrid.cells.filter(cell => isFinite(cell.slope));
        const steepCells = validCells.filter(cell => cell.slope > STEEPNESS_THRESHOLD);
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
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
                <span>AI Site Assessment</span>
                <Sparkles className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
            <CardDescription>
                Generate a natural-language summary of the site's key development characteristics.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <Button 
                onClick={handleGenerateSummary} 
                disabled={isDisabled || isLoading} 
                className="w-full"
                title={isDisabled ? "Draw and select a boundary to enable" : "Generate AI Site Summary"}
             >
                {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                )}
                Generate Summary
            </Button>

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

            {!summary && !isLoading && !error && (
                <CardDescription className="text-center text-xs pt-2">
                    {isDisabled 
                        ? 'Select a project boundary with topography data to enable summary generation.' 
                        : 'Click the button to generate an AI-powered summary.'
                    }
                </CardDescription>
            )}
        </CardContent>
    </Card>
  );
}
