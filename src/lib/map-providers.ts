import { MapProvider } from "./types";

// Map provider configurations for base layer switching
export const MAP_PROVIDERS: MapProvider[] = [
  {
    id: "google-satellite",
    name: "Google Satellite",
    type: "satellite",
    attribution: "© Google",
    maxZoom: 20,
    getTileUrl: () => "", // Handled by Google Maps API directly
  },
  {
    id: "google-roadmap",
    name: "Google Roadmap",
    type: "street",
    attribution: "© Google",
    maxZoom: 20,
    getTileUrl: () => "", // Handled by Google Maps API directly
  },
  {
    id: "google-hybrid",
    name: "Google Hybrid",
    type: "hybrid",
    attribution: "© Google",
    maxZoom: 20,
    getTileUrl: () => "", // Handled by Google Maps API directly
  },
  {
    id: "google-terrain",
    name: "Google Terrain",
    type: "terrain",
    attribution: "© Google",
    maxZoom: 20,
    getTileUrl: () => "", // Handled by Google Maps API directly
  },
  {
    id: "openstreetmap",
    name: "OpenStreetMap",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    getTileUrl: (x, y, z) =>
      `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
  {
    id: "osm-detailed",
    name: "OSM Detailed",
    type: "street",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    getTileUrl: (x, y, z) => `https://tiles.wmflabs.org/osm/${z}/${x}/${y}.png`,
  },
  {
    id: "osm-humanitarian",
    name: "OSM Humanitarian",
    type: "street",
    attribution:
      "© OpenStreetMap contributors, © Humanitarian OpenStreetMap Team",
    maxZoom: 18,
    getTileUrl: (x, y, z) =>
      `https://tile-{s}.openstreetmap.fr/hot/${z}/${x}/${y}.png`.replace(
        "{s}",
        ["a", "b", "c"][Math.floor(Math.random() * 3)]
      ),
  },
  {
    id: "cartodb-positron",
    name: "CartoDB Light",
    type: "street",
    attribution: "© OpenStreetMap contributors, © CartoDB",
    maxZoom: 19,
    getTileUrl: (x, y, z) =>
      `https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/${z}/${x}/${y}.png`.replace(
        "{s}",
        ["a", "b", "c", "d"][Math.floor(Math.random() * 4)]
      ),
  },
  {
    id: "cartodb-dark",
    name: "CartoDB Dark",
    type: "street",
    attribution: "© OpenStreetMap contributors, © CartoDB",
    maxZoom: 19,
    getTileUrl: (x, y, z) =>
      `https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/${z}/${x}/${y}.png`.replace(
        "{s}",
        ["a", "b", "c", "d"][Math.floor(Math.random() * 4)]
      ),
  },
];

// Default map provider
export const DEFAULT_MAP_PROVIDER = "google-satellite";

// Get provider by ID
export function getMapProvider(id: string): MapProvider | undefined {
  return MAP_PROVIDERS.find((provider) => provider.id === id);
}

// Get providers by type
export function getMapProvidersByType(
  type: MapProvider["type"]
): MapProvider[] {
  return MAP_PROVIDERS.filter((provider) => provider.type === type);
}

// Check if provider is Google Maps based
export function isGoogleMapsProvider(providerId: string): boolean {
  return providerId.startsWith("google-");
}

// Check if provider requires tile overlay
export function requiresTileOverlay(providerId: string): boolean {
  return !isGoogleMapsProvider(providerId);
}
