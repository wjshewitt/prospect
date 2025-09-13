// Existing types preserved
export type LatLng = { lat: number; lng: number };

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

// Existing Shape type extended with new optional properties for Phase 1 enhancements
export type Shape = {
  id: string;
  type:
    | "rectangle"
    | "polygon"
    | "freehand"
    | "buffer"
    | "union"
    | "difference"
    | "zone";
  path: LatLng[]; // Legacy format for backward compatibility
  coordinates?: number[][][]; // GeoJSON polygon coordinates for MapLibre
  area?: number;
  visible?: boolean;
  properties?: {
    name?: string;
    description?: string;
    [key: string]: any;
  };
  // Optional metadata for buffer shapes
  bufferMeta?: {
    originalShapeId: string;
    distance: number;
  };
  // Optional metadata for zone shapes
  zoneMeta?: {
    kind: "residential" | "commercial" | "green_space" | "amenity" | "solar";
    name: string;
  };
  // Optional metadata for asset shapes
  assetMeta?: {
    assetType: "building" | "solar_panel";
    key: string;
    floors: number;
    rotation: number;
    width?: number;
    depth?: number;
  };
  // New properties for Phase 1: measurements, annotations, edit history, constraints
  measurements?: {
    area: number;
    perimeter: number;
    centroid: LatLng;
    bounds: Bounds;
  };
  annotations?: string[]; // Annotation IDs attached to this shape
  editHistory?: ShapeEdit[];
  constraints?: GeometricConstraints;
};

// Existing Tool type extended with new tools for measurement and annotation
export type Tool =
  | "pan"
  | "rectangle"
  | "polygon"
  | "freehand"
  | "zone"
  | "asset"
  | "multi-select"
  | "move-selection"
  | "measure"
  | "annotate";

// Existing Elevation types preserved
export type ElevationPoint = {
  location: LatLng;
  elevation: number;
};

export type ElevationGridCell = {
  bounds: Bounds;
  path: LatLng[];
  center: LatLng;
  slope: number; // as percent grade
  aspect: number;
};

export type ElevationGrid = {
  cells: ElevationGridCell[];
  resolution: number;
  minSlope: number;
  maxSlope: number;
  minElevation?: number;
  maxElevation?: number;
  // Data for 3D rendering
  pointGrid?: {
    grid: Float64Array;
    nx: number;
    ny: number;
  };
  xyBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

// New types for Live Measurement System (Phase 1 Priority 1)
export interface LiveMeasurement {
  area: number;
  perimeter: number;
  units: "metric" | "imperial";
  precision: number;
  displayPosition: { x: number; y: number };
}

export interface MeasurementConfig {
  showArea: boolean;
  showPerimeter: boolean;
  showVertexCount: boolean;
  units: "metric" | "imperial";
  precision: number; // decimal places
}

export interface Measurement {
  id: string;
  type: "distance" | "area" | "bearing";
  points: LatLng[];
  value: number;
  units: "metric" | "imperial";
  label?: string;
  timestamp: string;
}

// Updated MapProvider interface for MapLibre (Phase 1)
export interface MapProvider {
  id: string;
  name: string;
  type: "satellite" | "street" | "terrain" | "hybrid";
  attribution: string;
  maxZoom: number;
  // MapLibre style URL (for modern MapLibre providers)
  styleUrl?: string;
  // Legacy tile URL function (for backward compatibility)
  getTileUrl?: (x: number, y: number, z: number) => string;
  // Whether this provider requires an API key
  requiresApiKey?: boolean;
}

export const MAP_PROVIDERS: MapProvider[] = [
  {
    id: "google-satellite",
    name: "Google Satellite",
    type: "satellite",
    attribution: "© Google",
    maxZoom: 20,
    getTileUrl: () => "", // Handled by Google Maps API
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    getTileUrl: (x, y, z) =>
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  {
    id: "osm-detailed",
    name: "OSM Detailed",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    getTileUrl: (x, y, z) => `https://tiles.wmflabs.org/osm/${z}/${x}/${y}.png`,
  },
];

export interface LayerOverlay {
  id: string;
  name?: string;
  visible: boolean;
  opacity?: number;
  type:
    | "elevation"
    | "zoning" 
    | "property-lines"
    | "annotations"
    | "administrative"
    | "vector"
    | "raster"
    | "geojson";
  // Additional properties for MapLibre layers
  source?: any;
  paint?: any;
  layout?: any;
}

// New types for Local Authority Dataset Integration
export interface LocalAuthorityFeature {
  type: "Feature";
  properties: {
    dataset: string;
    "end-date": string;
    entity: string;
    "entry-date": string;
    name: string;
    "organisation-entity": string;
    prefix: string;
    reference: string;
    "start-date": string;
    typology: string;
  };
  geometry: {
    type: "MultiPolygon";
    coordinates: number[][][][];
  };
}

export interface LocalAuthorityCollection {
  type: "FeatureCollection";
  name: string;
  features: LocalAuthorityFeature[];
}

export interface LocalAuthorityInfo {
  name: string;
  reference: string;
  entity: string;
  planningAuthority: string;
}

// New types for Annotation System (Phase 1 Priority 3)
export interface AnnotationStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  leaderLine?: {
    enabled: boolean;
    style: "solid" | "dashed" | "dotted";
    color: string;
  };
}

export interface Annotation {
  id: string;
  type: "text" | "dimension" | "area-label" | "photo" | "voice-note";
  position: LatLng;
  content: string;
  style: AnnotationStyle;
  attachedTo?: string; // Shape ID if attached
  visible?: boolean;
  metadata?: Record<string, any>;
}

export interface DimensionAnnotation extends Annotation {
  type: "dimension";
  startPoint: LatLng;
  endPoint: LatLng;
  distance: number;
  units: "feet" | "meters";
  bearing?: number;
  offset: number; // Distance from measured line
}

// Enhanced types for advanced features
export interface EnhancedShape extends Shape {
  measurements?: {
    area: number;
    perimeter: number;
    centroid: LatLng;
    bounds: Bounds;
  };
  annotations?: string[]; // Annotation IDs
  editHistory?: ShapeEdit[];
  constraints?: GeometricConstraints;
}

export interface ShapeEdit {
  timestamp: string;
  operation: "vertex-move" | "vertex-add" | "vertex-delete" | "transform";
  oldGeometry: LatLng[];
  newGeometry: LatLng[];
}

export interface GeometricConstraints {
  maintainArea: boolean;
  preserveAngles: boolean;
  minimumEdgeLength: number;
  maximumVertices: number;
}

// Selection and editing state
export interface SelectionState {
  selectedShapes: string[];
  editingShape: string | null;
  editingVertices: number[];
  selectionMode: "single" | "multiple" | "additive";
  measurementActive: boolean;
  annotationMode: "text" | "dimension" | "area-label";
}

export interface EditingContext {
  tool: Tool;
  constraints: GeometricConstraints;
  feedback: VisualFeedback;
  accessibility: AccessibilityOptions;
}

interface VisualFeedback {
  // Placeholder for visual feedback types
  highlightColor: string;
  snapIndicator: boolean;
}

interface AccessibilityOptions {
  // Placeholder for accessibility options
  highContrast: boolean;
  screenReaderEnabled: boolean;
}

// Enhanced application state for VisionPage
export interface EnhancedVisionState {
  // Existing state properties would go here, but since we don't have the full existing state,
  // we define the new additions
  measurements: Measurement[];
  annotations: Annotation[];
  mapProvider: string;
  layerVisibility: Record<string, boolean>;
  measurementConfig: MeasurementConfig;
  selectionState: SelectionState;
  editingHistory: EditOperation[];
}

interface EditOperation {
  // Placeholder for edit operations
  type: string;
  timestamp: string;
  affectedShapes: string[];
}
