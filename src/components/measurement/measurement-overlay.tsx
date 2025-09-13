"use client";

import React from "react";
import { LiveMeasurement, MeasurementConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MeasurementService } from "@/services/measurement";

interface MeasurementOverlayProps {
  measurements: LiveMeasurement | null;
  position: { x: number; y: number };
  config: MeasurementConfig;
  visible: boolean;
}

export const MeasurementOverlay: React.FC<MeasurementOverlayProps> = ({
  measurements,
  position,
  config,
  visible,
}) => {
  if (!visible || !measurements) {
    return null;
  }

  const { area, perimeter, units, precision } = measurements;

  return (
    <div
      className={cn(
        "absolute pointer-events-none bg-background/90 backdrop-blur-sm rounded-lg p-2 text-sm border shadow-lg z-50",
        "text-foreground",
        "md:left-[unset] md:right-4 md:top-4 md:transform-none"
      )}
      style={{
        left: position.x + 10,
        top: position.y - 60,
        transform: "translate(-50%, 0)",
      }}
      role="status"
      aria-live="polite"
      aria-label={`Live measurement: area ${MeasurementService.formatArea(
        area,
        units,
        precision
      )}, perimeter ${MeasurementService.formatDistance(
        perimeter,
        units,
        precision
      )}`}
    >
      <div className="space-y-1">
        {config.showArea && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">Area:</span>
            <span className="font-mono font-semibold">
              {MeasurementService.formatArea(area, units, precision)}
            </span>
          </div>
        )}
        {config.showPerimeter && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              Perimeter:
            </span>
            <span className="font-mono font-semibold">
              {MeasurementService.formatDistance(perimeter, units, precision)}
            </span>
          </div>
        )}
        {config.showVertexCount && (
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Vertices:</span>
            <span className="font-mono">
              {measurements.units === "metric" ? "N/A" : "N/A"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
