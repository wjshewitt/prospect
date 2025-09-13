import { NextRequest, NextResponse } from "next/server";
import * as turf from "@turf/turf";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get("bbox"); // Format: minLng,minLat,maxLng,maxLat
  const siteGeoJson = searchParams.get("site"); // Optional site polygon GeoJSON

  if (!bbox) {
    return NextResponse.json({ error: "Bbox required" }, { status: 400 });
  }

  const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);

  try {
    // Use center point of bbox for lat/long query
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Live fetch from Environment Agency Flood Monitoring API
    const apiUrl = `https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${centerLat}&long=${centerLng}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FloodAPI/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    if (!response.ok) {
      throw new Error(`EA API error: ${response.status}`);
    }

    const floodData = await response.json();

    // Convert EA API response to GeoJSON format
    const features =
      floodData.items?.map((item: any) => ({
        type: "Feature",
        properties: {
          id: item.fwdCode,
          label: item.label,
          description: item.description,
          county: item.county,
          eaAreaName: item.eaAreaName,
          risk: item.severityLevel || "unknown",
        },
        geometry: {
          type: "Point", // EA API doesn't provide geometry, so we use center point
          coordinates: [centerLng, centerLat],
        },
      })) || [];

    let processedData = {
      type: "FeatureCollection",
      features: features,
    };

    // Process: Filter by site if provided (simplified since we don't have actual geometries)
    if (siteGeoJson && features.length > 0) {
      // For now, just return the features as they're already filtered by location
      processedData = {
        type: "FeatureCollection",
        features: features,
      };
    }

    // Add risk stats based on available data
    const riskLevels = {
      high: features.filter(
        (f: any) =>
          f.properties.risk === "high" || f.properties.risk === "severe"
      ).length,
      medium: features.filter(
        (f: any) =>
          f.properties.risk === "medium" || f.properties.risk === "warning"
      ).length,
      low: features.filter(
        (f: any) => f.properties.risk === "low" || f.properties.risk === "alert"
      ).length,
    };

    return NextResponse.json({
      data: processedData,
      stats: riskLevels,
      source: "Environment Agency Flood Monitoring API (UK)",
      timestamp: new Date().toISOString(),
      totalAreas: features.length,
    });
  } catch (error: any) {
    console.error("Flood data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch UK flood data", details: error.message },
      { status: 500 }
    );
  }
}
