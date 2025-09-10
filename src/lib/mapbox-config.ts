import mapboxgl from "mapbox-gl";

// Set your Mapbox token here
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export function isMapboxConfigured() {
  return MAPBOX_TOKEN && MAPBOX_TOKEN.length > 0;
}

export { mapboxgl };
