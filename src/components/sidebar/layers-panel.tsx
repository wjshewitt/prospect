"use client";

import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { MapPin, Building, Layers3, Globe, Mountain } from "lucide-react";

interface LayersPanelProps {
  layerVisibility: Record<string, boolean>;
  setLayerVisibility: (visibility: Record<string, boolean>) => void;
  mapProvider: string;
  setMapProvider: (provider: string) => void;
}

export function LayersPanel({
  layerVisibility,
  setLayerVisibility,
  mapProvider,
  setMapProvider,
}: LayersPanelProps) {
  useEffect(() => {
    console.log(
      "LayersPanel props - setLayerVisibility:",
      typeof setLayerVisibility,
      setLayerVisibility
    );
    console.log(
      "LayersPanel props - setMapProvider:",
      typeof setMapProvider,
      setMapProvider
    );
  }, [setLayerVisibility, setMapProvider]);

  // Provide default values if props are undefined
  const safeLayerVisibility = layerVisibility || {};
  const safeMapProvider = mapProvider || "google-satellite";

  const handleLayerToggle = (layerId: string, enabled: boolean) => {
    console.log(
      "handleLayerToggle called - setLayerVisibility:",
      typeof setLayerVisibility
    );
    if (typeof setLayerVisibility !== "function") {
      console.error(
        "setLayerVisibility is not a function:",
        setLayerVisibility
      );
      return;
    }
    setLayerVisibility({
      ...safeLayerVisibility,
      [layerId]: enabled,
    });
  };

  const handleMapProviderChange = (provider: string) => {
    console.log(
      "handleMapProviderChange called - setMapProvider:",
      typeof setMapProvider
    );
    if (typeof setMapProvider !== "function") {
      console.error("setMapProvider is not a function:", setMapProvider);
      return;
    }
    setMapProvider(provider);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Map Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            Map Style
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleMapProviderChange("google-satellite")}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                safeMapProvider === "google-satellite"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              <Mountain className="h-4 w-4 mx-auto mb-1" />
              Satellite
            </button>
            <button
              onClick={() => handleMapProviderChange("google-roadmap")}
              className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                safeMapProvider === "google-roadmap"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-border"
              }`}
            >
              <MapPin className="h-4 w-4 mx-auto mb-1" />
              Roadmap
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Layer Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Layers3 className="h-4 w-4 mr-2" />
            Map Layers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Local Authorities Layer */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="local-authorities"
                className="text-sm font-medium"
              >
                Local Authorities
              </Label>
              <p className="text-xs text-muted-foreground">
                Show administrative boundaries
              </p>
            </div>
            <Switch
              id="local-authorities"
              checked={safeLayerVisibility["local-authorities"] || false}
              onCheckedChange={(checked) =>
                handleLayerToggle("local-authorities", checked)
              }
            />
          </div>

          <Separator />

          {/* Buildings Layer */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="buildings" className="text-sm font-medium">
                Buildings
              </Label>
              <p className="text-xs text-muted-foreground">
                Show building footprints
              </p>
            </div>
            <Switch
              id="buildings"
              checked={safeLayerVisibility["buildings"] || false}
              onCheckedChange={(checked) =>
                handleLayerToggle("buildings", checked)
              }
            />
          </div>

          <Separator />

          {/* Terrain Layer */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="terrain" className="text-sm font-medium">
                Terrain
              </Label>
              <p className="text-xs text-muted-foreground">
                Show elevation contours
              </p>
            </div>
            <Switch
              id="terrain"
              checked={safeLayerVisibility["terrain"] || false}
              onCheckedChange={(checked) =>
                handleLayerToggle("terrain", checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Layer Opacity Controls */}
      {(safeLayerVisibility["local-authorities"] ||
        safeLayerVisibility["buildings"] ||
        safeLayerVisibility["terrain"]) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Layer Opacity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {safeLayerVisibility["local-authorities"] && (
              <div className="space-y-2">
                <Label className="text-sm">Local Authorities</Label>
                <Slider
                  defaultValue={[30]}
                  max={100}
                  step={10}
                  className="w-full"
                />
              </div>
            )}
            {safeLayerVisibility["buildings"] && (
              <div className="space-y-2">
                <Label className="text-sm">Buildings</Label>
                <Slider
                  defaultValue={[50]}
                  max={100}
                  step={10}
                  className="w-full"
                />
              </div>
            )}
            {safeLayerVisibility["terrain"] && (
              <div className="space-y-2">
                <Label className="text-sm">Terrain</Label>
                <Slider
                  defaultValue={[40]}
                  max={100}
                  step={10}
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
