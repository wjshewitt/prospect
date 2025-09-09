# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

LandVision is a Next.js application that provides land visualization and planning tools, integrating with Google Maps and offering advanced drawing capabilities. The project uses Firebase for backend services.

## Build and Development Commands

```bash
# Development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Linting and Type Checking
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## Architecture Overview

Key architectural components:

1. **Frontend Framework**: Next.js 15 with TypeScript and React 18
   - Uses App Router (src/app structure)
   - TailwindCSS for styling
   - Radix UI for component primitives

2. **Map Integration**
   - @vis.gl/react-google-maps for Google Maps integration
   - deck.gl for advanced visualization layers
   - Mapbox GL for additional mapping capabilities
   - @turf/turf for geospatial calculations

3. **AI Integration**
   - @e2b/code-interpreter for code interpretation

4. **External Services**
   - Firebase for backend services (configured in src/lib/firebase.ts)
   - Google Maps Services for location data
   - Cloud Workstation support for development

## Key Features and Implementation

1. Drawing System
   - Canvas-based drawing tools (pen, line, rectangle, circle, text)
   - Property boundary marking
   - Real-time area calculations
   
2. Map Integration
   - Synchronized zoom and pan between map and drawing canvas
   - Satellite imagery and elevation data layers
   - Property boundary visualization

3. Data Analysis
   - Acreage calculation
   - Elevation change analysis
   - Statistics generation

4. Export Capabilities
   - PDF export functionality using jspdf and html2canvas
   - Project data export

5. AI Features
   - Building placement suggestions
   - Zoning regulation compliance checking

## Configuration Files

- `next.config.ts`: Next.js configuration including environment variables and development settings
- `tsconfig.json`: TypeScript configuration with path aliases (@/* points to src/*)
- `package.json`: Project dependencies and scripts

## Important Notes

1. The project uses environment variables for API keys (configured in next.config.ts)
2. TypeScript and ESLint errors are currently ignored during builds
3. Remote image patterns are configured for placehold.co and picsum.photos
4. The codebase uses ES2017 target with modern module resolution
