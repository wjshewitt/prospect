# Component Hierarchy and Data Flow Diagrams

## Three-Tier Component Architecture

### Tier 1: MapLibre GL JS (2D Primary Interface)

```mermaid
graph TD
    A[MapLibreProvider] --> B[MapCanvas]
    A --> C[DrawingManager]
    A --> D[LayerManager]
    A --> E[CoordinateSystem]

    B --> F[MapLibreMap]
    B --> G[ShapeRenderer]
    B --> H[InteractionHandler]

    C --> I[DrawingTools]
    C --> J[VertexEditor]
    C --> K[SnapEngine]
    C --> L[MeasurementOverlay]

    D --> M[StyleManager]
    D --> N[TileSourceManager]
    D --> O[LayerVisibility]

    E --> P[Proj4Transformer]
    E --> Q[CoordinateValidator]

    I --> R[PolygonTool]
    I --> S[RectangleTool]
    I --> T[FreehandTool]
    I --> U[ZoneTool]
```

### Tier 2: Babylon.js + Mapbox (General 3D Visualization)

```mermaid
graph TD
    A[BabylonProvider] --> B[BabylonRenderer]
    A --> C[TerrainManager]
    A --> D[BuildingRenderer]
    A --> E[CameraController]
    A --> F[MaterialManager]

    B --> G[BabylonEngine]
    B --> H[SceneManager]
    B --> I[LightingSystem]

    C --> J[MapboxTerrain]
    C --> K[ElevationProcessor]
    C --> L[TerrainMesh]

    D --> M[BuildingMeshes]
    D --> N[LODManager]
    D --> O[InstanceRenderer]

    E --> P[ArcRotateCamera]
    E --> Q[CameraTransitions]
    E --> R[ViewportSync]

    F --> S[PBRMaterials]
    F --> T[TextureManager]
    F --> U[ShaderLibrary]
```

### Tier 3: Three.js (Hyper-Focused Site View)

```mermaid
graph TD
    A[ThreeProvider] --> B[ThreeRenderer]
    A --> C[BuildingManager]
    A --> D[PrecisionControls]
    A --> E[MaterialLibrary]
    A --> F[LightingManager]

    B --> G[WebGLRenderer]
    B --> H[SceneGraph]
    B --> I[RenderLoop]

    C --> J[DetailedBuildings]
    C --> K[BuildingEditor]
    C --> L[ComponentLibrary]

    D --> M[TransformControls]
    D --> N[SnapSystem]
    D --> O[MeasurementTools]

    E --> P[ArchMaterials]
    E --> Q[TextureAtlas]
    E --> R[MaterialEditor]

    F --> S[DirectionalLight]
    F --> T[AmbientLight]
    F --> U[ShadowSystem]
```

## Unified Data Flow Architecture

### Data Pipeline Overview

```mermaid
graph LR
    A[User Input] --> B[Event System]
    B --> C[State Manager]
    C --> D[Data Processor]
    D --> E[Coordinate Sync]
    E --> F[Tier Renderers]

    F --> G[MapLibre Layers]
    F --> H[Babylon Meshes]
    F --> I[Three Objects]

    G --> J[2D Visualization]
    H --> K[3D Overview]
    I --> L[Detailed View]

    J --> M[User Feedback]
    K --> M
    L --> M
    M --> B
```

### State Management Flow

```mermaid
graph TD
    A[Application State] --> B[Visualization State]
    A --> C[UI State]
    A --> D[Data State]

    B --> E[Active Tier]
    B --> F[Camera State]
    B --> G[Render Settings]

    C --> H[Tool Selection]
    C --> I[Panel Visibility]
    C --> J[User Preferences]

    D --> K[Shapes Collection]
    D --> L[Selected Items]
    D --> M[Edit History]

    E --> N[Tier Coordinator]
    F --> O[Camera Sync]
    G --> P[Render Manager]

    K --> Q[GeoJSON Processor]
    L --> R[Selection Manager]
    M --> S[Undo/Redo System]
```

## Integration Patterns

### Cross-Tier Communication

```mermaid
sequenceDiagram
    participant U as User
    participant E as Event System
    participant S as State Manager
    participant C as Coordinate Sync
    participant M as MapLibre
    participant B as Babylon
    participant T as Three.js

    U->>E: Draw Polygon
    E->>S: Update State
    S->>C: Transform Coordinates
    C->>M: Render 2D Shape

    U->>E: Switch to 3D
    E->>S: Change Active Tier
    S->>C: Sync Camera Position
    C->>B: Initialize 3D View
    B->>B: Render 3D Scene

    U->>E: Enter Hyper Focus
    E->>S: Switch to Three.js
    S->>C: Sync Detailed View
    C->>T: Load Detailed Models
    T->>T: Render Precision View
```

### Data Transformation Pipeline

```mermaid
graph LR
    A[Raw Input] --> B[Validation]
    B --> C[Normalization]
    C --> D[Coordinate Transform]
    D --> E[Spatial Processing]
    E --> F[Tier-Specific Format]

    F --> G[MapLibre GeoJSON]
    F --> H[Babylon Mesh Data]
    F --> I[Three.js Geometry]

    G --> J[Vector Layers]
    H --> K[3D Meshes]
    I --> L[Detailed Objects]

    subgraph "Processing Pipeline"
        B --> M[Schema Validation]
        C --> N[Unit Conversion]
        D --> O[CRS Transformation]
        E --> P[Turf.js Operations]
    end
```

## Component Interaction Patterns

### Event Flow Architecture

```mermaid
graph TD
    A[User Interaction] --> B[Event Capture]
    B --> C[Event Router]
    C --> D[Tier-Specific Handler]

    D --> E[MapLibre Handler]
    D --> F[Babylon Handler]
    D --> G[Three.js Handler]

    E --> H[2D Operations]
    F --> I[3D Operations]
    G --> J[Precision Operations]

    H --> K[State Update]
    I --> K
    J --> K

    K --> L[Cross-Tier Sync]
    L --> M[Render Update]

    M --> N[MapLibre Render]
    M --> O[Babylon Render]
    M --> P[Three.js Render]
```

### Memory Management Flow

```mermaid
graph TD
    A[Resource Allocation] --> B[Usage Tracking]
    B --> C[Memory Monitor]
    C --> D[Cleanup Trigger]

    D --> E[Tier Cleanup]
    E --> F[MapLibre Cleanup]
    E --> G[Babylon Cleanup]
    E --> H[Three.js Cleanup]

    F --> I[Layer Disposal]
    G --> J[Mesh Disposal]
    H --> K[Geometry Disposal]

    I --> L[Memory Pool]
    J --> L
    K --> L

    L --> M[Resource Recycling]
    M --> A
```

## Performance Optimization Patterns

### Lazy Loading Strategy

```mermaid
graph TD
    A[Application Start] --> B[Core Loading]
    B --> C[MapLibre Ready]

    C --> D[User Action]
    D --> E{Tier Switch?}

    E -->|3D View| F[Load Babylon]
    E -->|Hyper Focus| G[Load Three.js]
    E -->|Stay 2D| H[Continue MapLibre]

    F --> I[Babylon Ready]
    G --> J[Three.js Ready]

    I --> K[3D Rendering]
    J --> L[Detailed Rendering]
    H --> M[2D Rendering]
```

### Caching Architecture

```mermaid
graph TD
    A[Data Request] --> B[Cache Check]
    B --> C{Cache Hit?}

    C -->|Yes| D[Return Cached]
    C -->|No| E[Fetch Data]

    E --> F[Process Data]
    F --> G[Store in Cache]
    G --> H[Return Data]

    D --> I[Update Usage]
    H --> I

    I --> J[Cache Management]
    J --> K[LRU Eviction]
    K --> L[Memory Optimization]
```

## Migration Component Mapping

### Current to New Component Mapping

```mermaid
graph LR
    subgraph "Current Architecture"
        A[MapCanvas.tsx]
        B[MapProviderManager.tsx]
        C[ThreeDVisualization.tsx]
        D[ThreeDEditorPanel.tsx]
        E[MeasurementService.ts]
    end

    subgraph "New Architecture"
        F[MapLibreCanvas.tsx]
        G[TierManager.tsx]
        H[BabylonRenderer.tsx]
        I[ThreeRenderer.tsx]
        J[UnifiedMeasurement.ts]
    end

    A --> F
    B --> G
    C --> H
    C --> I
    D --> I
    E --> J
```

### Data Structure Evolution

```mermaid
graph TD
    A[Current Shape Type] --> B[Enhanced Shape Type]

    B --> C[MapLibre Feature]
    B --> D[Babylon Mesh Data]
    B --> E[Three.js Object Data]

    C --> F[Vector Layer]
    D --> G[3D Mesh]
    E --> H[Detailed Model]

    subgraph "Shape Enhancement"
        I[Add Tier Metadata]
        J[Add Performance Hints]
        K[Add Rendering Options]
    end

    B --> I
    B --> J
    B --> K
```

## Testing Architecture

### Component Testing Strategy

```mermaid
graph TD
    A[Unit Tests] --> B[Component Tests]
    B --> C[Integration Tests]
    C --> D[E2E Tests]

    B --> E[MapLibre Tests]
    B --> F[Babylon Tests]
    B --> G[Three.js Tests]

    C --> H[Tier Sync Tests]
    C --> I[Data Flow Tests]
    C --> J[Performance Tests]

    D --> K[User Workflow Tests]
    D --> L[Cross-Browser Tests]
    D --> M[Mobile Tests]
```

### Performance Testing Flow

```mermaid
graph LR
    A[Performance Test] --> B[Metrics Collection]
    B --> C[Analysis]
    C --> D[Optimization]
    D --> E[Validation]
    E --> F[Deployment]

    B --> G[Bundle Size]
    B --> H[Load Time]
    B --> I[Memory Usage]
    B --> J[Frame Rate]

    C --> K[Bottleneck ID]
    D --> L[Code Optimization]
    D --> M[Asset Optimization]
```

## Implementation Phases

### Phase 1: MapLibre Foundation

```mermaid
gantt
    title MapLibre Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Core Components
    MapLibre Integration    :a1, 2024-01-01, 7d
    Drawing Tools          :a2, after a1, 7d
    Layer Management       :a3, after a2, 7d
    Testing & Refinement   :a4, after a3, 7d
```

### Phase 2: Babylon.js Integration

```mermaid
gantt
    title Babylon.js Implementation Timeline
    dateFormat  YYYY-MM-DD
    section 3D Components
    Babylon Setup          :b1, 2024-02-01, 7d
    Terrain Integration    :b2, after b1, 7d
    Building Rendering     :b3, after b2, 7d
    Performance Optimization :b4, after b3, 7d
```

### Phase 3: Three.js Hyper-Focus

```mermaid
gantt
    title Three.js Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Detailed View
    Three.js Setup         :c1, 2024-03-01, 7d
    Precision Tools        :c2, after c1, 7d
    UI Integration         :c3, after c2, 7d
    Final Testing          :c4, after c3, 7d
```

This component hierarchy and data flow architecture provides a clear roadmap for implementing the three-tier visualization system while maintaining clean separation of concerns and efficient data flow between all components.
