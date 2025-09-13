"use client";

import React, { useState } from "react";
import { DemographicData } from "@/services/data-integrator-service";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Shape, ElevationGrid } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  FileSearch,
  LandPlot,
  Mountain,
  ArrowUp,
  ArrowDown,
  Plane,
  School,
  Hospital,
  MapPin,
  Droplets,
  Users,
  Zap,
  Shield,
  FileDown,
  Sparkles,
  AlertCircle,
  Settings,
  TrendingUp,
  DollarSign,
  GraduationCap,
  Home,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  getProximityData,
  type ProximityData,
} from "@/services/proximity-service";
import {
  getIntegratedData,
  type IntegratedData,
} from "@/services/data-integrator-service";
import { PDFReportService } from "@/services/pdf-report-service";
import html2canvas from "html2canvas";
import { useMap } from "@vis.gl/react-google-maps";

const SQ_METERS_TO_ACRES = 0.000247105;

// Utilities
function getBoundsOfShape(shape: Shape): google.maps.LatLngBounds {
  const bounds = new google.maps.LatLngBounds();
  shape.path.forEach((p) => bounds.extend(p));
  return bounds;
}
function expandBounds(bounds: google.maps.LatLngBounds, factor: number) {
  const center = bounds.getCenter();
  const ne = bounds.getNorthEast();

  const newNeLat = center.lat() + (ne.lat() - center.lat()) * factor;
  const newNeLng = center.lng() + (ne.lng() - center.lng()) * factor;
  const newSwLat =
    center.lat() - (center.lat() - bounds.getSouthWest().lat()) * factor;
  const newSwLng =
    center.lng() - (center.lng() - bounds.getSouthWest().lng()) * factor;

  return new google.maps.LatLngBounds(
    new google.maps.LatLng(newSwLat, newSwLng),
    new google.maps.LatLng(newNeLat, newNeLng)
  );
}

interface SiteAssessmentDialogProps {
  shapes: Shape[];
  elevationGrid: ElevationGrid | null;
  siteName: string;
  aiSummary: string | null;
  extensiveReport?: {
    detailedAnalysis: string;
    risksOpportunities: string;
    recommendations: string;
  } | null;
}

export function SiteAssessmentDialog({
  shapes,
  elevationGrid,
  siteName,
  aiSummary,
  extensiveReport, // optional, currently not used in export but accepted to satisfy caller
}: SiteAssessmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState<ProximityData | null>(
    null
  );
  const [integratedData, setIntegratedData] = useState<IntegratedData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [exportTemplate, setExportTemplate] = useState<
    "standard" | "detailed" | "executive"
  >("standard");
  const [includeHighResMap, setIncludeHighResMap] = useState(false);

  const map = useMap();
  const projectBoundary = shapes.find(
    (s) => !s.zoneMeta && !s.assetMeta && !s.bufferMeta
  );

  const totalAreaMeters = projectBoundary?.area || 0;
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;
  const isDisabled = !projectBoundary || !elevationGrid;

  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && projectBoundary && map) {
      setIsLoading(true);
      setError(null);
      setAssessmentData(null);
      setIntegratedData(null);
      setMapImage(null);

      const originalCenter = map.getCenter();
      const originalZoom = map.getZoom();

      try {
        const shapeBounds = getBoundsOfShape(projectBoundary);
        const expandedBounds = expandBounds(shapeBounds, 2.25);
        map.fitBounds(expandedBounds);

        // Wait for map to render before screenshot
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Capture map image
        const mapContainer = map.getDiv();
        const canvas = await html2canvas(mapContainer, {
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        setMapImage(canvas.toDataURL("image/png"));

        // Fetch data
        const [proximityData, integrated] = await Promise.all([
          getProximityData(projectBoundary),
          getIntegratedData(projectBoundary),
        ]);
        setAssessmentData(proximityData);
        setIntegratedData(integrated);

        if (proximityData.validation.isValid === false) {
          setError(
            proximityData.validation.errors.join("; ") ||
              "Proximity validation failed."
          );
        }
      } catch (err) {
        console.error(err);
        setError("Failed to generate site assessment. Please try again.");
      } finally {
        if (originalCenter && originalZoom) {
          map.setCenter(originalCenter);
          map.setZoom(originalZoom);
        }
        setIsLoading(false);
      }
    }
  };

  const handleExport = async () => {
    if (!assessmentData || !integratedData || !projectBoundary) {
      alert(
        "Assessment data not available. Please wait for the analysis to complete."
      );
      return;
    }
    setIsExporting(true);
    try {
      const reportData = {
        siteName,
        projectBoundary,
        assessmentData,
        integratedData,
        elevationGrid: elevationGrid || {
          minSlope: 0,
          maxSlope: 0,
          cells: [],
          resolution: 1,
        },
        aiSummary,
        mapImage: mapImage || undefined,
        generatedAt: new Date().toISOString(),
      };

      await PDFReportService.generateReport(reportData, {
        includeCharts: true,
        includeHighResMap,
        template: exportTemplate,
        orientation: "portrait",
      });
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Could not export to PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Helpers
  const fmtNum = (n?: number | null, opts?: Intl.NumberFormatOptions) =>
    typeof n === "number" ? n.toLocaleString(undefined, opts) : "—";

  const riskLevel =
    integratedData?.environmental?.flood?.riskLevel ?? "Unknown";
  const riskBadgeClass =
    riskLevel === "very_high"
      ? "bg-red-100 text-red-700 border-red-200"
      : riskLevel === "high"
      ? "bg-red-100 text-red-700 border-red-200"
      : riskLevel === "medium"
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : riskLevel === "low"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-muted text-muted-foreground border-muted-foreground/20";

  const complianceScore = integratedData?.regulatory?.complianceScore ?? null;
  const greenBelt = integratedData?.regulatory?.greenBelt;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="w-full"
          disabled={isDisabled}
        >
          <FileSearch className="h-4 w-4 mr-2" />
          Generate Full Report
        </Button>
      </DialogTrigger>

      {/* Make dialog scrollable and structured */}
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        {/* Sticky Header */}
        <div className="flex-shrink-0 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <DialogHeader className="px-5 py-4">
            <DialogTitle className="text-xl md:text-2xl flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Site Assessment Report: {siteName}
            </DialogTitle>
            <DialogDescription>
              Summary of the selected property including area, elevation,
              proximity, environment, and compliance.
            </DialogDescription>

            {/* Quick stats row */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <LandPlot className="h-4 w-4" /> Area
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {fmtNum(totalAreaAcres, { maximumFractionDigits: 3 })} acres
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtNum(totalAreaMeters, { maximumFractionDigits: 0 })} m²
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mountain className="h-4 w-4" /> Slope
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    Min:{" "}
                    {elevationGrid
                      ? `${elevationGrid.minSlope.toFixed(1)}%`
                      : "—"}
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUp className="h-4 w-4 text-muted-foreground" />
                    Max:{" "}
                    {elevationGrid
                      ? `${elevationGrid.maxSlope.toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Droplets className="h-4 w-4" /> Flood Risk
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${riskBadgeClass}`}
                  >
                    {riskLevel}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {integratedData?.environmental?.flood?.percentageAffected !=
                  null
                    ? `${integratedData.environmental.flood.percentageAffected.toFixed(
                        1
                      )}% area affected`
                    : "—"}
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="h-4 w-4" /> Compliance
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {complianceScore != null ? `${complianceScore}/100` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Green Belt:{" "}
                  {greenBelt === true
                    ? "Yes"
                    : greenBelt === false
                    ? "No"
                    : "—"}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto" id="assessment-report">
          {/* Loading / Error states */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">
                Analyzing site data...
              </p>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-[60vh] px-6">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <p className="text-destructive text-center">{error}</p>
            </div>
          )}

          {!isLoading &&
            !error &&
            projectBoundary &&
            assessmentData &&
            integratedData && (
              <div className="px-5 pb-6 pt-4 space-y-8">
                {/* Map */}
                <section aria-label="Site Map">
                  <h3 className="font-semibold text-lg mb-3">Site Overview</h3>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="aspect-video w-full overflow-hidden rounded-md border bg-background">
                      {mapImage ? (
                        <img
                          src={mapImage}
                          alt="Site map"
                          className="h-full w-full object-cover"
                          data-ai-hint="map screenshot"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          No map preview
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Map extent auto-adjusted to show the site and
                      surroundings.
                    </p>
                  </div>
                </section>

                {/* Proximity */}
                <section aria-label="Proximity Analysis">
                  <h3 className="font-semibold text-lg mb-3">
                    Proximity Analysis
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Airport */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Plane className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Nearest Airport
                        </span>
                      </div>
                      {assessmentData.airport ? (
                        <>
                          <div className="font-semibold">
                            {assessmentData.airport.name}
                          </div>
                          <div className="text-sm text-foreground">
                            {assessmentData.airport.distanceKm} km /{" "}
                            {assessmentData.airport.distanceMiles} mi
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-foreground">Not found</div>
                      )}
                    </div>

                    {/* Town */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Nearest Town
                        </span>
                      </div>
                      {assessmentData.town ? (
                        <>
                          <div className="font-semibold">
                            {assessmentData.town.name}
                          </div>
                          <div className="text-sm text-foreground">
                            {assessmentData.town.distanceKm} km /{" "}
                            {assessmentData.town.distanceMiles} mi
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-foreground">Not found</div>
                      )}
                    </div>

                    {/* School */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <School className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Nearest School
                        </span>
                      </div>
                      {assessmentData.school ? (
                        <>
                          <div className="font-semibold">
                            {assessmentData.school.name}
                          </div>
                          <div className="text-sm text-foreground">
                            {assessmentData.school.distanceKm} km /{" "}
                            {assessmentData.school.distanceMiles} mi
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-foreground">Not found</div>
                      )}
                    </div>

                    {/* Hospital */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Hospital className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Nearest Hospital
                        </span>
                      </div>
                      {assessmentData.hospital ? (
                        <>
                          <div className="font-semibold">
                            {assessmentData.hospital.name}
                          </div>
                          <div className="text-sm text-foreground">
                            {assessmentData.hospital.distanceKm} km /{" "}
                            {assessmentData.hospital.distanceMiles} mi
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-foreground">Not found</div>
                      )}
                    </div>

                    {/* Highway */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-5 w-5" />
                        <span className="font-medium text-sm">
                          Nearest Highway
                        </span>
                      </div>
                      {assessmentData.highway ? (
                        <>
                          <div className="font-semibold">
                            {assessmentData.highway.name}
                          </div>
                          <div className="text-sm text-foreground">
                            {assessmentData.highway.distanceKm} km /{" "}
                            {assessmentData.highway.distanceMiles} mi
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-foreground">Not found</div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Topography */}
                <section aria-label="Topography Analysis">
                  <h3 className="font-semibold text-lg mb-3">
                    Topography Analysis
                  </h3>
                  <div className="rounded-md border bg-muted/30 p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Mountain className="h-5 w-5" /> Slope Extremes
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          Min Slope
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {elevationGrid
                            ? `${elevationGrid.minSlope.toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          Max Slope
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {elevationGrid
                            ? `${elevationGrid.maxSlope.toFixed(1)}%`
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          Resolution
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {elevationGrid
                            ? `${elevationGrid.resolution} m`
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded-md border bg-background p-3">
                        <div className="text-xs text-muted-foreground">
                          Cells
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                          {elevationGrid?.cells?.length ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Environmental */}
                <section aria-label="Environmental Factors">
                  <h3 className="font-semibold text-lg mb-3">
                    Environmental Factors
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-md border bg-muted/30 p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Droplets className="h-5 w-5" /> Flood Risk
                      </h4>
                      {integratedData.environmental.flood ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${riskBadgeClass}`}
                            >
                              {integratedData.environmental.flood.riskLevel}
                            </span>
                            <span className="text-xs text-foreground">
                              {integratedData.environmental.flood.percentageAffected.toFixed(
                                1
                              )}
                              % affected
                            </span>
                          </div>
                          <p className="text-sm text-foreground">
                            {integratedData.environmental.flood.description}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">Unavailable</p>
                      )}
                      {integratedData.environmental.ukFlood && (
                        <div className="mt-4">
                          <h5 className="font-medium text-sm mb-2">
                            UK Flood Data
                          </h5>
                          <div className="space-y-1 text-sm">
                            <p>
                              <span className="text-foreground">
                                High Risk:
                              </span>{" "}
                              {integratedData.environmental.ukFlood.stats.high}
                            </p>
                            <p>
                              <span className="text-foreground">
                                Medium Risk:
                              </span>{" "}
                              {
                                integratedData.environmental.ukFlood.stats
                                  .medium
                              }
                            </p>
                            <p>
                              <span className="text-foreground">Low Risk:</span>{" "}
                              {integratedData.environmental.ukFlood.stats.low}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border bg-muted/30 p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5" /> Soil Quality
                      </h4>
                      {integratedData.environmental.soil ? (
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-foreground">Type:</span>{" "}
                            {integratedData.environmental.soil.soilType}
                          </p>
                          <p>
                            <span className="text-foreground">Quality:</span>{" "}
                            {integratedData.environmental.soil.quality}
                            {"  "}
                            <span className="text-foreground">
                              • Drainage:
                            </span>{" "}
                            {integratedData.environmental.soil.drainage}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">Unavailable</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Demographics */}
                <section aria-label="Demographic Insights">
                  <h3 className="font-semibold text-lg mb-3">
                    Demographic Insights
                  </h3>
                  <div className="space-y-4">
                    {integratedData.demographic ? (
                      <>
                        <div className="rounded-md border bg-muted/30 p-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Population
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {fmtNum(integratedData.demographic.population)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {fmtNum(
                                  (integratedData.demographic.nationalAverages
                                    ?.population ?? 0) / 1000
                                )}
                                k
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Density (/km²)
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {fmtNum(integratedData.demographic.density)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.density ?? "—"}
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Median Age
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {integratedData.demographic.medianAge}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.medianAge ?? "—"}
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Avg Income
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                £
                                {fmtNum(
                                  integratedData.demographic.averageIncomeGbp
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK: £
                                {fmtNum(
                                  integratedData.demographic.nationalAverages
                                    ?.averageIncomeGbp
                                )}
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Employment Rate
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {integratedData.demographic.employmentRate}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.employmentRate ?? "—"}
                                %
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Higher Education
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {integratedData.demographic.educationLevels
                                  ?.higher ?? "—"}
                                {integratedData.demographic.educationLevels
                                  ?.higher
                                  ? "%"
                                  : ""}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.educationHigher ?? "—"}
                                %
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Affordability Index
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {
                                  integratedData.demographic
                                    .housingAffordabilityIndex
                                }
                                x
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.affordabilityIndex ?? "—"}
                                x
                              </div>
                            </div>
                            <div className="rounded-md border bg-background p-3">
                              <div className="text-xs text-muted-foreground">
                                Ownership Rate
                              </div>
                              <div className="mt-1 text-lg font-semibold">
                                {
                                  integratedData.demographic
                                    .propertyOwnershipRate
                                }
                                %
                              </div>
                              <div className="text-xs text-muted-foreground">
                                UK:{" "}
                                {integratedData.demographic.nationalAverages
                                  ?.ownershipRate ?? "—"}
                                %
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-md border bg-muted/30 p-4">
                          <h4 className="font-medium mb-2">
                            Comparisons to UK Averages
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              {
                                label: "Income",
                                local:
                                  integratedData.demographic.averageIncomeGbp ??
                                  0,
                                nat:
                                  integratedData.demographic.nationalAverages
                                    ?.averageIncomeGbp ?? 0,
                                icon: <DollarSign className="h-4 w-4" />,
                              },
                              {
                                label: "Employment",
                                local:
                                  integratedData.demographic.employmentRate ??
                                  0,
                                nat:
                                  integratedData.demographic.nationalAverages
                                    ?.employmentRate ?? 0,
                                icon: <TrendingUp className="h-4 w-4" />,
                              },
                              {
                                label: "Education",
                                local:
                                  integratedData.demographic.educationLevels
                                    ?.higher ?? 0,
                                nat:
                                  integratedData.demographic.nationalAverages
                                    ?.educationHigher ?? 0,
                                icon: <GraduationCap className="h-4 w-4" />,
                              },
                              {
                                label: "Ownership",
                                local:
                                  integratedData.demographic
                                    ?.propertyOwnershipRate ?? 0,
                                nat:
                                  integratedData.demographic.nationalAverages
                                    ?.ownershipRate ?? 0,
                                icon: <Home className="h-4 w-4" />,
                              },
                            ].map(({ label, local, nat, icon }) => {
                              const diff = ((local - nat) / nat) * 100;
                              const color =
                                Math.abs(diff) < 5
                                  ? "default"
                                  : diff > 0
                                  ? "default"
                                  : "secondary";
                              return (
                                <div key={label} className="space-y-1">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {icon}
                                    {label}
                                  </div>
                                  <Progress
                                    value={Math.min(
                                      100,
                                      Math.max(0, 50 + diff / 2)
                                    )}
                                    className={cn(
                                      "h-1",
                                      diff > 0
                                        ? "bg-green-500"
                                        : diff < 0
                                        ? "bg-red-500"
                                        : "bg-yellow-500"
                                    )}
                                  />
                                  <Badge variant={color} className="text-xs">
                                    {diff.toFixed(1)}%
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-md border bg-muted/30 p-4">
                            <h4 className="font-medium mb-2">
                              Age Distribution
                            </h4>
                            <div className="space-y-1 text-sm">
                              {Object.entries(
                                integratedData.demographic.ageDistribution ?? {}
                              ).map(([group, pct]) => (
                                <div
                                  key={group}
                                  className="flex justify-between"
                                >
                                  <span>{group}</span>
                                  <span className="font-semibold">{pct}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-md border bg-muted/30 p-4">
                            <h4 className="font-medium mb-2">Key Insights</h4>
                            <ul className="space-y-1 text-sm list-disc pl-4">
                              <li>
                                {(integratedData.demographic.averageIncomeGbp ??
                                  0) >
                                (integratedData.demographic.nationalAverages
                                  ?.averageIncomeGbp ?? 0)
                                  ? "Higher income supports luxury viability."
                                  : "Affordable housing opportunities."}
                              </li>
                              <li>
                                {(integratedData.demographic.employmentRate ??
                                  0) >
                                (integratedData.demographic.nationalAverages
                                  ?.employmentRate ?? 0)
                                  ? "Strong employment for stable demand."
                                  : "Target workforce housing."}
                              </li>
                              <li>
                                {(integratedData.demographic.medianAge ?? 0) <
                                (integratedData.demographic.nationalAverages
                                  ?.medianAge ?? 0)
                                  ? "Younger population favors family developments."
                                  : "Senior living potential."}
                              </li>
                            </ul>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border bg-muted/30 p-4">
                        <p className="text-sm text-muted-foreground">
                          Unavailable
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Infrastructure */}
                <section aria-label="Infrastructure Details">
                  <h3 className="font-semibold text-lg mb-3">
                    Infrastructure Details
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-md border bg-muted/30 p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Zap className="h-5 w-5" /> Transport
                      </h4>
                      {integratedData.infrastructure?.nearestRail ? (
                        <p className="text-sm">
                          <span className="font-semibold">
                            {integratedData.infrastructure.nearestRail.name}
                          </span>
                          :{" "}
                          {integratedData.infrastructure.nearestRail.distanceKm.toFixed(
                            1
                          )}{" "}
                          km
                        </p>
                      ) : (
                        <p className="text-sm text-foreground">
                          No nearby rail
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border bg-muted/30 p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5" /> Utilities
                      </h4>
                      {integratedData.infrastructure ? (
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                          <p>
                            <span className="text-foreground">Water:</span>{" "}
                            {integratedData.infrastructure.utilities.water
                              ? "Available"
                              : "Unknown"}
                          </p>
                          <p>
                            <span className="text-foreground">
                              Electricity:
                            </span>{" "}
                            {integratedData.infrastructure.utilities.electricity
                              ? "Available"
                              : "Unknown"}
                          </p>
                          <p>
                            <span className="text-foreground">Gas:</span>{" "}
                            {integratedData.infrastructure.utilities.gas
                              ? "Available"
                              : "Unknown"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">Unavailable</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Regulatory */}
                <section aria-label="Regulatory Compliance">
                  <h3 className="font-semibold text-lg mb-3">
                    Regulatory Compliance
                  </h3>
                  <div className="rounded-md border bg-muted/30 p-4">
                    {integratedData.regulatory ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-md border bg-background p-3">
                          <div className="text-xs text-muted-foreground">
                            Green Belt
                          </div>
                          <div className="mt-1 font-semibold">
                            {integratedData.regulatory.greenBelt ? "Yes" : "No"}
                          </div>
                        </div>
                        <div className="rounded-md border bg-background p-3">
                          <div className="text-xs text-muted-foreground">
                            Status
                          </div>
                          <div className="mt-1 font-semibold">
                            {integratedData.regulatory.planningStatus || "—"}
                          </div>
                        </div>
                        <div className="rounded-md border bg-background p-3">
                          <div className="text-xs text-muted-foreground">
                            Compliance Score
                          </div>
                          <div className="mt-1 font-semibold">
                            {integratedData.regulatory.complianceScore}/100
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Unavailable
                      </p>
                    )}

                    {integratedData.errors.length > 0 && (
                      <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                        <h4 className="font-medium flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4" /> Data Issues
                        </h4>
                        <ul className="list-disc list-inside text-sm">
                          {integratedData.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>

                {/* AI Summary */}
                {aiSummary && (
                  <section aria-label="AI Assessment">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" /> AI
                      Assessment
                    </h3>
                    <div className="rounded-md border bg-muted/20 p-4">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {aiSummary}
                      </p>
                    </div>
                  </section>
                )}
              </div>
            )}
        </div>

        {/* Sticky action bar */}
        <div className="flex-shrink-0 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-5 py-3 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Export Options</span>
            </div>
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
              <select
                value={exportTemplate}
                onChange={(e) =>
                  setExportTemplate(
                    e.target.value as "standard" | "detailed" | "executive"
                  )
                }
                className="px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
                <option value="executive">Executive</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeHighResMap}
                  onChange={(e) => setIncludeHighResMap(e.target.checked)}
                />
                High‑res Map
              </label>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Close
              </Button>
              <Button
                onClick={handleExport}
                disabled={
                  isExporting ||
                  isLoading ||
                  !assessmentData ||
                  !assessmentData.validation.isValid ||
                  !integratedData
                }
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
