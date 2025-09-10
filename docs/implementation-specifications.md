# Implementation Specifications & Technical Roadmap

## Detailed Component Specifications

### 1. Live Measurement System

#### **MeasurementOverlay Component**

```typescript
// src/components/measurement/measurement-overlay.tsx
interface MeasurementOverlayProps {
  measurements: LiveMeasurement;
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
  if (!visible) return null;

  return (
    <div
      className="absolute pointer-events-none bg-background/90 backdrop-blur-sm rounded-lg p-2 text-sm border shadow-lg z-50"
      style={{
        left: position.x + 10,
        top: position.y - 60,
        transform: "translate(-50%, 0)",
      }}
    >
      {config.showArea && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Area:</span>
          <span className="font-mono font-medium">
            {formatArea(measurements.area, config.units, config.precision)}
          </span>
        </div>
      )}
      {config.showPerimeter && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Perimeter:</span>
          <span className="font-mono font-medium">
            {formatDistance(
              measurements.perimeter,
              config.units,
              config.precision
            )}
          </span>
        </div>
      )}
    </div>
  );
};
```

#### **Enhanced Drawing Integration**

```typescript
// Extend existing FreehandDrawingTool
const EnhancedFreehandDrawingTool: React.FC<{
  onDrawEnd: (path: LatLng[]) => void;
  setSelectedTool: (tool: Tool) => void;
  shapes: Shape[];
  measurementConfig: MeasurementConfig;
}> = ({ onDrawEnd, setSelectedTool, shapes, measurementConfig }) => {
  const [liveMeasurement, setLiveMeasurement] =
    useState<LiveMeasurement | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  // Enhanced mouse move handler with live measurements
  const onMouseMove = (e: google.maps.MapMouseEvent) => {
    if (!isDrawing || !e.latLng) return;

    pathRef.current.push(e.latLng.toJSON());

    // Calculate live measurements
    if (pathRef.current.length > 2) {
      const area = google.maps.geometry.spherical.computeArea(pathRef.current);
      const perimeter = calculatePerimeter(pathRef.current);

      setLiveMeasurement({
        area,
        perimeter,
        units: measurementConfig.units,
        precision: measurementConfig.precision,
      });

      // Update cursor position for overlay
      const projection = map.getProjection();
      if (projection) {
        const point = projection.fromLatLngToPoint(e.latLng);
        setCursorPosition({ x: point.x, y: point.y });
      }
    }
  };

  return (
    <>
      {/* Existing drawing logic */}
      {liveMeasurement && (
        <MeasurementOverlay
          measurements={liveMeasurement}
          position={cursorPosition}
          config={measurementConfig}
          visible={isDrawing}
        />
      )}
    </>
  );
};
```

### 2. Map Provider System

#### **MapProviderManager Component**

```typescript
// src/components/map/map-provider-manager.tsx
interface MapProviderManagerProps {
  activeProvider: string;
  onProviderChange: (providerId: string) => void;
  children: React.ReactNode;
}

export const MapProviderManager: React.FC<MapProviderManagerProps> = ({
  activeProvider,
  onProviderChange,
  children,
}) => {
  const map = useMap();
  const [overlayMapTypes, setOverlayMapTypes] = useState<
    google.maps.ImageMapType[]
  >([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing overlays
    overlayMapTypes.forEach((overlay) => {
      const index = map.overlayMapTypes.getArray().indexOf(overlay);
      if (index !== -1) {
        map.overlayMapTypes.removeAt(index);
      }
    });

    // Add new provider overlay
    const provider = MAP_PROVIDERS.find((p) => p.id === activeProvider);
    if (provider && provider.id !== "google-satellite") {
      const mapType = new google.maps.ImageMapType({
        getTileUrl: (coord, zoom) =>
          provider.getTileUrl(coord.x, coord.y, zoom),
        tileSize: new google.maps.Size(256, 256),
        name: provider.name,
        maxZoom: provider.maxZoom,
      });

      map.overlayMapTypes.insertAt(0, mapType);
      setOverlayMapTypes([mapType]);
    }

    return () => {
      // Cleanup on unmount
      overlayMapTypes.forEach((overlay) => {
        const index = map.overlayMapTypes.getArray().indexOf(overlay);
        if (index !== -1) {
          map.overlayMapTypes.removeAt(index);
        }
      });
    };
  }, [map, activeProvider]);

  return <>{children}</>;
};
```

#### **LayerControl Component**

```typescript
// src/components/map/layer-control.tsx
export const LayerControl: React.FC<LayerControlProps> = ({
  activeProvider,
  onProviderChange,
  overlays,
  onOverlayToggle,
  onOpacityChange,
}) => {
  return (
    <Card className="absolute top-4 right-4 w-64 z-10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Map Layers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Map Selection */}
        <div>
          <Label className="text-xs font-medium">Base Map</Label>
          <Select value={activeProvider} onValueChange={onProviderChange}>
            <SelectTrigger className="w-full">
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
          <Label className="text-xs font-medium">Overlays</Label>
          <div className="space-y-2">
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
                  />
                  <Label className="text-xs">{overlay.name}</Label>
                </div>
                {overlay.visible && (
                  <Slider
                    value={[overlay.opacity]}
                    onValueChange={([value]) =>
                      onOpacityChange(overlay.id, value)
                    }
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-16"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

### 3. Annotation System

#### **AnnotationTool Component**

```typescript
// src/components/annotation/annotation-tool.tsx
interface AnnotationToolProps {
  mode: "text" | "dimension" | "area-label";
  onAnnotationCreate: (annotation: Annotation) => void;
  selectedShapes: Shape[];
}

export const AnnotationTool: React.FC<AnnotationToolProps> = ({
  mode,
  onAnnotationCreate,
  selectedShapes,
}) => {
  const map = useMap();
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] =
    useState<Partial<Annotation> | null>(null);

  useEffect(() => {
    if (!map || mode === "none") return;

    const handleMapClick = (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;

      const position = e.latLng.toJSON();

      if (mode === "text") {
        setPendingAnnotation({
          type: "text",
          position,
          content: "",
        });
        setIsPlacing(true);
      } else if (mode === "area-label" && selectedShapes.length > 0) {
        const shape = selectedShapes[0];
        const area = shape.area || 0;
        const formattedArea = formatArea(area, "imperial", 2);

        onAnnotationCreate({
          id: uuid(),
          type: "area-label",
          position,
          content: formattedArea,
          style: defaultAreaLabelStyle,
          attachedTo: shape.id,
        });
      }
    };

    const clickListener = map.addListener("click", handleMapClick);
    return () => clickListener.remove();
  }, [map, mode, selectedShapes, onAnnotationCreate]);

  return (
    <>
      {pendingAnnotation && (
        <AnnotationEditor
          annotation={pendingAnnotation}
          onSave={(annotation) => {
            onAnnotationCreate(annotation);
            setPendingAnnotation(null);
            setIsPlacing(false);
          }}
          onCancel={() => {
            setPendingAnnotation(null);
            setIsPlacing(false);
          }}
        />
      )}
    </>
  );
};
```

### 4. Coordinate Input System

#### **CoordinateInputDialog Component**

```typescript
// src/components/coordinate/coordinate-input-dialog.tsx
interface CoordinateInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCoordinatesSubmit: (coordinates: LatLng[]) => void;
  mode: "single-point" | "polygon" | "bearing-distance";
}

export const CoordinateInputDialog: React.FC<CoordinateInputDialogProps> = ({
  isOpen,
  onClose,
  onCoordinatesSubmit,
  mode,
}) => {
  const [coordinateSystem, setCoordinateSystem] = useState<
    "decimal-degrees" | "dms" | "utm"
  >("decimal-degrees");
  const [coordinates, setCoordinates] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    try {
      const parsedCoordinates = parseCoordinates(coordinates, coordinateSystem);
      const validatedCoordinates = validateCoordinates(parsedCoordinates, mode);

      if (validatedCoordinates.isValid) {
        onCoordinatesSubmit(validatedCoordinates.coordinates);
        onClose();
      } else {
        setValidationError(validatedCoordinates.error);
      }
    } catch (error) {
      setValidationError("Invalid coordinate format");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Coordinate Input</DialogTitle>
          <DialogDescription>
            Enter precise coordinates for {mode.replace("-", " ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Coordinate System</Label>
            <Select
              value={coordinateSystem}
              onValueChange={setCoordinateSystem}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decimal-degrees">Decimal Degrees</SelectItem>
                <SelectItem value="dms">Degrees, Minutes, Seconds</SelectItem>
                <SelectItem value="utm">UTM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Coordinates</Label>
            <Textarea
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              placeholder={getPlaceholderText(coordinateSystem, mode)}
              rows={mode === "polygon" ? 6 : 3}
            />
            {validationError && (
              <p className="text-sm text-destructive mt-1">{validationError}</p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Apply Coordinates</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### 5. Enhanced Vertex Editing

#### **VertexEditor Component**

```typescript
// src/components/editing/vertex-editor.tsx
interface VertexEditorProps {
  shape: Shape;
  onShapeUpdate: (updatedShape: Shape) => void;
  snapConfig: SnapConfiguration;
  constraints: EditingConstraints;
}

export const VertexEditor: React.FC<VertexEditorProps> = ({
  shape,
  onShapeUpdate,
  snapConfig,
  constraints,
}) => {
  const map = useMap();
  const [selectedVertices, setSelectedVertices] = useState<number[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [vertexMarkers, setVertexMarkers] = useState<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Create vertex markers
    const markers = shape.path.map((point, index) => {
      const marker = new google.maps.Marker({
        position: point,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: selectedVertices.includes(index) ? "#3B82F6" : "#FFFFFF",
          fillOpacity: 1,
          strokeColor: "#1F2937",
          strokeWeight: 2,
        },
        draggable: true,
        zIndex: 1000,
      });

      // Vertex selection
      marker.addListener("click", (e: google.maps.MapMouseEvent) => {
        const isCtrlClick = e.domEvent?.ctrlKey || e.domEvent?.metaKey;

        if (isCtrlClick) {
          setSelectedVertices((prev) =>
            prev.includes(index)
              ? prev.filter((i) => i !== index)
              : [...prev, index]
          );
        } else {
          setSelectedVertices([index]);
        }
      });

      // Vertex dragging with snapping
      marker.addListener("dragstart", () => {
        setDragState({ vertexIndex: index, originalPosition: point });
      });

      marker.addListener("drag", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        let newPosition = e.latLng.toJSON();

        // Apply snapping
        if (snapConfig.enabled) {
          newPosition = applySnapping(newPosition, shape, index, snapConfig);
        }

        // Update shape geometry
        const newPath = [...shape.path];
        newPath[index] = newPosition;

        // Validate constraints
        if (validateEditingConstraints(newPath, constraints)) {
          onShapeUpdate({
            ...shape,
            path: newPath,
            area: calculateArea(newPath),
          });
        }
      });

      return marker;
    });

    setVertexMarkers(markers);

    return () => {
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [map, shape, selectedVertices, snapConfig, constraints]);

  return null; // Markers are rendered directly on map
};
```

### 6. Measurement Utilities

#### **Measurement Service Implementation**

```typescript
// src/services/measurement.ts
export class MeasurementService {
  static calculateArea(
    path: LatLng[],
    units: "metric" | "imperial" = "metric"
  ): number {
    const areaM2 = google.maps.geometry.spherical.computeArea(path);
    return units === "imperial" ? areaM2 * 0.000247105 : areaM2; // Convert to acres or keep m²
  }

  static calculatePerimeter(
    path: LatLng[],
    units: "metric" | "imperial" = "metric"
  ): number {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(path[i]),
        new google.maps.LatLng(path[i + 1])
      );
    }
    // Close the polygon
    if (path.length > 2) {
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(path[path.length - 1]),
        new google.maps.LatLng(path[0])
      );
    }

    return units === "imperial" ? totalDistance * 3.28084 : totalDistance; // Convert to feet or keep meters
  }

  static calculateBearing(point1: LatLng, point2: LatLng): number {
    return google.maps.geometry.spherical.computeHeading(
      new google.maps.LatLng(point1),
      new google.maps.LatLng(point2)
    );
  }

  static formatArea(
    area: number,
    units: "metric" | "imperial",
    precision: number
  ): string {
    if (units === "imperial") {
      return area < 1
        ? `${(area * 43560).toFixed(precision)} sq ft`
        : `${area.toFixed(precision)} acres`;
    } else {
      return area < 10000
        ? `${area.toFixed(precision)} m²`
        : `${(area / 10000).toFixed(precision)} hectares`;
    }
  }

  static formatDistance(
    distance: number,
    units: "metric" | "imperial",
    precision: number
  ): string {
    if (units === "imperial") {
      return distance < 5280
        ? `${distance.toFixed(precision)} ft`
        : `${(distance / 5280).toFixed(precision)} miles`;
    } else {
      return distance < 1000
        ? `${distance.toFixed(precision)} m`
        : `${(distance / 1000).toFixed(precision)} km`;
    }
  }
}
```

### 7. Snapping System

#### **SnapManager Implementation**

```typescript
// src/services/snapping.ts
export class SnapManager {
  private snapTolerance: number;
  private gridSize: number;

  constructor(tolerance: number = 10, gridSize: number = 1) {
    this.snapTolerance = tolerance;
    this.gridSize = gridSize;
  }

  snapToGrid(point: LatLng, map: google.maps.Map): LatLng {
    const projection = map.getProjection();
    if (!projection) return point;

    const worldPoint = projection.fromLatLngToPoint(
      new google.maps.LatLng(point)
    );
    if (!worldPoint) return point;

    const scale = Math.pow(2, map.getZoom() || 1);
    const pixelGridSize = this.gridSize * scale;

    const snappedX = Math.round(worldPoint.x / pixelGridSize) * pixelGridSize;
    const snappedY = Math.round(worldPoint.y / pixelGridSize) * pixelGridSize;

    const snappedWorldPoint = new google.maps.Point(snappedX, snappedY);
    const snappedLatLng = projection.fromPointToLatLng(snappedWorldPoint);

    return snappedLatLng ? snappedLatLng.toJSON() : point;
  }

  snapToVertices(point: LatLng, shapes: Shape[], map: google.maps.Map): LatLng {
    const projection = map.getProjection();
    if (!projection) return point;

    const pointPixel = projection.fromLatLngToPoint(
      new google.maps.LatLng(point)
    );
    if (!pointPixel) return point;

    let closestVertex: LatLng | null = null;
    let minDistance = this.snapTolerance;

    shapes.forEach((shape) => {
      shape.path.forEach((vertex) => {
        const vertexPixel = projection.fromLatLngToPoint(
          new google.maps.LatLng(vertex)
        );
        if (!vertexPixel) return;

        const distance = Math.sqrt(
          Math.pow(pointPixel.x - vertexPixel.x, 2) +
            Math.pow(pointPixel.y - vertexPixel.y, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestVertex = vertex;
        }
      });
    });

    return closestVertex || point;
  }

  snapToEdges(point: LatLng, shapes: Shape[], map: google.maps.Map): LatLng {
    // Implementation for snapping to nearest edge
    // Complex geometric calculation - recommend advanced LLM for detailed implementation
    return point;
  }
}
```

## Integration with Existing Codebase

### 1. Enhanced Types

```typescript
// Add to src/lib/types.ts
export interface Measurement {
  id: string;
  type: "distance" | "area" | "bearing";
  points: LatLng[];
  value: number;
  units: "metric" | "imperial";
  label?: string;
  timestamp: string;
}

export interface Annotation {
  id: string;
  type: "text" | "dimension" | "area-label" | "photo";
  position: LatLng;
  content: string;
  style: AnnotationStyle;
  attachedTo?: string;
  visible: boolean;
  metadata?: Record<string, any>;
}

export interface LayerOverlay {
  id: string;
  name: string;
  type: "elevation" | "zoning" | "property-lines" | "annotations";
  visible: boolean;
  opacity: number;
  source?: string;
}
```

### 2. Enhanced VisionPage State

```typescript
// Add to VisionPageContent component
const [measurements, setMeasurements] = useState<Measurement[]>([]);
const [annotations, setAnnotations] = useState<Annotation[]>([]);
const [mapProvider, setMapProvider] = useLocalStorage(
  "map-provider",
  "google-satellite"
);
const [layerVisibility, setLayerVisibility] = useLocalStorage(
  "layer-visibility",
  {}
);
const [measurementConfig, setMeasurementConfig] = useLocalStorage(
  "measurement-config",
  {
    units: "imperial",
    precision: 2,
    showArea: true,
    showPerimeter: true,
    showLive: true,
  }
);
```

### 3. Auto-Save Integration

```typescript
// Extend existing handleSave function
const enhancedProjectData = {
  siteName,
  shapes,
  measurements, // NEW
  annotations, // NEW
  mapProvider, // NEW
  layerSettings: {
    // NEW
    visibility: layerVisibility,
    measurementConfig,
  },
  mapState: viewState,
  lastModified: new Date().toISOString(),
};
```

## Performance Optimization Strategy

### 1. Rendering Optimization

- **Viewport culling**: Only render annotations/measurements in current view
- **Level-of-detail**: Simplify geometry at lower zoom levels
- **Debounced updates**: Limit live measurement calculations to 60fps
- **Canvas pooling**: Reuse canvas elements for measurement overlays

### 2. Memory Management

- **Lazy loading**: Load detailed geometry only when editing
- **Efficient storage**: Use typed arrays for large coordinate datasets
- **Garbage collection**: Clean up unused markers and overlays
- **State compression**: Compress coordinate data for storage

### 3. User Experience Optimization

- **Progressive enhancement**: Basic tools work without advanced features
- **Responsive design**: Adapt tool layout for different screen sizes
- **Touch optimization**: Gesture support for mobile/tablet users
- **Keyboard accessibility**: Full keyboard navigation support

## Testing Strategy

### 1. Unit Tests

- **Measurement calculations**: Verify area/distance accuracy
- **Coordinate transformations**: Test conversion between systems
- **Snapping algorithms**: Validate snap-to behavior
- **Validation logic**: Test constraint enforcement

### 2. Integration Tests

- **Tool switching**: Verify seamless mode transitions
- **Auto-save integration**: Test persistence of new data types
- **Map provider switching**: Verify layer management
- **Annotation lifecycle**: Test create/edit/delete workflows

### 3. User Acceptance Tests

- **Developer workflow**: Test typical development planning tasks
- **Construction professional**: Verify surveyor tool accuracy
- **Accessibility compliance**: Screen reader and keyboard navigation
- **Performance benchmarks**: Large project handling

---

**Implementation Priority**: Start with live measurements and map provider switching as these provide immediate value with minimal complexity. The annotation system and vertex editing can follow in subsequent phases.

**Advanced Implementation Note**: For complex geometric algorithms (edge snapping, polygon intersection calculations, coordinate system transformations), consider switching to a specialized computational geometry LLM model for detailed mathematical implementations.
