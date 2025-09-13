"use client";

import React, { useState, useMemo, useEffect } from "react";
import type { Shape, ElevationGrid } from "@/lib/types";
import { Loader2, Sparkles, FileSearch, BookOpen } from "lucide-react";
import { summarizeSite } from "@/ai/flows/summarize-site-flow";
import { getProximityData } from "@/services/proximity-service";
import { getIntegratedData } from "@/services/data-integrator-service";
import { localAuthorityService } from "@/services/local-authority/local-authority-service";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { SiteAssessmentDialog } from "../assessment/site-assessment-dialog";
import { Button } from "../ui/button";

const SQ_METERS_TO_ACRES = 0.000247105;

interface AiSummaryPanelProps {
  siteName: string;
  shapes: Shape[];
  elevationGrid: ElevationGrid | null;
}

interface ExtensiveReport {
  detailedAnalysis: string;
  risksOpportunities: string;
  recommendations: string;
}

export function AiSummaryPanel({
  siteName,
  shapes,
  elevationGrid,
}: AiSummaryPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingExtensive, setIsGeneratingExtensive] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [extensive, setExtensive] = useState<ExtensiveReport | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectBoundary = useMemo(
    () =>
      shapes.find((s) => s.type !== "buffer" && !s.zoneMeta && !s.assetMeta),
    [shapes]
  );
  const isReady = useMemo(
    () => !!projectBoundary && !!elevationGrid,
    [projectBoundary, elevationGrid]
  );

  // Round site area to the nearest whole acre for user-facing summaries
  const siteAreaAcresRounded = useMemo(
    () => Math.round((projectBoundary?.area || 0) * SQ_METERS_TO_ACRES),
    [projectBoundary]
  );

  // Generate cache key from boundary path (robust: supports LatLng objects, plain coords, arrays)
  const currentCacheKey = useMemo(() => {
    if (!projectBoundary || !projectBoundary.path) return null;
    const extract = (p: any) => {
      if (!p) return [0, 0];
      // Google LatLng-like: functions lat(), lng()
      if (typeof p.lat === "function" && typeof p.lng === "function")
        return [p.lat(), p.lng()];
      // Plain object with numeric lat/lng
      if (typeof p.lat === "number" && typeof p.lng === "number")
        return [p.lat, p.lng];
      // Some sources use latitude/longitude keys
      if (typeof p.latitude === "number" && typeof p.longitude === "number")
        return [p.latitude, p.longitude];
      // Array formats [lat, lng] or [lng, lat]
      if (Array.isArray(p) && p.length >= 2) {
        const a = Number(p[0]);
        const b = Number(p[1]);
        if (isFinite(a) && isFinite(b)) {
          // Heuristic: latitude in [-90,90]
          if (Math.abs(a) <= 90) return [a, b]; // [lat, lng]
          if (Math.abs(b) <= 90) return [b, a]; // swapped
        }
      }
      // Fallback: try to coerce numeric properties
      const maybeLat = Number(p.lat || p.latitude || p[1]);
      const maybeLng = Number(p.lng || p.longitude || p[0]);
      if (isFinite(maybeLat) && isFinite(maybeLng)) return [maybeLat, maybeLng];
      return [0, 0];
    };
    return JSON.stringify(projectBoundary.path.map(extract));
  }, [projectBoundary]);

  // Cache logic useEffect
  useEffect(() => {
    if (currentCacheKey && currentCacheKey !== cacheKey) {
      setCacheKey(currentCacheKey);
      setSummary(null);
      setExtensive(null);
    }
  }, [currentCacheKey, cacheKey]);

  // Summary generation useEffect
  useEffect(() => {
    if (isReady && cacheKey) {
      setIsLoading(true);
      setError(null);
      setSummary(null);

      const generateSummary = async () => {
        try {
          const siteAreaAcres = siteAreaAcresRounded;
          const elevationDifference =
            (elevationGrid!.maxElevation || 0) -
            (elevationGrid!.minElevation || 0);

          const steepnessThreshold = 8;
          const validCells = elevationGrid!.cells.filter((cell) =>
            isFinite(cell.slope)
          );
          const steepCells = validCells.filter(
            (cell) => cell.slope > steepnessThreshold
          );
          const steepPercent =
            validCells.length > 0
              ? (steepCells.length / validCells.length) * 100
              : 0;
          const averageSlope =
            validCells.length > 0
              ? validCells.reduce((acc, cell) => acc + cell.slope, 0) /
                validCells.length
              : 0;

          // Find local authority for the project boundary
          let localAuthorityInfo = null;
          if (projectBoundary && projectBoundary.path.length > 0) {
            const centroid = projectBoundary.path.reduce(
              (acc, point) => ({
                lat: acc.lat + point.lat / projectBoundary.path.length,
                lng: acc.lng + point.lng / projectBoundary.path.length,
              }),
              { lat: 0, lng: 0 }
            );

            try {
              const authority =
                await localAuthorityService.findContainingAuthority(
                  centroid.lat,
                  centroid.lng
                );
              localAuthorityInfo = authority;
            } catch (error) {
              console.error("Error finding local authority:", error);
            }
          }

          const input = {
            siteName,
            siteAreaAcres,
            elevationDifference,
            steepPercent,
            averageSlope,
            localAuthority: localAuthorityInfo || undefined,
            extensive: false,
          };

          const result = await summarizeSite(input);
          setSummary(result.summary);

          // Cache the result
          const cacheData = { summary: result.summary };
          localStorage.setItem(
            `ai-summary-${cacheKey}`,
            JSON.stringify(cacheData)
          );
        } catch (err) {
          console.error(err);
          setError(
            "Failed to generate the AI summary. Please ensure the site has been analyzed first."
          );
        } finally {
          setIsLoading(false);
        }
      };

      // Check cache first
      const cached = localStorage.getItem(`ai-summary-${cacheKey}`);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          setSummary(cacheData.summary);
          setIsLoading(false);
        } catch {
          generateSummary();
        }
      } else {
        generateSummary();
      }
    }
  }, [isReady, cacheKey, siteName, projectBoundary, elevationGrid]);

  const handleGenerateExtensive = async () => {
    if (!projectBoundary || !cacheKey) return;
    setIsGeneratingExtensive(true);
    setError(null);
    try {
      // Check cache first
      const cachedExtensive = localStorage.getItem(`ai-extensive-${cacheKey}`);
      if (cachedExtensive) {
        try {
          const cacheData = JSON.parse(cachedExtensive);
          setExtensive(cacheData.extensive);
          return;
        } catch {
          // Invalid cache, proceed to generate
        }
      }

      const [proximityData, integratedData] = await Promise.all([
        getProximityData(projectBoundary),
        getIntegratedData(projectBoundary),
      ]);

      const siteAreaAcres = siteAreaAcresRounded;
      const elevationDifference =
        (elevationGrid!.maxElevation || 0) - (elevationGrid!.minElevation || 0);

      const steepnessThreshold = 8;
      const validCells = elevationGrid!.cells.filter((cell) =>
        isFinite(cell.slope)
      );
      const steepCells = validCells.filter(
        (cell) => cell.slope > steepnessThreshold
      );
      const steepPercent =
        validCells.length > 0
          ? (steepCells.length / validCells.length) * 100
          : 0;
      const averageSlope =
        validCells.length > 0
          ? validCells.reduce((acc, cell) => acc + cell.slope, 0) /
            validCells.length
          : 0;

      // Find local authority for the project boundary
      let localAuthorityInfo = null;
      if (projectBoundary && projectBoundary.path.length > 0) {
        const centroid = projectBoundary.path.reduce(
          (acc, point) => ({
            lat: acc.lat + point.lat / projectBoundary.path.length,
            lng: acc.lng + point.lng / projectBoundary.path.length,
          }),
          { lat: 0, lng: 0 }
        );

        try {
          const authority = await localAuthorityService.findContainingAuthority(
            centroid.lat,
            centroid.lng
          );
          localAuthorityInfo = authority;
        } catch (error) {
          console.error("Error finding local authority:", error);
        }
      }

      const input = {
        siteName,
        siteAreaAcres,
        elevationDifference,
        steepPercent,
        averageSlope,
        proximityData,
        integratedData,
        elevationGrid: elevationGrid!,
        localAuthority: localAuthorityInfo || undefined,
        extensive: true,
      };

      const result = await summarizeSite(input);
      setExtensive(result.extensive!);

      // Cache the extensive result
      const extensiveCacheData = { extensive: result.extensive };
      localStorage.setItem(
        `ai-extensive-${cacheKey}`,
        JSON.stringify(extensiveCacheData)
      );
    } catch (err) {
      console.error(err);
      setError("Failed to generate extensive report. Please try again.");
    } finally {
      setIsGeneratingExtensive(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>AI Site Assessment</span>
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
          <CardDescription>
            A natural-language summary of the site's key development
            characteristics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground text-sm">
                The AI is analyzing the data...
              </p>
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
              <p className="whitespace-pre-wrap leading-relaxed text-sm">
                {summary}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateExtensive}
                disabled={isGeneratingExtensive || !isReady}
                className="mt-2 w-full justify-start"
              >
                {isGeneratingExtensive ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating extensive report...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Extensive Report
                  </>
                )}
              </Button>
            </div>
          )}

          {!isReady && !isLoading && (
            <CardDescription className="text-center text-xs pt-2">
              Draw a project boundary and select it to enable the AI summary.
            </CardDescription>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Full Report</span>
            <FileSearch className="h-5 w-5 text-muted-foreground" />
          </CardTitle>
          <CardDescription>
            Generate a comprehensive, exportable PDF report including proximity
            analysis, topography, and the AI summary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SiteAssessmentDialog
            shapes={shapes}
            elevationGrid={elevationGrid}
            siteName={siteName}
            aiSummary={summary}
            extensiveReport={extensive}
          />
        </CardContent>
      </Card>
    </div>
  );
}
