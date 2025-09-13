"use client";

import React from "react";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MAP_PROVIDERS } from "@/lib/map-providers";
import { LayerOverlay } from "@/lib/types";

interface LayerControlProps {
  activeProvider: string;
  onProviderChange: (providerId: string) => void;
  overlays: LayerOverlay[];
  onOverlayToggle: (overlayId: string, visible: boolean) => void;
  onOpacityChange: (overlayId: string, opacity: number) => void;
  onClose?: () => void;
  includeLocalAuthorities?: boolean;
}

const LayerControlComponent: React.FC<LayerControlProps> = ({
  activeProvider,
  onProviderChange,
  overlays,
  onOverlayToggle,
  onOpacityChange,
  onClose,
  includeLocalAuthorities = false,
}) => {
  // Keyboard navigation handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && onClose) {
      onClose();
      event.preventDefault();
    }
  };

  return (
    <Card
      className="absolute top-4 right-4 w-64 z-10 max-w-[calc(100vw-2rem)] md:max-w-64"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm" id="layer-control-title">
          Map Layers
        </CardTitle>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close layer control"
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent
        className="space-y-4"
        role="region"
        aria-labelledby="layer-control-title"
      >
        {/* Base Map Selection */}
        <div>
          <Label className="text-xs font-medium" htmlFor="base-map-select">
            Base Map
          </Label>
          <Select value={activeProvider} onValueChange={onProviderChange}>
            <SelectTrigger
              className="w-full"
              id="base-map-select"
              aria-label="Select base map provider"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAP_PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Overlay Controls */}
        <div>
          <Label className="text-xs font-medium" id="overlays-section">
            Overlays
          </Label>
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="overlays-section"
          >
            {overlays.map((overlay) => (
              <div
                key={overlay.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={overlay.visible}
                    onCheckedChange={(checked) =>
                      onOverlayToggle(overlay.id, checked)
                    }
                    aria-label={`Toggle ${overlay.name} overlay visibility`}
                    id={`overlay-${overlay.id}-toggle`}
                  />
                  <Label
                    className="text-xs"
                    htmlFor={`overlay-${overlay.id}-toggle`}
                  >
                    {overlay.name}
                  </Label>
                </div>
                {overlay.visible && (
                  <div className="flex items-center space-x-2">
                    <Label
                      className="text-xs sr-only"
                      htmlFor={`overlay-${overlay.id}-opacity`}
                    >
                      {overlay.name} opacity
                    </Label>
                    <Slider
                      value={[overlay.opacity]}
                      onValueChange={([value]) =>
                        onOpacityChange(overlay.id, value)
                      }
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-16"
                      id={`overlay-${overlay.id}-opacity`}
                      aria-label={`${overlay.name} opacity: ${Math.round(
                        overlay.opacity * 100
                      )}%`}
                    />
                  </div>
                )}
              </div>
            ))}
            {includeLocalAuthorities && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={false}
                    onCheckedChange={(checked) =>
                      onOverlayToggle("local-authorities", checked)
                    }
                    aria-label="Toggle local authorities overlay visibility"
                    id="overlay-local-authorities-toggle"
                  />
                  <Label
                    className="text-xs"
                    htmlFor="overlay-local-authorities-toggle"
                  >
                    Local Authority Boundaries
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const LayerControl = memo(LayerControlComponent);
