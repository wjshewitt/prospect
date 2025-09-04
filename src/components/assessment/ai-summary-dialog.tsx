
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { Shape, ElevationGrid } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { summarizeSite } from '@/ai/flows/summarize-site-flow';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const SQ_METERS_TO_ACRES = 0.000247105;
const STEEPNESS_THRESHOLD = 8; // Default steepness in percent

interface AiSummaryDialogProps {
    siteName: string;
    shapes: Shape[];
    elevationGrid: ElevationGrid | null;
}

export function AiSummaryDialog({ siteName, shapes, elevationGrid }: AiSummaryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectBoundary = useMemo(() => shapes.find(s => s.type !== 'buffer' && !s.zoneMeta && !s.assetMeta), [shapes]);

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && projectBoundary && elevationGrid) {
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
  }

  const isDisabled = !projectBoundary || !elevationGrid;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={isDisabled} title={isDisabled ? "Draw and select a boundary to enable" : "Generate AI Site Summary"}>
            <Sparkles className="h-4 w-4 mr-2" />
            AI Summary
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
             <Sparkles className="text-primary"/> AI Site Summary
          </DialogTitle>
          <DialogDescription>
            An AI-generated overview of the site's key development characteristics.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
            {isLoading && (
                <div className="flex flex-col items-center justify-center h-48">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">The AI is analyzing the data...</p>
                </div>
            )}

            {!isLoading && error && (
                 <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!isLoading && summary && (
                <div className="p-4 rounded-md border bg-muted/30 text-card-foreground">
                    <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
