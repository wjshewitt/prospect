import type { LatLng } from "@/lib/types";
import type {
  IMapAdapterExtended,
  PolygonDrawOptions,
  PolygonDrawEvents,
  FreehandDrawOptions,
  FreehandDrawEvents,
  DrawHandle,
  FreehandDrawHandle,
  ScreenPoint,
} from "./map-adapter";
import { DEFAULT_POLYGON_OPTIONS } from "./map-adapter";

/**
 * Google Maps implementation of the map adapter
 */
export class GoogleMapAdapter implements IMapAdapterExtended {
  private map: google.maps.Map;
  private drawingManager: google.maps.drawing.DrawingManager | null = null;
  private ghostPolygon: google.maps.Polygon | null = null;
  private measurementTooltip: google.maps.InfoWindow | null = null;
  private freehandPolyline: google.maps.Polyline | null = null;
  private freehandPath: LatLng[] = [];
  private currentDrawHandle: DrawHandle | null = null;

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  beginPolygonDraw(
    options: PolygonDrawOptions,
    events: PolygonDrawEvents
  ): DrawHandle {
    // Clean up any existing drawing
    this.cleanup();

    const drawOptions = { ...DEFAULT_POLYGON_OPTIONS, ...options };

    this.drawingManager = new google.maps.drawing.DrawingManager({
      map: this.map,
      drawingControl: false,
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
      polygonOptions: {
        fillColor: drawOptions.fillColor,
        fillOpacity: drawOptions.fillOpacity,
        strokeColor: drawOptions.strokeColor,
        strokeWeight: drawOptions.strokeWeight,
        strokeOpacity: drawOptions.strokeOpacity,
        clickable: false,
        editable: false,
        zIndex: drawOptions.zIndex,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
      },
    });

    const handle: DrawHandle = {
      cancel: () => {
        this.drawingManager?.setDrawingMode(null);
        this.hideGhostPolygon();
        this.hideMeasurementTooltip();
        events.onCancel?.();
      },
      complete: () => {
        // This will be called when the polygon is completed
      },
      destroy: () => {
        this.cleanup();
      },
    };

    // Set up event listeners
    const completeListener = google.maps.event.addListener(
      this.drawingManager,
      "polygoncomplete",
      (polygon: google.maps.Polygon) => {
        const path = polygon
          .getPath()
          .getArray()
          .map((p) => ({ lat: p.lat(), lng: p.lng() }));

        polygon.setMap(null); // Remove the drawn polygon
        this.drawingManager?.setMap(null);
        this.hideGhostPolygon();
        this.hideMeasurementTooltip();

        events.onComplete?.(path);
        this.currentDrawHandle = null;
      }
    );

    // Store the handle for cleanup
    this.currentDrawHandle = handle;

    // Set up cleanup when the handle is destroyed
    handle.destroy = () => {
      google.maps.event.removeListener(completeListener);
      this.cleanup();
    };

    return handle;
  }

  beginFreehandDraw(
    options: FreehandDrawOptions,
    events: FreehandDrawEvents
  ): FreehandDrawHandle {
    // Clean up any existing drawing
    this.cleanup();

    const drawOptions = { ...DEFAULT_POLYGON_OPTIONS, ...options };
    this.freehandPath = [];

    const handle: FreehandDrawHandle = {
      addPoint: (point: LatLng) => {
        this.freehandPath.push(point);
        this.updateFreehandPolyline(drawOptions);
        events.onMouseMove?.(this.freehandPath);
      },
      getCurrentPath: () => this.freehandPath,
      cancel: () => {
        this.cleanupFreehand();
        events.onCancel?.();
      },
      complete: () => {
        if (this.freehandPath.length >= 3) {
          events.onComplete?.(this.freehandPath);
        }
        this.cleanupFreehand();
      },
      destroy: () => {
        this.cleanupFreehand();
      },
    };

    // Set up mouse event listeners on the map
    const mouseMoveListener = this.map.addListener(
      "mousemove",
      (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          handle.addPoint(e.latLng.toJSON());
        }
      }
    );

    const mouseUpListener = this.map.addListener("mouseup", () => {
      handle.complete();
    });

    // Enhanced cleanup
    handle.destroy = () => {
      google.maps.event.removeListener(mouseMoveListener);
      google.maps.event.removeListener(mouseUpListener);
      this.cleanupFreehand();
    };

    this.currentDrawHandle = handle;
    return handle;
  }

  showGhostPolygon(path: LatLng[], options: PolygonDrawOptions): void {
    this.hideGhostPolygon();

    if (path.length < 3) return;

    const drawOptions = { ...DEFAULT_POLYGON_OPTIONS, ...options };

    this.ghostPolygon = new google.maps.Polygon({
      map: this.map,
      paths: path,
      fillColor: drawOptions.fillColor,
      fillOpacity: drawOptions.fillOpacity,
      strokeColor: drawOptions.strokeColor,
      strokeWeight: drawOptions.strokeWeight,
      strokeOpacity: drawOptions.strokeOpacity,
      clickable: false,
      zIndex: drawOptions.zIndex,
    });
  }

  hideGhostPolygon(): void {
    if (this.ghostPolygon) {
      this.ghostPolygon.setMap(null);
      this.ghostPolygon = null;
    }
  }

  showMeasurementTooltip(text: string, position: ScreenPoint): void {
    this.hideMeasurementTooltip();

    // Convert screen coordinates to map coordinates
    const latLng = this.screenToLatLng(position);

    this.measurementTooltip = new google.maps.InfoWindow({
      content: text,
      position: latLng,
      disableAutoPan: true,
    });

    this.measurementTooltip.open(this.map);
  }

  hideMeasurementTooltip(): void {
    if (this.measurementTooltip) {
      this.measurementTooltip.close();
      this.measurementTooltip = null;
    }
  }

  setCursor(cursor: string): void {
    this.map.setOptions({ draggableCursor: cursor });
  }

  latLngToScreen(latLng: LatLng): ScreenPoint {
    const projection = this.map.getProjection();
    if (!projection) {
      return { x: 0, y: 0 };
    }

    const bounds = this.map.getBounds();
    if (!bounds) {
      return { x: 0, y: 0 };
    }

    const scale = Math.pow(2, this.map.getZoom());
    const nw = bounds.getNorthEast();
    const worldPoint = projection.fromLatLngToPoint(
      new google.maps.LatLng(latLng.lat, latLng.lng)
    );
    const mapTopLeft = projection.fromLatLngToPoint(nw);

    if (!worldPoint || !mapTopLeft) {
      return { x: 0, y: 0 };
    }

    return {
      x: (worldPoint.x - mapTopLeft.x) * scale,
      y: (worldPoint.y - mapTopLeft.y) * scale,
    };
  }

  screenToLatLng(screen: ScreenPoint): LatLng {
    const projection = this.map.getProjection();
    if (!projection) {
      return { lat: 0, lng: 0 };
    }

    const bounds = this.map.getBounds();
    if (!bounds) {
      return { lat: 0, lng: 0 };
    }

    const scale = Math.pow(2, this.map.getZoom());
    const nw = bounds.getNorthEast();
    const mapTopLeft = projection.fromLatLngToPoint(nw);

    if (!mapTopLeft) {
      return { lat: 0, lng: 0 };
    }

    const worldPoint = {
      x: mapTopLeft.x + screen.x / scale,
      y: mapTopLeft.y + screen.y / scale,
    };

    const latLng = projection.fromPointToLatLng(worldPoint);
    return { lat: latLng.lat(), lng: latLng.lng() };
  }

  getBounds() {
    const bounds = this.map.getBounds();
    if (!bounds) {
      return { north: 0, south: 0, east: 0, west: 0 };
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    return {
      north: ne.lat(),
      south: sw.lat(),
      east: ne.lng(),
      west: sw.lng(),
    };
  }

  getZoom(): number {
    return this.map.getZoom() || 0;
  }

  destroy(): void {
    this.cleanup();
  }

  private updateFreehandPolyline(options: FreehandDrawOptions): void {
    if (this.freehandPath.length === 0) return;

    if (!this.freehandPolyline) {
      this.freehandPolyline = new google.maps.Polyline({
        map: this.map,
        path: this.freehandPath,
        strokeColor: options.strokeColor,
        strokeWeight: options.strokeWeight,
        strokeOpacity: options.strokeOpacity,
        zIndex: options.zIndex,
      });
    } else {
      this.freehandPolyline.setPath(this.freehandPath);
    }
  }

  private cleanupFreehand(): void {
    if (this.freehandPolyline) {
      this.freehandPolyline.setMap(null);
      this.freehandPolyline = null;
    }
    this.freehandPath = [];
  }

  private cleanup(): void {
    if (this.drawingManager) {
      this.drawingManager.setMap(null);
      this.drawingManager = null;
    }

    this.hideGhostPolygon();
    this.hideMeasurementTooltip();
    this.cleanupFreehand();

    this.currentDrawHandle = null;
  }
}
