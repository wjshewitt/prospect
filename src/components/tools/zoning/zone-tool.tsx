import React, { useState, useEffect, useCallback, useRef } from "react";
import type { LatLng } from "@/lib/types";
import type { Shape } from "@/lib/types";
import type { ZoneKind } from "@/services/zoning/rules";
import {
  validateZone,
  suggestZoneKinds,
  calculateZoneStats,
} from "@/services/zoning/rules";
import { normalizeRing, computeArea } from "@/services/geometry/polygon";
import type {
  IMapAdapterExtended,
  PolygonDrawOptions,
  FreehandDrawOptions,
} from "@/services/geometry/map-adapter";
import { DEFAULT_POLYGON_OPTIONS } from "@/services/geometry/map-adapter";

/**
 * State machine states for zone drawing
 */
type ZoneToolState =
  | "idle"
  | "drawing"
  | "preview"
  | "validating"
  | "dialog"
  | "committing"
  | "error";

/**
 * Events that can occur during zone drawing
 */
type ZoneToolEvent =
  | { type: "START_DRAW" }
  | { type: "CANCEL" }
  | { type: "COMPLETE"; path: LatLng[] }
  | { type: "VALIDATE" }
  | { type: "SAVE"; name: string; kind: ZoneKind }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

/**
 * Props for the ZoneTool component
 */
export interface ZoneToolProps {
  /**
   * The map adapter to use for drawing operations
   */
  mapAdapter: IMapAdapterExtended;

  /**
   * The project boundary polygon
   */
  boundaryRing: LatLng[] | null;

  /**
   * Existing zones for conflict detection
   */
  existingZones: Array<{ ring: LatLng[]; kind: ZoneKind }>;

  /**
   * Callback when a zone is successfully created
   */
  onZoneCreated: (shape: Shape) => void;

  /**
   * Callback when drawing is cancelled
   */
  onCancel: () => void;

  /**
   * Options for the zone tool
   */
  options?: {
    minAreaMeters2?: number;
    allowHoles?: boolean;
    showLiveMetrics?: boolean;
    simplificationTolerance?: number;
  };
}

/**
 * ZoneTool component that handles the complete zone drawing workflow
 */
export const ZoneTool: React.FC<ZoneToolProps> = ({
  mapAdapter,
  boundaryRing,
  existingZones,
  onZoneCreated,
  onCancel,
  options = {},
}) => {
  const {
    minAreaMeters2 = 100,
    allowHoles = false,
    showLiveMetrics = true,
    simplificationTolerance = 0.00001,
  } = options;

  // State machine state
  const [state, setState] = useState<ZoneToolState>("idle");
  const [currentPath, setCurrentPath] = useState<LatLng[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Refs for cleanup
  const drawHandleRef = useRef<any>(null);
  const measurementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate unique IDs
  const generateId = useCallback(() => {
    return `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }, []);

  // State machine transition handler
  const handleEvent = useCallback(
    (event: ZoneToolEvent) => {
      switch (state) {
        case "idle":
          if (event.type === "START_DRAW") {
            setState("drawing");
            startDrawing();
          }
          break;

        case "drawing":
          if (event.type === "COMPLETE") {
            setCurrentPath(event.path);
            setState("preview");
          } else if (event.type === "CANCEL") {
            cleanup();
            setState("idle");
            onCancel();
          }
          break;

        case "preview":
          if (event.type === "VALIDATE") {
            validateCurrentZone();
          } else if (event.type === "CANCEL") {
            cleanup();
            setState("idle");
            onCancel();
          } else if (event.type === "SAVE") {
            setState("committing");
            commitZone(event.name, event.kind);
          }
          break;

        case "validating":
          // Validation is async, handled in validateCurrentZone
          break;

        case "dialog":
          if (event.type === "SAVE") {
            setState("committing");
            commitZone(event.name, event.kind);
          } else if (event.type === "CANCEL") {
            setState("preview");
          }
          break;

        case "committing":
          // Committing is handled in commitZone
          break;

        case "error":
          if (event.type === "RESET") {
            cleanup();
            setState("idle");
            setErrorMessage("");
          }
          break;
      }
    },
    [state, boundaryRing, existingZones]
  );

  // Start the drawing process
  const startDrawing = useCallback(() => {
    if (!boundaryRing) {
      setErrorMessage("No project boundary defined");
      setState("error");
      return;
    }

    mapAdapter.setCursor("crosshair");

    const drawOptions: PolygonDrawOptions = {
      ...DEFAULT_POLYGON_OPTIONS,
      strokeColor: "#8B5CF6",
      fillColor: "#8B5CF6",
    };

    const handle = mapAdapter.beginPolygonDraw(drawOptions, {
      onVertexAdded: (path) => {
        setCurrentPath(path);
        if (showLiveMetrics) {
          updateLiveMetrics(path);
        }
      },
      onPathChanged: (path) => {
        setCurrentPath(path);
        if (showLiveMetrics) {
          updateLiveMetrics(path);
        }
      },
      onComplete: (path) => {
        handleEvent({ type: "COMPLETE", path });
      },
      onCancel: () => {
        handleEvent({ type: "CANCEL" });
      },
    });

    drawHandleRef.current = handle;

    // Set up live metrics updates
    if (showLiveMetrics) {
      measurementIntervalRef.current = setInterval(() => {
        if (currentPath.length > 0) {
          updateLiveMetrics(currentPath);
        }
      }, 100);
    }
  }, [mapAdapter, boundaryRing, showLiveMetrics, handleEvent]);

  // Update live measurement display
  const updateLiveMetrics = useCallback(
    (path: LatLng[]) => {
      if (path.length < 3) return;

      try {
        const area = computeArea(normalizeRing(path));
        const acres = area / 4046.86;

        const metricsText = `${acres.toFixed(3)} acres\n${area.toFixed(1)} m²`;

        // Position tooltip at the center of the polygon
        const center = path.reduce(
          (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
          { lat: 0, lng: 0 }
        );
        center.lat /= path.length;
        center.lng /= path.length;

        const screenPos = mapAdapter.latLngToScreen(center);
        mapAdapter.showMeasurementTooltip(metricsText, screenPos);
      } catch (error) {
        console.warn("Error updating live metrics:", error);
      }
    },
    [mapAdapter]
  );

  // Validate the current zone
  const validateCurrentZone = useCallback(async () => {
    if (!currentPath || currentPath.length < 3) {
      setErrorMessage("Zone must have at least 3 points");
      setState("error");
      return;
    }

    if (!boundaryRing) {
      setErrorMessage("No project boundary defined");
      setState("error");
      return;
    }

    setState("validating");

    try {
      const normalizedPath = normalizeRing(currentPath);
      const validation = validateZone(
        { outer: normalizedPath, holes: [] },
        "residential", // Default kind, will be updated in dialog
        boundaryRing,
        existingZones,
        { allowHoles, minSeparationMeters: 10 }
      );

      setValidationResult(validation);

      if (validation.isValid) {
        setState("dialog");
      } else {
        setErrorMessage(validation.reasons.join("\n"));
        setState("error");
      }
    } catch (error) {
      console.error("Validation error:", error);
      setErrorMessage("Failed to validate zone");
      setState("error");
    }
  }, [currentPath, boundaryRing, existingZones, allowHoles]);

  // Commit the zone to the project
  const commitZone = useCallback(
    (name: string, kind: ZoneKind) => {
      if (!currentPath || !validationResult) {
        setErrorMessage("No valid zone to save");
        setState("error");
        return;
      }

      try {
        const normalizedPath = normalizeRing(currentPath);
        const area = computeArea(normalizedPath);

        const zoneShape: Shape = {
          id: generateId(),
          type: "zone",
          path: normalizedPath,
          area,
          zoneMeta: {
            name: name.trim(),
            kind,
          },
        };

        // Calculate final statistics
        const stats = calculateZoneStats(
          { outer: normalizedPath, holes: [] },
          kind
        );

        console.log("Zone created:", stats);

        onZoneCreated(zoneShape);
        cleanup();
        setState("idle");
      } catch (error) {
        console.error("Error committing zone:", error);
        setErrorMessage("Failed to create zone");
        setState("error");
      }
    },
    [currentPath, validationResult, generateId, onZoneCreated]
  );

  // Clean up resources
  const cleanup = useCallback(() => {
    if (drawHandleRef.current) {
      drawHandleRef.current.destroy();
      drawHandleRef.current = null;
    }

    if (measurementIntervalRef.current) {
      clearInterval(measurementIntervalRef.current);
      measurementIntervalRef.current = null;
    }

    mapAdapter.hideGhostPolygon();
    mapAdapter.hideMeasurementTooltip();
    mapAdapter.setCursor("default");

    setCurrentPath([]);
    setValidationResult(null);
  }, [mapAdapter]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state === "drawing" || state === "preview") {
        if (e.key === "Escape") {
          e.preventDefault();
          handleEvent({ type: "CANCEL" });
        } else if (e.key === "Enter" && state === "preview") {
          e.preventDefault();
          handleEvent({ type: "VALIDATE" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, handleEvent]);

  // Auto-start drawing when component mounts
  useEffect(() => {
    handleEvent({ type: "START_DRAW" });
  }, []); // Only run once on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Render state-specific UI
  const renderStateUI = () => {
    switch (state) {
      case "drawing":
        return (
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg z-10">
            <div className="text-sm font-medium text-foreground">
              Drawing Zone
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Click to add points • Press Enter to finish • Esc to cancel
            </div>
            {currentPath.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {currentPath.length} points
              </div>
            )}
          </div>
        );

      case "preview":
        return (
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg z-10">
            <div className="text-sm font-medium text-foreground">
              Zone Preview
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Press Enter to validate • Esc to cancel
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleEvent({ type: "VALIDATE" })}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90"
              >
                Validate
              </button>
              <button
                onClick={() => handleEvent({ type: "CANCEL" })}
                className="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case "validating":
        return (
          <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg z-10">
            <div className="text-sm font-medium text-foreground">
              Validating Zone...
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Checking geometry and rules
            </div>
          </div>
        );

      case "error":
        return (
          <div className="absolute top-4 left-4 bg-red-50 border border-red-200 p-3 rounded-lg shadow-lg z-10">
            <div className="text-sm font-medium text-red-800">Zone Error</div>
            <div className="text-xs text-red-600 mt-1 whitespace-pre-line">
              {errorMessage}
            </div>
            <button
              onClick={() => handleEvent({ type: "RESET" })}
              className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return renderStateUI();
};

export default ZoneTool;
