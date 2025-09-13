# Local Authority Service

This document provides an overview of the Local Authority Service, its components, and how to use them.

## Overview

The Local Authority Service is responsible for fetching, caching, and providing an efficient interface to the UK Local Authority District dataset. It's designed to be performant, with features like viewport-based rendering, debouncing, and server-side caching.

## Components

### 1. API Endpoint (`/api/local-authorities/route.ts`)

- **`GET /api/local-authorities`**: Fetches the local authority GeoJSON data.
  - It uses a server-side cache to minimize redundant requests to the storage bucket.
  - Supports a `viewport` query parameter to return only the features visible in the given map bounds.
- **`POST /api/local-authorities/query`**: Takes a latitude and longitude and returns the containing local authority.

### 2. Client-Side Service (`local-authority-service.ts`)

- `LocalAuthorityService`: A singleton class that manages client-side data fetching and caching.
- `loadData()`: Loads the GeoJSON data from the API.
- `getFeaturesInBounds(bounds)`: Returns features within the specified map bounds.
- `findContainingAuthority(lat, lng)`: Finds the local authority for a given point.

### 3. React Component (`local-authority-layer.tsx`)

- `LocalAuthorityLayer`: A React component that renders the local authority boundaries on the Google Map.
- **Performance**:
  - Only renders features visible in the current map viewport.
  - Debounces fetching of features when the map view changes to avoid excessive API calls.
- **Props**:
  - `visible: boolean`: Toggles the visibility of the layer.
  - `opacity: number`: Controls the fill opacity of the authority polygons.
  - `onAuthorityClick`: Callback for when a local authority is clicked.
  - `onAuthorityHover`: Callback for when the mouse hovers over a local authority.

### 4. Test Page (`/app/dev/local-authority-test/page.tsx`)

A development page to test the functionality and performance of the `LocalAuthorityLayer`. It can be accessed at `/dev/local-authority-test`.

## AI Integration

The `AiSummaryPanel` component now uses the `LocalAuthorityService` to identify the local authority for a user-defined site boundary. This information is then passed to the `summarizeSite` Genkit flow, which includes the local authority context in the generated AI site assessment.

## Usage

To use the local authority layer in a map component:

1.  **Import the component**:
    ```typescript
    import { LocalAuthorityLayer } from "@/components/map/local-authority-layer";
    ```
2.  **Add it to your map**:
    ```jsx
    <Map>
      <LocalAuthorityLayer visible={true} opacity={0.3} />
    </Map>
    ```
3.  **Toggle visibility**: Control the `visible` prop to show or hide the layer, for example, through the `LayerControl` component.

## Future Enhancements

- **Advanced Spatial Indexing**: Implement a more robust client-side spatial index (e.g., using `rbush`) for even faster queries.
- **Geometry Simplification**: Re-implement geometry simplification at different zoom levels to improve rendering performance with very large and complex polygons.
- **Search Functionality**: Add the ability to search for local authorities by name and pan/zoom the map to the selected authority.
