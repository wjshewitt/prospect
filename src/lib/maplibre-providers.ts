import { MapProvider } from "./types";

// MapLibre-compatible style definitions
export const MAPLIBRE_STYLES = {
  // Open styles that don't require API keys
  "osm-liberty": "https://raw.githubusercontent.com/maputnik/osm-liberty/main/style.json",
  "osm-bright": "https://demotiles.maplibre.org/style.json",
  "positron": "https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  "dark-matter": "https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  "voyager": "https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
} as const;

// Map provider configurations for MapLibre
export const MAPLIBRE_PROVIDERS: MapProvider[] = [
  {
    id: "osm-liberty",
    name: "OSM Liberty",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 20,
    styleUrl: MAPLIBRE_STYLES["osm-liberty"],
  },
  {
    id: "osm-bright", 
    name: "OSM Bright",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 20,
    styleUrl: MAPLIBRE_STYLES["osm-bright"],
  },
  {
    id: "positron",
    name: "CartoDB Positron",
    type: "street", 
    attribution: "© OpenStreetMap contributors, © CartoDB",
    maxZoom: 19,
    styleUrl: MAPLIBRE_STYLES["positron"],
  },
  {
    id: "dark-matter",
    name: "CartoDB Dark Matter",
    type: "street",
    attribution: "© OpenStreetMap contributors, © CartoDB", 
    maxZoom: 19,
    styleUrl: MAPLIBRE_STYLES["dark-matter"],
  },
  {
    id: "voyager",
    name: "CartoDB Voyager",
    type: "street",
    attribution: "© OpenStreetMap contributors, © CartoDB",
    maxZoom: 19,
    styleUrl: MAPLIBRE_STYLES["voyager"],
  },
  // Mapbox styles (require API key)
  {
    id: "mapbox-satellite",
    name: "Mapbox Satellite",
    type: "satellite",
    attribution: "© Mapbox, © OpenStreetMap contributors",
    maxZoom: 22,
    styleUrl: "mapbox://styles/mapbox/satellite-v9",
    requiresApiKey: true,
  },
  {
    id: "mapbox-streets",
    name: "Mapbox Streets", 
    type: "street",
    attribution: "© Mapbox, © OpenStreetMap contributors",
    maxZoom: 22,
    styleUrl: "mapbox://styles/mapbox/streets-v12",
    requiresApiKey: true,
  },
  {
    id: "mapbox-outdoors",
    name: "Mapbox Outdoors",
    type: "terrain",
    attribution: "© Mapbox, © OpenStreetMap contributors",
    maxZoom: 22,
    styleUrl: "mapbox://styles/mapbox/outdoors-v12", 
    requiresApiKey: true,
  },
];

// Default map provider (doesn't require API key)
export const DEFAULT_MAPLIBRE_PROVIDER = "osm-bright";

// Get provider by ID
export function getMapLibreProvider(id: string): MapProvider | undefined {
  return MAPLIBRE_PROVIDERS.find((provider) => provider.id === id);
}

// Get providers by type
export function getMapLibreProvidersByType(
  type: MapProvider["type"]
): MapProvider[] {
  return MAPLIBRE_PROVIDERS.filter((provider) => provider.type === type);
}

// Check if provider requires API key
export function requiresMapboxApiKey(providerId: string): boolean {
  const provider = getMapLibreProvider(providerId);
  return provider?.requiresApiKey === true;
}

// Get available providers (filter out those requiring API keys if not configured)
export function getAvailableMapLibreProviders(): MapProvider[] {
  const hasMapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  return MAPLIBRE_PROVIDERS.filter(provider => {
    if (provider.requiresApiKey && !hasMapboxToken) {
      return false;
    }
    return true;
  });
}

// Legacy compatibility - will be replaced in migration
export const MAP_PROVIDERS = MAPLIBRE_PROVIDERS;
export const DEFAULT_MAP_PROVIDER = DEFAULT_MAPLIBRE_PROVIDER;
export const getMapProvider = getMapLibreProvider;
export const getMapProvidersByType = getMapLibreProvidersByType;

// Legacy functions for migration compatibility
export function isGoogleMapsProvider(providerId: string): boolean {
  return false; // No Google Maps providers in MapLibre
}

export function requiresTileOverlay(providerId: string): boolean {
  return false; // MapLibre handles tiles natively through styles
}