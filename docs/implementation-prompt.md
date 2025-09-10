# Implementation Prompt for Advanced GIS Toolset

## Task Overview

Implement the enhanced GIS toolset functionality for LandVision based on the comprehensive architecture documentation. Focus on creating user-friendly surveyor tools for developers, construction professionals, and land planning enthusiasts.

## Context

You are working with a Next.js/React/TypeScript application that provides spatial analysis and project visualization capabilities. The application currently has:

- **Existing Tools**: Basic boundary drawing (rectangle, polygon, freehand), zoning, asset placement, boolean operations
- **Current Services**: Elevation analysis, zoning validation, procedural generation, auto-save system
- **Architecture**: React components with local state management, Firebase persistence, Google Maps integration

## Implementation Priority (Phase 1)

### **1. Live Measurement System**

Implement real-time area and perimeter calculations during boundary drawing:

- **Extend [`FreehandDrawingTool`](src/components/map/map-canvas.tsx:773)** with live measurement overlay
- **Create `MeasurementOverlay`** component that follows cursor during drawing
- **Add measurement utilities** in `src/services/measurement.ts` for area/perimeter calculations
- **Support both metric and imperial units** with user preference storage
- **Display format**: "Area: 2.34 acres | Perimeter: 1,245 ft" in floating tooltip

### **2. Map Provider Switching**

Add OpenStreetMap integration for detailed street/building information:

- **Create `MapProviderManager`** component to handle base map switching
- **Extend existing [`OpenStreetMapLayer`](src/components/map/map-canvas.tsx:918)** with multiple providers
- **Add `LayerControl`** panel for user to switch between Google Satellite, OpenStreetMap, and hybrid views
- **Integrate with [`useLocalStorage`](src/hooks/use-local-storage.ts)** for provider preference persistence
- **Maintain existing Google Maps API integration** as primary provider

### **3. Basic Annotation System**

Implement text labels and dimension lines:

- **Create `AnnotationTool`** component for placing text labels on map
- **Add `DimensionTool`** for measuring distances with visual dimension lines
- **Create `AnnotationOverlay`** to render annotations on map
- **Extend project data structure** to include annotations in auto-save
- **Support basic styling**: font size, color, background, leader lines

### **4. Enhanced Tool Palette**

Reorganize and extend the existing tool palette:

- **Add measurement tools** section to [`ToolPalette`](src/components/tools/tool-palette.tsx)
- **Create annotation tools** section with text and dimension options
- **Add map layer control** button that opens layer management panel
- **Maintain existing tool organization** while adding new categories
- **Ensure tools are contextually enabled/disabled** based on project state

## Technical Requirements

### **Type Extensions**

```typescript
// Add to src/lib/types.ts
export type Tool =
  | "pan"
  | "rectangle"
  | "polygon"
  | "freehand"
  | "zone"
  | "asset"
  | "multi-select"
  | "measure"
  | "annotate"
  | "coordinate-input";

export interface Measurement {
  id: string;
  type: "distance" | "area" | "bearing";
  points: LatLng[];
  value: number;
  units: "metric" | "imperial";
  label?: string;
}

export interface Annotation {
  id: string;
  type: "text" | "dimension" | "area-label";
  position: LatLng;
  content: string;
  style: AnnotationStyle;
  attachedTo?: string;
}
```

### **State Management Integration**

- **Extend VisionPageContent state** with measurements, annotations, mapProvider
- **Integrate with existing auto-save** system to persist new data types
- **Use existing [`useLocalStorage`](src/hooks/use-local-storage.ts)** pattern for user preferences
- **Maintain existing shape management** patterns and auto-save triggers

### **Component Integration Points**

- **MapCanvas**: Add measurement and annotation overlays
- **ToolPalette**: Add new tool categories and controls
- **Header**: Add layer control button and measurement display
- **StatisticsSidebar**: Add measurement and annotation management panels

## Implementation Guidelines

### **Code Quality**

- **Follow existing patterns** in the codebase for consistency
- **Use TypeScript strictly** with proper type definitions
- **Implement proper error handling** with user-friendly messages
- **Add comprehensive JSDoc** comments for new components
- **Follow React best practices** with proper hook usage and performance optimization

### **User Experience**

- **Progressive enhancement**: Basic functionality works without advanced features
- **Responsive design**: Tools work on desktop, tablet, and mobile
- **Accessibility**: Keyboard navigation and screen reader support
- **Performance**: Smooth interactions even with large datasets
- **Visual consistency**: Match existing UI design patterns

### **Integration Requirements**

- **Preserve existing functionality**: All current features must continue working
- **Maintain auto-save integration**: New data types automatically saved
- **Follow existing state patterns**: Use same patterns as shapes for new entities
- **Respect existing architecture**: Build on current component structure

## Success Criteria

### **Phase 1 Completion**

- [ ] Live measurements display during boundary drawing
- [ ] OpenStreetMap base layer switching functional
- [ ] Basic text annotation placement working
- [ ] Dimension tool for distance measurement implemented
- [ ] All new features integrated with auto-save system
- [ ] No regression in existing functionality
- [ ] Responsive design working on all screen sizes
- [ ] Basic accessibility features implemented

### **Quality Standards**

- **TypeScript compilation**: Zero type errors
- **Performance**: No noticeable lag during drawing operations
- **Memory usage**: Efficient cleanup of measurement overlays
- **User feedback**: Clear visual and textual feedback for all operations
- **Error handling**: Graceful degradation when APIs fail

## File Structure

Create new files following existing patterns:

```
src/
├── components/
│   ├── measurement/
│   │   ├── measurement-overlay.tsx
│   │   ├── measurement-tool.tsx
│   │   └── live-measurement-display.tsx
│   ├── annotation/
│   │   ├── annotation-tool.tsx
│   │   ├── annotation-overlay.tsx
│   │   ├── annotation-editor.tsx
│   │   └── dimension-tool.tsx
│   └── map/
│       ├── map-provider-manager.tsx
│       └── layer-control.tsx
├── services/
│   ├── measurement.ts
│   ├── annotation.ts
│   └── coordinate-transformation.ts
└── hooks/
    ├── use-measurement-config.ts
    └── use-annotation-state.ts
```

## Testing Requirements

### **Unit Tests**

- **Measurement calculations**: Verify area/distance accuracy against known values
- **Coordinate transformations**: Test conversion between decimal degrees and DMS
- **Annotation lifecycle**: Test create/edit/delete operations
- **Snapping algorithms**: Validate snap-to-grid and snap-to-vertex behavior

### **Integration Tests**

- **Tool switching**: Verify seamless transitions between measurement and drawing modes
- **Auto-save integration**: Test persistence of measurements and annotations
- **Map provider switching**: Verify layer management and tile loading
- **Cross-component communication**: Test data flow between tools and overlays

## Notes for Implementation

- **Start with measurement system** as it provides immediate value and builds on existing drawing tools
- **Use existing Google Maps geometry utilities** for calculations where possible
- **Follow the established auto-save patterns** for data persistence
- **Maintain the existing component structure** and extend rather than replace
- **Test thoroughly with real-world use cases** from target user groups

The architecture provides a clear path from the current basic toolset to a comprehensive spatial analysis platform while maintaining the accessibility and user-friendliness required for the target audience.
