# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Google Maps Setup for Project Creation (Location Step)

The New Project flow uses Google Maps (via @react-google-maps/api) for the Location step. Follow these steps to enable maps locally and in production.

### 1) Enable APIs in Google Cloud Console

Enable the following APIs in your Google Cloud project:

- Maps JavaScript API
- Places API
- Geocoding API (optional but recommended for reverse geocoding of the marker position)

### 2) Create and Restrict an API Key

Create a browser API key and restrict it to HTTP referrers:

- Local development:
  - http://localhost:3000/\*
  - http://127.0.0.1:3000/*
- Production (examples):
  - https://your-domain.com/*
  - https://www.your-domain.com/*

Under API restrictions, allow only:

- Maps JavaScript API
- Places API
- Geocoding API (if using reverse geocoding)

### 3) Configure Environment Variable

Add the API key to your .env.local file (do NOT commit the actual key to source control):

```
# .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_BROWSER_API_KEY
```

Restart the Next.js dev server after adding/updating env vars.

### 4) Development Preview Route

A development-only preview route exists to test the Location step without auth:

- Route: /dev/location-preview
- This page is automatically disabled in production builds.
- It allows you to:
  - Search for a place (Places Autocomplete)
  - Drag a marker and see reverse-geocoded address updates
  - Use the browser Geolocation API via a “Use my location” control
  - Copy the resolved address

If you don’t see the map:

- Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set
- Confirm the key referrers include your local origin
- Verify the APIs are enabled and billing is configured in Cloud Console

### 5) Production Notes

- The Location step is integrated into the Create New Project modal and is used both on the empty state and when projects exist.
- The map initializes client-side using @react-google-maps/api with useJsApiLoader and requests only the “places” library.
- The component provides safe fallbacks:
  - Missing API key message
  - Script load error with retry
  - Offline/denied geolocation messages
  - Loading skeleton while script initializes

### Troubleshooting

- Blank map or “gray” tiles:
  - Check that the referrer restriction matches your current origin exactly
  - Verify the Maps JavaScript API is enabled
  - Confirm billing is active on the Cloud project
- “ApiNotActivatedMapError”:
  - Enable Maps JavaScript API for your key
- “RefererNotAllowedMapError”:
  - Add your origin to HTTP referrers and wait a few minutes for changes to propagate
- Geolocation errors:
  - Ensure your browser has permission to use location
  - Some browsers require HTTPS for geolocation; localhost is typically allowed

### Security

- Use a browser API key restricted by HTTP referrer.
- Do not embed server-side or unrestricted keys in the client.

## Enhanced GIS Toolset Features

### Live Measurement System

The enhanced GIS toolset includes a live measurement system that displays real-time area and perimeter calculations during drawing operations:

- **Usage**: Select any drawing tool (rectangle, polygon, freehand) and draw a shape
- **Display**: A floating overlay shows area and perimeter measurements as you draw
- **Configuration**: Access measurement settings through the tool palette settings menu to:
  - Toggle between metric and imperial units
  - Adjust decimal precision
  - Show/hide area and perimeter values

### Map Provider Switching

Switch between different map providers for varied visualization options:

- **Usage**: Open the layer control panel (top-right corner of map)
- **Providers**:
  - Google Satellite (default)
  - OpenStreetMap
- **Persistence**: Your map provider preference is saved between sessions

### Annotation System

Add text labels and dimension lines to your maps:

- **Text Annotations**:
  - Select the "Text" tool from the annotation category in the tool palette
  - Click on the map to place a text annotation
  - Edit the text content in the popup editor
- **Dimension Annotations**:
  - Select the "Dimension" tool from the annotation category
  - Click the first point of your measurement
  - Click the second point to create a dimension line with distance
- **Area Labels**:
  - Select the "Area Label" tool from the annotation category
  - Click on a shape to automatically label it with its area measurement

### Tool Palette Organization

The tool palette has been reorganized into logical categories:

- **Drawing Tools**: Rectangle, polygon, freehand, zone
- **Measurement Tools**: Live measurement display
- **Annotation Tools**: Text, dimension, area label
- **Layer Control**: Access map provider and overlay settings

### Auto-Save Integration

All new data types are automatically saved:

- Measurement configuration preferences
- Map provider selection
- Layer visibility settings
- Annotations
- The system automatically saves your work every few minutes and when you explicitly save

### Responsive Design

The enhanced toolset is fully responsive:

- Tool palette adapts to different screen sizes
- Layer control panel is optimized for mobile and tablet
- Measurement overlay adjusts position for better visibility on smaller screens

### Accessibility Features

The enhanced toolset includes comprehensive accessibility support:

- **Keyboard Navigation**: Full keyboard support throughout the interface
  - Use Tab to navigate between tools and controls
  - Press Escape to close dialogs and cancel operations
  - Arrow keys for navigating dropdown menus and sliders
- **Screen Reader Support**: ARIA labels and live regions for assistive technology
  - Live measurement announcements during drawing operations
  - Descriptive labels for all interactive elements
  - Status updates for tool state changes
- **High Contrast**: All UI elements meet WCAG contrast requirements
- **Focus Management**: Clear focus indicators and logical tab order
- **Touch Support**: Optimized for touch devices with appropriate target sizes

### Keyboard Shortcuts

- **Escape**: Cancel current operation or close dialogs
- **Ctrl+Click** (or **Cmd+Click** on Mac): Multi-select shapes
- **Tab**: Navigate between interface elements
- **Enter/Space**: Activate buttons and controls

### Performance Optimizations

The enhanced toolset includes several performance optimizations:

- **Debounced Calculations**: Live measurements update at 60fps without performance impact
- **Lazy Loading**: Components load only when needed
- **Efficient Rendering**: Optimized re-rendering with React.memo and useMemo
- **Memory Management**: Automatic cleanup of unused map elements
- **Viewport Culling**: Only renders visible annotations and measurements
