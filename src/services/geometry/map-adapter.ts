import type { LatLng } from "@/lib/types";

/**
 * Screen coordinates for tooltips and overlays
 */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Options for polygon drawing
 */
export interface PolygonDrawOptions {
  strokeColor?: string;
  strokeWeight?: number;
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  zIndex?: number;
}

/**
 * Handle for an active drawing operation
 */
export interface DrawHandle {
  /**
   * Cancel the current drawing operation
   */
  cancel(): void;

  /**
   * Complete the current drawing operation
   */
  complete(): void;

  /**
   * Clean up resources
   */
  destroy(): void;
}

/**
 * Events emitted during polygon drawing
 */
export interface PolygonDrawEvents {
  onVertexAdded?: (path: LatLng[]) => void;
  onPathChanged?: (path: LatLng[]) => void;
  onComplete?: (path: LatLng[]) => void;
  onCancel?: () => void;
}

/**
 * Interface for map drawing operations
 * This abstracts the specific map implementation (Google Maps, Mapbox, etc.)
 */
export interface IMapAdapter {
  /**
   * Start drawing a polygon
   * @param options Visual styling options
   * @param events Event handlers
   * @returns Handle for the drawing operation
   */
  beginPolygonDraw(
    options: PolygonDrawOptions,
    events: PolygonDrawEvents
  ): DrawHandle;

  /**
   * Show a ghost/preview polygon while drawing
   * @param path Current path being drawn
   * @param options Visual styling
   */
  showGhostPolygon(path: LatLng[], options: PolygonDrawOptions): void;

  /**
   * Hide the ghost polygon
   */
  hideGhostPolygon(): void;

  /**
   * Show a tooltip with measurement information
   * @param text Text to display
   * @param position Screen position
   */
  showMeasurementTooltip(text: string, position: ScreenPoint): void;

  /**
   * Hide the measurement tooltip
   */
  hideMeasurementTooltip(): void;

  /**
   * Set the cursor style
   * @param cursor CSS cursor value
   */
  setCursor(cursor: string): void;

  /**
   * Convert map coordinates to screen coordinates
   * @param latLng Map coordinates
   * @returns Screen coordinates
   */
  latLngToScreen(latLng: LatLng): ScreenPoint;

  /**
   * Convert screen coordinates to map coordinates
   * @param screen Screen coordinates
   * @returns Map coordinates
   */
  screenToLatLng(screen: ScreenPoint): LatLng;

  /**
   * Get the current map bounds
   */
  getBounds(): {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  /**
   * Get the current zoom level
   */
  getZoom(): number;

  /**
   * Clean up all resources
   */
  destroy(): void;
}

/**
 * Default drawing options
 */
export const DEFAULT_POLYGON_OPTIONS: PolygonDrawOptions = {
  strokeColor: "#8B5CF6",
  strokeWeight: 4,
  strokeOpacity: 0.9,
  fillColor: "#8B5CF6",
  fillOpacity: 0.25,
  zIndex: 1000,
};

/**
 * Options for freehand drawing
 */
export interface FreehandDrawOptions extends PolygonDrawOptions {
  smoothing?: boolean;
  simplificationTolerance?: number;
}

/**
 * Events for freehand drawing
 */
export interface FreehandDrawEvents extends PolygonDrawEvents {
  onMouseMove?: (path: LatLng[]) => void;
}

/**
 * Handle for freehand drawing
 */
export interface FreehandDrawHandle extends DrawHandle {
  /**
   * Add a point to the current path
   */
  addPoint(point: LatLng): void;

  /**
   * Get the current path
   */
  getCurrentPath(): LatLng[];
}

/**
 * Extended map adapter with freehand drawing support
 */
export interface IMapAdapterExtended extends IMapAdapter {
  /**
   * Start freehand drawing
   * @param options Drawing options
   * @param events Event handlers
   * @returns Handle for the drawing operation
   */
  beginFreehandDraw(
    options: FreehandDrawOptions,
    events: FreehandDrawEvents
  ): FreehandDrawHandle;
}
