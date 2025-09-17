# Prospect - WIP

Prospect is a land visualization and planning tool built with Next.js, Firebase, and Google Maps APIs. It provides advanced GIS features for analszing, measuring, and annotating land parcels, with a focus on UK local authority datasets and flood risk data integration.

## Key Features

- **Interactive Land Visualization:** Draw, measure, and annotate directly on maps using advanced drawing tools.
- **GIS Toolset:** Live measurement system, annotation, responsive design, map provider switching, and tool palette organization.
- **UK Local Authority Service:** Efficiently fetches, caches, and renders UK Local Authority District data. Includes viewport-based rendering, debouncing, and server-side caching.
- **Flood Risk Data Integration:** Containerized Python service fetches flood risk information from the Environment Agency API.
- **Auto-Save & Performance Optimizations:** Debounced calculations at 60fps, lazy loading, efficient rendering, memory management, and viewport culling.
- **Accessibility:** Keyboard shortcuts and accessible UI features.
- **Google Maps Integration:** Uses @react-google-maps/api for seamless location selection and project creation.

## Architecture Overview

- **Frontend:** Next.js (TypeScript), React, Firebase for authentication and data storage.
- **Backend:** Firebase, external APIs (e.g., Environment Agency Flood Risk, OSM Overpass).
- **Services:** Modular services for local authorities, demographics, zoning, and geometry.
- **Flood Service:** Python containerized microservice for processing UK flood data.
- **Spatial Indexing:** Client-side spatial index (future enhancement: robust indexing with `rbush`).

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/wjshewitt/prospect.git
   cd prospect
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Configure API keys in `next.config.ts` as needed for Google Maps and Firebase.

4. **Development server (with Turbopack):**
   ```bash
   npm run dev
   ```

5. **Build and start production:**
   ```bash
   npm run build
   npm run start
   ```

6. **Lint and typecheck:**
   ```bash
   npm run lint
   npm run typecheck
   ```

## Directory Structure

- `src/app/`: Main application pages and layout.
- `src/services/`: Modular service logic (local authority, demographics, geometry, zoning, etc.).
- `docs/`: Documentation for specialized services (e.g., flood-service).
- `.idx/`: Nix workspace configuration for development environments.

## Configuration Notes

- TypeScript and ESLint errors are ignored during builds (see `next.config.ts`).
- Remote image patterns configured for placehold.co and picsum.photos.
- ES2017 target with modern module resolution.

## Future Enhancements

- Advanced spatial indexing with `rbush` for faster queries.
- Geometry simplification at different zoom levels for scalable rendering.
- Search functionality for local authorities by name and map navigation.

## License

MIT

---

Maintained by [@wjshewitt](https://github.com/wjshewitt).
