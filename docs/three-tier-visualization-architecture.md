# Three-Tier Visualization Architecture Design

## Executive Summary

This document outlines the detailed architecture for migrating from the current multi-provider mapping system (Google Maps + Mapbox + Deck.gl) to a streamlined three-tier visualization approach:

1. **MapLibre GL JS** - Primary 2D mapping and professional drawing tools
2. **Babylon.js + Mapbox** - General 3D visualization and terrain rendering
3. **Three.js** - Hyper-focused site view for detailed building placement and design

## Current Architecture Analysis

### Existing Technology Stack

- **Primary Map**: Google Maps API via `@vis.gl/react-google-maps`
- **3D Visualization**: Deck.gl with TerrainLayer and PolygonLayer
- **Drawing Tools**: Google Maps Drawing Manager
- **Bundle Size**: ~6MB (Google Maps ~3MB + Deck.gl ~2.5MB + utilities ~0.5MB)
- **Performance Issues**: Multiple WebGL contexts, provider switching complexity

### Key Pain Points Identified

1. **Bundle Size**: 6MB+ causing slow initial loads
2. **Provider Complexity**: [`MapProviderManager`](src/components/map/map-provider-manager.tsx) handling multiple tile sources
3. **Limited Drawing Tools**: Basic Google Maps drawing without CAD precision
4. **3D Performance**: Deck.gl overhead for simple building visualization
5. **Mobile Compatibility**: Heavy bundle impacting mobile performance

## Three-Tier Architecture Design

### Tier 1: MapLibre GL JS (Primary 2D Interface)

**Role**: Primary mapping engine, professional drawing tools, and data management

**Technology Stack**:

- **MapLibre GL JS v4.x** (~500KB)
- **@mapbox/mapbox-gl-draw v1.4.x** (~100KB)
- **Turf.js v6.5.x** (~200KB selective imports)
- **proj4js v2.x** (~50KB)

**Key Features**:

- Vector tile rendering with WebGL acceleration
- Professional CAD-like drawing tools with vertex editing
- Real-time measurements and snapping
- Style-based layer management
- Coordinate system transformations

**Component Architecture**:

```typescript
src/core/mapping/
├── MapLibreProvider.tsx          // MapLibre context and initialization
├── MapCanvas.tsx                 // Main map component (replaces current)
├── DrawingManager.tsx            // Professional drawing tools
├── LayerManager.tsx              // Style-based layer management
└── CoordinateSystem.ts           // Proj4js transformations
```

### Tier 2: Babylon.js + Mapbox (General 3D Visualization)

**Role**: General 3D terrain visualization, building overview, and site context

**Technology Stack**:

- **Babylon.js v6.x** (~800KB core)
- **Mapbox GL JS v3.x** (~600KB for terrain data)
- **@babylonjs/materials** (~200KB selective)

**Key Features**:

- High-performance 3D terrain rendering
- Efficient building mass visualization
- Smooth camera transitions between 2D/3D
- Terrain exaggeration and styling
- Large-scale site overview

**Component Architecture**:

```typescript
src/core/rendering/babylon/
├── BabylonRenderer.tsx           // Main Babylon.js integration
├── TerrainManager.tsx            // Mapbox terrain integration
├── BuildingRenderer.tsx          // 3D building visualization
├── CameraController.tsx          // 3D navigation and transitions
└── MaterialManager.tsx           // Babylon.js materials and shaders
```

### Tier 3: Three.js (Hyper-Focused Site View)

**Role**: Detailed building placement, architectural visualization, and precision editing

**Technology Stack**:

- **Three.js v0.165.x** (~600KB selective imports)
- **Custom building models and materials**
- **Precision interaction controls**

**Key Features**:

- Detailed building models with floors, materials, textures
- Precision placement and editing tools
- Architectural-quality rendering
- Real-time shadows and lighting
- Building configuration and customization

**Component Architecture**:

```typescript
src/core/rendering/three/
├── ThreeRenderer.tsx             // Three.js scene management
├── BuildingManager.tsx           // Detailed building models
├── PrecisionControls.tsx         // CAD-like interaction
├── MaterialLibrary.tsx           // Building materials and textures
└── LightingManager.tsx           // Realistic lighting and shadows
```

## Integration Architecture Patterns

### 1. Coordinate Synchronization System

```typescript
interface CoordinateSync {
  // Universal coordinate transformation
  worldToMap(position: Vector3): [number, number, number];
  mapToWorld(lngLat: [number, number], elevation?: number): Vector3;

  // Camera synchronization between tiers
  syncCameras(
    mapCamera: MapLibreCamera,
    babylonCamera: BabylonCamera,
    threeCamera: ThreeCamera
  ): void;

  // Viewport transformations
  screenToWorld(
    screenPos: [number, number],
    tier: "maplibre" | "babylon" | "three"
  ): Vector3;
}
```

### 2. Data Flow Architecture

```typescript
interface UnifiedDataPipeline {
  // Standardized GeoJSON data flow
  input: GeoJSON.FeatureCollection;

  // Processing pipeline
  spatial: TurfOperations;
  validation: ZoningRules;
  ai_processing: WASMModule;

  // Multi-tier output
  maplibre: MapLibreLayer;
  babylon: BabylonMesh[];
  three: ThreeObject3D[];
}
```

### 3. State Management System

```typescript
interface VisualizationState {
  // Current active tier
  activeTier: "maplibre" | "babylon" | "three";

  // Shared application state
  shapes: Shape[];
  selectedShapeIds: string[];
  viewState: UnifiedViewState;

  // Tier-specific states
  maplibreState: MapLibreState;
  babylonState: BabylonState;
  threeState: ThreeState;

  // Transition management
  transitionState: TierTransition;
}
```

## Component Migration Strategy

### Phase 1: MapLibre Foundation (Month 1)

**Replace Google Maps with MapLibre GL JS**

1. **Core Map Component Migration**:

   - Replace [`MapCanvas`](src/components/map/map-canvas.tsx) Google Maps implementation
   - Migrate [`MapProviderManager`](src/components/map/map-provider-manager.tsx) to single MapLibre provider
   - Update [`LayerControl`](src/components/map/layer-control.tsx) for style-based layers

2. **Drawing Tools Enhancement**:

   - Replace Google Maps Drawing Manager with @mapbox/mapbox-gl-draw
   - Implement CAD-like precision tools
   - Add real-time measurement capabilities
   - Enhance [`MeasurementService`](src/services/measurement.ts) for MapLibre

3. **Data Pipeline Updates**:
   - Update coordinate transformations
   - Migrate spatial operations to Turf.js
   - Preserve existing [`Shape`](src/lib/types.ts) type system

**Expected Outcomes**:

- 50% bundle size reduction (3MB → 1.5MB)
- Professional drawing capabilities
- Improved mobile performance

### Phase 2: Babylon.js 3D Integration (Month 2)

**Replace Deck.gl with Babylon.js**

1. **3D Renderer Implementation**:

   - Create new Babylon.js renderer component
   - Implement Mapbox terrain integration
   - Build efficient building visualization system

2. **Component Updates**:

   - Replace [`ThreeDVisualization`](src/components/dev-viz/three-d-modal.tsx) Deck.gl implementation
   - Update [`ThreeDEditorPanel`](src/components/sidebar/three-d-editor-panel.tsx) for Babylon.js
   - Implement smooth 2D↔3D transitions

3. **Performance Optimization**:
   - Implement level-of-detail (LOD) system
   - Add frustum culling for large sites
   - Optimize memory management

**Expected Outcomes**:

- Better 3D performance than Deck.gl
- Smoother camera transitions
- Enhanced terrain visualization

### Phase 3: Three.js Hyper-Focus Mode (Month 3)

**Implement Detailed Site View**

1. **Three.js Integration**:

   - Create hyper-focused site view component
   - Implement detailed building models
   - Add precision placement tools

2. **UI/UX Enhancements**:

   - Design tier switching interface
   - Implement context-aware tool palette
   - Add architectural visualization controls

3. **Advanced Features**:
   - Real-time lighting and shadows
   - Material and texture library
   - Building configuration system

**Expected Outcomes**:

- Architectural-quality visualization
- Precision building placement
- Enhanced user experience

### Phase 4: AI/ML Integration & Optimization (Month 4)

**WASM Architecture and Performance**

1. **WASM Integration**:

   - Set up WebAssembly module system
   - Implement AI building placement
   - Create ML data processing pipeline

2. **Performance Optimization**:

   - Implement advanced caching strategies
   - Add progressive loading
   - Optimize for mobile devices

3. **Testing and Validation**:
   - Comprehensive cross-browser testing
   - Performance benchmarking
   - User acceptance testing

## Performance Optimization Strategies

### Bundle Size Optimization

**Current vs. Proposed Bundle Sizes**:

```
Current Architecture:
├── Google Maps API: ~3MB
├── Deck.gl: ~2.5MB
├── Utilities: ~0.5MB
└── Total: ~6MB

Proposed Architecture:
├── MapLibre GL JS: ~500KB
├── Babylon.js (selective): ~800KB
├── Three.js (selective): ~600KB
├── Utilities: ~300KB
└── Total: ~2.2MB (63% reduction)
```

**Tree Shaking Configuration**:

```typescript
// webpack.config.js optimizations
module.exports = {
  optimization: {
    usedExports: true,
    sideEffects: false,
  },
  resolve: {
    alias: {
      // MapLibre selective imports
      "maplibre-gl": "maplibre-gl/dist/maplibre-gl-dev.js",
      // Three.js selective imports
      "three/examples/jsm": "three/examples/jsm",
    },
  },
};
```

**Code Splitting Strategy**:

```typescript
// Lazy load visualization tiers
const BabylonRenderer = lazy(
  () => import("./core/rendering/babylon/BabylonRenderer")
);
const ThreeRenderer = lazy(
  () => import("./core/rendering/three/ThreeRenderer")
);

// Progressive enhancement
const AdvancedTools = lazy(() => import("./features/advanced/AdvancedTools"));
```

### Memory Management

**Efficient Resource Management**:

```typescript
interface ResourceManager {
  // Automatic cleanup
  disposeGeometry(geometry: BufferGeometry): void;
  recycleMaterials(materials: Material[]): void;

  // Object pooling
  getBuildingFromPool(): Building3D;
  returnBuildingToPool(building: Building3D): void;

  // Memory monitoring
  getMemoryUsage(): MemoryStats;
  optimizeMemory(): void;
}
```

### Rendering Performance

**WebGL Context Management**:

- Shared WebGL context between MapLibre and Three.js where possible
- Efficient context switching for Babylon.js
- Automatic fallback to Canvas 2D for older browsers

**Level-of-Detail System**:

```typescript
interface LODSystem {
  // Distance-based LOD
  calculateLOD(distance: number, objectSize: number): LODLevel;

  // Viewport-based culling
  cullObjects(viewport: Viewport, objects: RenderObject[]): RenderObject[];

  // Dynamic quality adjustment
  adjustQuality(performanceMetrics: PerformanceStats): QualitySettings;
}
```

## API Interfaces and Coordinate Synchronization

### Unified Coordinate System

```typescript
interface UnifiedCoordinateSystem {
  // Primary coordinate reference
  crs: "EPSG:4326" | "EPSG:3857";

  // Transformation methods
  transform: {
    lngLatToWorld(lngLat: [number, number], elevation?: number): Vector3;
    worldToLngLat(position: Vector3): [number, number, number];
    screenToWorld(screen: [number, number], tier: VisualizationTier): Vector3;
    worldToScreen(world: Vector3, tier: VisualizationTier): [number, number];
  };

  // Precision handling
  precision: {
    coordinate: number; // decimal places for coordinates
    elevation: number; // decimal places for elevation
    measurement: number; // decimal places for measurements
  };
}
```

### Camera Synchronization

```typescript
interface CameraSync {
  // Unified camera state
  state: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
    elevation: number;
  };

  // Tier-specific camera updates
  updateMapLibre(camera: MapLibreCamera): void;
  updateBabylon(camera: BabylonCamera): void;
  updateThree(camera: ThreeCamera): void;

  // Smooth transitions
  transitionBetweenTiers(
    from: VisualizationTier,
    to: VisualizationTier,
    duration: number
  ): Promise<void>;
}
```

### Event Coordination

```typescript
interface EventBridge {
  // Cross-tier event handling
  onMapClick(event: MapClickEvent, tier: VisualizationTier): void;
  onShapeSelect(shapeId: string, tier: VisualizationTier): void;
  onDrawingComplete(feature: GeoJSON.Feature, tier: VisualizationTier): void;

  // State synchronization
  syncSelection(selectedIds: string[]): void;
  syncViewState(viewState: UnifiedViewState): void;
  syncShapeUpdates(shapes: Shape[]): void;
}
```

## Risk Mitigation Strategies

### Technical Risks

**WebGL Compatibility**:

- Progressive enhancement with Canvas 2D fallbacks
- WebGL capability detection and graceful degradation
- Comprehensive browser compatibility testing

**Performance Concerns**:

- Automated performance monitoring and alerting
- Memory usage tracking and optimization
- Frame rate monitoring with automatic quality adjustment

**Migration Complexity**:

- Phased migration approach with rollback capabilities
- Feature parity validation at each phase
- Comprehensive testing suite for each tier

### User Experience Risks

**Learning Curve**:

- Maintain familiar UI patterns during transition
- Progressive disclosure of advanced features
- In-app guidance and tutorials for new capabilities

**Feature Disruption**:

- Feature flags for gradual rollout
- Backward compatibility where possible
- User feedback collection and rapid iteration

## Testing and Validation Strategy

### Unit Testing

**Component Testing**:

```typescript
// Coordinate transformation accuracy
describe("CoordinateSync", () => {
  test("lngLat to world transformation accuracy", () => {
    const result = coordinateSync.lngLatToWorld([-74.006, 40.7128]);
    expect(result).toBeCloseTo(expectedVector3, 6);
  });
});

// Drawing tool precision
describe("DrawingManager", () => {
  test("vertex snapping precision", () => {
    const snappedVertex = drawingManager.snapVertex(inputVertex, snapDistance);
    expect(snappedVertex).toMatchPrecision(expectedVertex, 0.001);
  });
});
```

**Performance Testing**:

```typescript
// Memory leak detection
describe("ResourceManager", () => {
  test("memory cleanup after tier switch", async () => {
    const initialMemory = performance.memory.usedJSHeapSize;
    await switchTier("maplibre", "babylon");
    await switchTier("babylon", "maplibre");

    // Force garbage collection
    if (window.gc) window.gc();

    const finalMemory = performance.memory.usedJSHeapSize;
    expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024); // 10MB threshold
  });
});
```

### Integration Testing

**Cross-Tier Synchronization**:

```typescript
describe("TierSynchronization", () => {
  test("camera state sync between tiers", async () => {
    const initialState = { center: [-74.006, 40.7128], zoom: 15 };

    await setMapLibreCamera(initialState);
    await switchTier("maplibre", "babylon");

    const babylonState = getBabylonCameraState();
    expect(babylonState.center).toEqual(initialState.center);
    expect(babylonState.zoom).toBeCloseTo(initialState.zoom, 1);
  });
});
```

**Data Pipeline Testing**:

```typescript
describe("DataPipeline", () => {
  test("GeoJSON processing across tiers", () => {
    const inputFeature = createTestPolygon();

    const maplibreLayer = dataProcessor.toMapLibre(inputFeature);
    const babylonMesh = dataProcessor.toBabylon(inputFeature);
    const threeObject = dataProcessor.toThree(inputFeature);

    // Verify geometric consistency
    expect(getArea(maplibreLayer)).toBeCloseTo(getArea(babylonMesh), 2);
    expect(getArea(babylonMesh)).toBeCloseTo(getArea(threeObject), 2);
  });
});
```

### End-to-End Testing

**User Workflow Testing**:

```typescript
describe("UserWorkflows", () => {
  test("complete site planning workflow", async () => {
    // 1. Draw boundary in MapLibre
    await drawBoundary(testBoundaryPoints);

    // 2. Switch to Babylon for 3D overview
    await switchTo3DView();
    expect(getBoundaryIn3D()).toBeDefined();

    // 3. Switch to Three.js for detailed building placement
    await switchToHyperFocus();
    await placeBuildingWithPrecision(buildingConfig);

    // 4. Verify data consistency across all tiers
    const shapes = getAllShapes();
    expect(shapes).toHaveLength(2); // boundary + building
    expect(shapes[1].assetMeta).toBeDefined();
  });
});
```

## Implementation Timeline

### Month 1: MapLibre Foundation

- Week 1-2: MapLibre integration and basic functionality
- Week 3: Professional drawing tools implementation
- Week 4: Testing and refinement

### Month 2: Babylon.js 3D Integration

- Week 1-2: Babylon.js renderer and terrain integration
- Week 3: Building visualization and camera synchronization
- Week 4: Performance optimization and testing

### Month 3: Three.js Hyper-Focus Mode

- Week 1-2: Three.js detailed renderer implementation
- Week 3: Precision tools and architectural features
- Week 4: UI/UX integration and testing

### Month 4: AI/ML Integration & Optimization

- Week 1-2: WASM architecture and AI integration
- Week 3: Performance optimization and mobile compatibility
- Week 4: Final testing, documentation, and deployment

## Success Metrics

### Performance Metrics

- **Bundle Size**: Reduce from 6MB to <2.5MB (>50% reduction)
- **Initial Load Time**: Improve by >40%
- **Memory Usage**: Reduce peak memory by >30%
- **Frame Rate**: Maintain >30fps on mobile devices

### User Experience Metrics

- **Feature Parity**: 100% of existing features preserved
- **Drawing Precision**: Sub-meter accuracy for professional tools
- **Transition Smoothness**: <500ms tier switching
- **Mobile Performance**: Usable on devices with 2GB RAM

### Development Metrics

- **Code Maintainability**: Reduce complexity by consolidating providers
- **Test Coverage**: >90% coverage for core functionality
- **Documentation**: Complete API documentation for all tiers
- **Browser Support**: Support for 95% of target browsers

## Conclusion

This three-tier visualization architecture provides a comprehensive solution for the identified pain points while enabling future growth and AI/ML integration. The phased migration approach ensures minimal disruption while delivering significant performance improvements and enhanced capabilities.

The architecture balances the strengths of each technology:

- **MapLibre GL JS** for professional 2D mapping and drawing
- **Babylon.js** for efficient 3D terrain and building overview
- **Three.js** for detailed architectural visualization

This approach will result in a more performant, maintainable, and feature-rich application that serves both current needs and future expansion plans.
