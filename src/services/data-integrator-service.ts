// src/services/data-integrator-service.ts
"use client";

import type { Shape } from "@/lib/types";
import * as turf from "@turf/turf";
import {
  validateBuildingPlacement,
  type BuildingPlacementValidation,
} from "@/services/zoning/rules"; // Extend regulatory

interface FloodRiskData {
  riskLevel: "low" | "medium" | "high" | "very_high";
  description: string;
  percentageAffected: number;
}

interface SoilQualityData {
  soilType: string;
  quality: "good" | "moderate" | "poor";
  drainage: "well" | "moderate" | "poor";
}

interface DemographicData {
  population: number | null;
  density: number | null; // per sq km
  medianAge: number | null;
  averageIncomeGbp: number | null;
  employmentRate: number | null; // %
  educationLevels: {
    higher: number | null;
    secondary: number | null;
    none: number | null;
  } | null; // %
  housingAffordabilityIndex: number | null; // house price / income multiple
  propertyOwnershipRate: number | null; // %
  ageDistribution: {
    "0-14": number | null;
    "15-24": number | null;
    "25-44": number | null;
    "45-64": number | null;
    "65+": number | null;
  } | null; // %
  nationalAverages: {
    population: number | null;
    density: number | null;
    medianAge: number | null;
    averageIncomeGbp: number | null;
    employmentRate: number | null;
    educationHigher: number | null;
    affordabilityIndex: number | null;
    ownershipRate: number | null;
    ageDistribution: {
      "0-14": number | null;
      "15-24": number | null;
      "25-44": number | null;
      "45-64": number | null;
      "65+": number | null;
    } | null;
  };
  timestamp: string; // ISO
  source: string; // 'ONS Beta API'
  locationType: "lsoa" | "msoa" | "lad" | "region" | "country";
}

export type { DemographicData };

interface InfrastructureData {
  nearestRail: {
    name: string;
    distanceKm: number;
  } | null;
  utilities: {
    water: boolean;
    electricity: boolean;
    gas: boolean;
  };
}

interface RegulatoryData {
  greenBelt: boolean;
  planningStatus: string; // e.g., 'permitted', 'restricted', 'conservation'
  complianceScore: number; // 0-100
}

interface UkFloodData {
  data: any; // GeoJSON data
  stats: {
    high: number;
    medium: number;
    low: number;
  };
  source: string;
  timestamp: string;
}

export interface IntegratedData {
  environmental: {
    flood: FloodRiskData | null;
    soil: SoilQualityData | null;
    ukFlood: UkFloodData | null;
  };
  demographic: DemographicData | null;
  infrastructure: InfrastructureData | null;
  regulatory: RegulatoryData | null;
  errors: string[];
}

// Simple caching with localStorage
const CACHE_KEY_PREFIX = "data-integrator-";
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for location-specific data
const UK_AVERAGES_CACHE_KEY = "uk-averages";
const UK_AVERAGES_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for static UK averages

function getCacheKey(type: string, lat: number, lng: number): string {
  return `${CACHE_KEY_PREFIX}${type}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

function getCached<T>(
  key: string,
  duration: number = CACHE_DURATION
): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > duration) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function setCached(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

// Generic fetch with fallback
async function fetchApi(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, { ...options, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`API fetch failed for ${url}:`, err);
    return null;
  }
}

// Environmental: Flood Risk from Environment Agency (public API example; real needs specific endpoint/auth)
async function getFloodRisk(
  center: [number, number]
): Promise<FloodRiskData | null> {
  const [lng, lat] = center;
  const key = getCacheKey("flood", lat, lng);
  const cached = getCached<FloodRiskData>(key);
  if (cached) return cached;

  // Placeholder: Real use https://environment.data.gov.uk/hydrology/ (e.g., Flood Map API)
  // Mock based on lat/lng; in production, query with bbox or point
  const mock: FloodRiskData = {
    riskLevel: "low", // Simulate; e.g., if near river, 'medium'
    description:
      "Low risk of flooding from rivers or sea in the next 100 years.",
    percentageAffected: Math.random() * 20, // 0-20%
  };
  setCached(key, mock);
  return mock;
}

// Soil Quality from MAGIC/Defra (WFS example; mock for now)
async function getSoilQuality(
  center: [number, number]
): Promise<SoilQualityData | null> {
  const [lng, lat] = center;
  const key = getCacheKey("soil", lat, lng);
  const cached = getCached<SoilQualityData>(key);
  if (cached) return cached;

  // Real: WFS query to https://magic.defra.gov.uk/ (soilscapes)
  const mock: SoilQualityData = {
    soilType: "Loam",
    quality: "moderate",
    drainage: "moderate",
  };
  setCached(key, mock);
  return mock;
}

// Demographics from ONS (Office for National Statistics API)
async function getPostcodeFromCoords(
  center: [number, number]
): Promise<string | null> {
  const [lng, lat] = center;
  try {
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=postcode`;
    const response = await fetch(mapboxUrl);
    if (!response.ok) return null;
    const data = await response.json();
    return data.features[0]?.place_name?.split(",")[0] || null; // e.g., 'SW1A 1AA'
  } catch {
    return null;
  }
}

const UK_NATIONAL_AVERAGES = {
  population: 67000000,
  density: 281, // per km²
  medianAge: 40.1,
  averageIncomeGbp: 32000,
  employmentRate: 75.0, // %
  educationHigher: 40.0, // %
  affordabilityIndex: 8.0,
  ownershipRate: 65.0, // %
};

// Cache UK averages separately with longer duration
function getCachedUkAverages(): typeof UK_NATIONAL_AVERAGES | null {
  return getCached<typeof UK_NATIONAL_AVERAGES>(
    UK_AVERAGES_CACHE_KEY,
    UK_AVERAGES_CACHE_DURATION
  );
}

function setCachedUkAverages(data: typeof UK_NATIONAL_AVERAGES): void {
  setCached(UK_AVERAGES_CACHE_KEY, data);
}

export async function getDemographics(
  center: [number, number]
): Promise<DemographicData | null> {
  const [lng, lat] = center;
  const key = getCacheKey("demo", lat, lng);
  const cached = getCached<DemographicData>(key);
  if (cached) {
    // Only reuse cache if it originated from live ONS route
    if (cached.source === "ONS Beta API") {
      return cached;
    }
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  try {
    // Call server route that integrates ONS Beta API + postcodes.io
    const url = `/api/ons/demographics?lat=${lat}&lng=${lng}`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok && res.status !== 206) {
      return null;
    }
    const payload = await res.json();

    const demo: DemographicData = {
      population:
        typeof payload.populationTotal === "number"
          ? payload.populationTotal
          : null,
      density:
        typeof payload.populationDensityPerKm2 === "number"
          ? payload.populationDensityPerKm2
          : null,
      medianAge: null, // Not included in first pass
      averageIncomeGbp:
        typeof payload.averageIncomeGbp === "number"
          ? payload.averageIncomeGbp
          : null,
      employmentRate:
        typeof payload.employmentRate === "number"
          ? payload.employmentRate
          : null,
      educationLevels: null,
      housingAffordabilityIndex: null,
      propertyOwnershipRate: null,
      ageDistribution: null,
      nationalAverages: {
        population:
          typeof payload.nationalComparators?.populationTotal === "number"
            ? payload.nationalComparators.populationTotal
            : null,
        density:
          typeof payload.nationalComparators?.populationDensityPerKm2 ===
          "number"
            ? payload.nationalComparators.populationDensityPerKm2
            : null,
        medianAge: null,
        averageIncomeGbp:
          typeof payload.nationalComparators?.averageIncomeGbp === "number"
            ? payload.nationalComparators.averageIncomeGbp
            : null,
        employmentRate:
          typeof payload.nationalComparators?.employmentRate === "number"
            ? payload.nationalComparators.employmentRate
            : null,
        educationHigher: null,
        affordabilityIndex: null,
        ownershipRate: null,
        ageDistribution: null, // National age distribution not available from this API
      },
      timestamp: payload.lastUpdated || new Date().toISOString(),
      source: "ONS Beta API",
      locationType:
        (payload.locationType as DemographicData["locationType"]) || "region",
    };

    setCached(key, demo);
    return demo;
  } catch (err) {
    console.warn("Demographics fetch error:", err);
    return null;
  }
}

// Infrastructure: OSM Overpass for rail/utilities (proxied if needed)
async function getInfrastructure(
  center: [number, number]
): Promise<InfrastructureData | null> {
  const [lng, lat] = center;
  const key = getCacheKey("infra", lat, lng);
  const cached = getCached<InfrastructureData>(key);
  if (cached) return cached;

  // Real: Overpass API https://overpass-turbo.eu/ query for nearest railway=rail, amenity=utility
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];(node(around:5000,${lat},${lng})["railway"="station"];);out;`;
  const response = await fetchApi(overpassUrl);

  const mock: InfrastructureData = {
    nearestRail:
      response?.elements?.length > 0
        ? {
            name: response.elements[0].tags.name || "Nearest Rail Station",
            distanceKm: turf.distance(
              turf.point([lng, lat]),
              turf.point([response.elements[0].lon, response.elements[0].lat]),
              "kilometres"
            ),
          }
        : null,
    utilities: {
      water: true,
      electricity: true,
      gas: true, // Assume available in UK urban areas; real check via OSM tags
    },
  };
  setCached(key, mock);
  return mock;
}

// Regulatory: Extend existing zoning validation
function getRegulatoryData(shape: Shape): RegulatoryData {
  // Mock extension; real: Call validateBuildingPlacement with UK rules
  const ring = shape.path.map((p) => ({ lat: p.lat, lng: p.lng }));
  const validation = validateBuildingPlacement(ring, "residential", []); // Assume residential, empty zones for now

  return {
    greenBelt: false, // Simulate check
    planningStatus: validation.isValid ? "permitted" : "restricted",
    complianceScore: validation.isValid ? 85 : 40,
  };
}

export async function getIntegratedData(shape: Shape): Promise<IntegratedData> {
  const errors: string[] = [];
  const coords = shape.path.map((p) => [p.lng, p.lat]);
  console.log("Path length:", shape.path.length);
  console.log("First point:", shape.path[0]);
  console.log("Last point:", shape.path[shape.path.length - 1]);
  console.log(
    "Closed?",
    shape.path[0].lat === shape.path[shape.path.length - 1].lat &&
      shape.path[0].lng === shape.path[shape.path.length - 1].lng
  );

  if (
    shape.path[0].lat !== shape.path[shape.path.length - 1].lat ||
    shape.path[0].lng !== shape.path[shape.path.length - 1].lng
  ) {
    coords.push(coords[0]);
  }

  const polygon = turf.polygon([coords]);
  const centerCoords = turf.centroid(polygon).geometry.coordinates as [
    number,
    number
  ];

  // Bbox for UK data (expand slightly for API)
  const bbox = turf.bbox(polygon).join(",");

  const [flood, soil, demo, infra] = await Promise.allSettled([
    getFloodRisk(centerCoords),
    getSoilQuality(centerCoords),
    getDemographics(centerCoords),
    getInfrastructure(centerCoords),
  ]);

  // UK GeoAI Flood integration (live via E2B)
  let ukFlood = null;
  try {
    const floodResponse = await fetch(
      `/api/uk-geoai/flood?bbox=${bbox}&site=${encodeURIComponent(
        JSON.stringify(polygon)
      )}`
    );
    if (floodResponse.ok) {
      ukFlood = await floodResponse.json();
    }
  } catch (e) {
    errors.push("UK flood data unavailable");
  }

  const environmental = {
    flood: flood.status === "fulfilled" ? flood.value : null,
    soil: soil.status === "fulfilled" ? soil.value : null,
    ukFlood, // New UK-specific flood layer
  };
  if (flood.status === "rejected") errors.push("Flood risk data unavailable");
  if (soil.status === "rejected") errors.push("Soil quality data unavailable");

  const demographic = demo.status === "fulfilled" ? demo.value : null;
  if (demo.status === "rejected") errors.push("Demographic data unavailable");

  const infrastructure = infra.status === "fulfilled" ? infra.value : null;
  if (infra.status === "rejected")
    errors.push("Infrastructure data unavailable");

  const regulatory = getRegulatoryData(shape);

  return {
    environmental,
    demographic,
    infrastructure,
    regulatory,
    errors,
  };
}
