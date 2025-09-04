
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, FileSearch, LandPlot, Mountain, ArrowUp, ArrowDown, Building, Plane, FileDown, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { findNearbyPlaces, FindNearbyPlacesOutput } from '@/ai/flows/find-nearby-places-flow';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useMap } from '@vis.gl/react-google-maps';

const SQ_METERS_TO_ACRES = 0.000247105;

interface SiteAssessmentDialogProps {
    shapes: Shape[];
    elevationGrid: ElevationGrid | null;
    siteName: string;
    aiSummary: string | null;
}

function getCenterOfShape(shape: Shape): {lat: number, lng: number} {
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach(p => bounds.extend(p));
    return bounds.getCenter().toJSON();
}

function getBoundsOfShape(shape: Shape): google.maps.LatLngBounds {
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach(p => bounds.extend(p));
    return bounds;
}

// Function to expand bounds by a factor. factor=2.25 means new area is ~5x old area.
function expandBounds(bounds: google.maps.LatLngBounds, factor: number) {
    const center = bounds.getCenter();
    const ne = bounds.getNorthEast();

    const newNeLat = center.lat() + (ne.lat() - center.lat()) * factor;
    const newNeLng = center.lng() + (ne.lng() - center.lng()) * factor;
    const newSwLat = center.lat() - (center.lat() - bounds.getSouthWest().lat()) * factor;
    const newSwLng = center.lng() - (center.lng() - bounds.getSouthWest().lng()) * factor;

    return new google.maps.LatLngBounds(
        new google.maps.LatLng(newSwLat, newSwLng),
        new google.maps.LatLng(newNeLat, newNeLng)
    );
}


export function SiteAssessmentDialog({ shapes, elevationGrid, siteName, aiSummary }: SiteAssessmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState<FindNearbyPlacesOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [mapImage, setMapImage] = useState<string | null>(null);

  const map = useMap();
  const projectBoundary = shapes.find(s => !s.zoneMeta && !s.assetMeta && !s.bufferMeta);


  const handleOpenChange = async (open: boolean) => {
    setIsOpen(open);
    if (open && projectBoundary && map) {
        setIsLoading(true);
        setError(null);
        setAssessmentData(null);
        setMapImage(null);

        // Store original map state
        const originalCenter = map.getCenter();
        const originalZoom = map.getZoom();

        try {
            // Calculate new bounds for the screenshot
            const shapeBounds = getBoundsOfShape(projectBoundary);
            const expandedBounds = expandBounds(shapeBounds, 2.25); // For ~20% area coverage
            map.fitBounds(expandedBounds);

            // Give map time to re-render before taking screenshot
            await new Promise(resolve => setTimeout(resolve, 500));

            // Capture map image
            const mapContainer = map.getDiv();
            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: true,
                logging: false,
            });
            setMapImage(canvas.toDataURL('image/png'));
           
            // Fetch assessment data in parallel
            const center = getCenterOfShape(projectBoundary);
            const data = await findNearbyPlaces(center);
            setAssessmentData(data);

        } catch (err) {
            console.error(err);
            setError("Failed to generate site assessment. Please try again.");
        } finally {
            // Restore original map state
            if(originalCenter && originalZoom) {
              map.setCenter(originalCenter);
              map.setZoom(originalZoom);
            }
            setIsLoading(false);
        }
    }
  }

  const handleExport = async () => {
    setIsExporting(true);
    const reportElement = document.getElementById('assessment-report');
    if (!reportElement) {
        setIsExporting(false);
        return;
    }

    try {
        const canvas = await html2canvas(reportElement, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 2, // Increase resolution
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${siteName.replace(/\s/g, '_')}_Site_Assessment.pdf`);
    } catch (error) {
        console.error('Failed to export PDF:', error);
        alert('Could not export to PDF. Please try again.');
    } finally {
        setIsExporting(false);
    }
  }
  
  const totalAreaMeters = projectBoundary?.area || 0;
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;
  const isDisabled = !projectBoundary || !elevationGrid;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
         <Button size="sm" variant="default" className="w-full" disabled={isDisabled}>
            <FileSearch className="h-4 w-4 mr-2" />
            Generate Full Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
             <FileSearch /> Site Assessment Report: {siteName}
          </DialogTitle>
          <DialogDescription>
            A summary of the selected property including area, elevation, and proximity to points of interest.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading && (
            <div className="flex flex-col items-center justify-center h-96">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Analyzing site data...</p>
            </div>
        )}

        {!isLoading && error && (
            <div className="flex flex-col items-center justify-center h-96">
                <p className="text-destructive">{error}</p>
            </div>
        )}

        {!isLoading && !error && projectBoundary && (
            <div id="assessment-report" className="p-4 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Left Column - Image and Area */}
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="font-semibold text-lg">Site Overview</h3>
                        {mapImage && <img src={mapImage} alt="Map of the site" className="rounded-md border" data-ai-hint="map screenshot" />}
                        <div className="p-4 rounded-md border bg-muted/50">
                            <h4 className="font-medium flex items-center gap-2 mb-2"><LandPlot className="h-5 w-5" /> Area</h4>
                            <p className="text-2xl font-bold">{totalAreaAcres.toFixed(3)} acres</p>
                            <p className="text-sm text-muted-foreground">{totalAreaMeters.toFixed(1)} square meters</p>
                        </div>
                    </div>
                    
                    {/* Right Column - Proximity and Elevation */}
                    <div className="md:col-span-3 space-y-4">
                         <h3 className="font-semibold text-lg">Proximity Analysis</h3>
                         <div className="p-4 rounded-md border bg-muted/50 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Plane className="h-5 w-5" />
                                    <h4 className="font-medium">Nearest Airport</h4>
                                </div>
                                {assessmentData?.airport ? (
                                    <div className="text-right">
                                        <p className="font-semibold">{assessmentData.airport.name}</p>
                                        <p className="text-sm text-muted-foreground">{assessmentData.airport.distanceKm} km / {assessmentData.airport.distanceMiles} miles</p>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">Not found</p>}
                            </div>
                            <Separator />
                             <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <Building className="h-5 w-5" />
                                    <h4 className="font-medium">Nearest Town</h4>
                                </div>
                                {assessmentData?.town ? (
                                    <div className="text-right">
                                        <p className="font-semibold">{assessmentData.town.name}</p>
                                        <p className="text-sm text-muted-foreground">{assessmentData.town.distanceKm} km / {assessmentData.town.distanceMiles} miles</p>
                                    </div>
                                ) : <p className="text-sm text-muted-foreground">Not found</p>}
                            </div>
                         </div>

                        <h3 className="font-semibold text-lg">Topography Analysis</h3>
                        <div className="p-4 rounded-md border bg-muted/50">
                             <h4 className="font-medium flex items-center gap-2 mb-3"><Mountain className="h-5 w-5" /> Slope Extremes</h4>
                             <div className="flex justify-around text-center">
                                <div>
                                    <p className="text-2xl font-bold flex items-center justify-center gap-1">
                                        <ArrowDown className="h-5 w-5 text-muted-foreground" />
                                        {elevationGrid?.minSlope.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">Lowest</p>
                                </div>
                                <div>
                                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                                        <ArrowUp className="h-5 w-5 text-muted-foreground" />
                                        {elevationGrid?.maxSlope.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">Steepest</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {aiSummary && (
                    <div className="mt-6">
                        <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            AI Assessment
                        </h3>
                        <div className="p-4 rounded-md border bg-muted/30 text-card-foreground">
                            <p className="whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
                        </div>
                    </div>
                )}
            </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
          <Button onClick={handleExport} disabled={isExporting || isLoading || !assessmentData}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
