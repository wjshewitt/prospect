import { NextResponse } from "next/server";
import { DemographicsOrchestrator } from "@/services/demographics/orchestrator";
import { CensusProvider } from "@/services/demographics/providers/census";

/**
 * Test endpoint for ONS demographics API
 * Usage: /api/ons/demographics/test?lat=51.5074&lng=-0.1278
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json(
        {
          error: "Missing lat or lng parameter",
          example: "?lat=51.5074&lng=-0.1278",
        },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "Invalid lat or lng parameter" },
        { status: 400 }
      );
    }

    // Create test orchestrator with census provider
    const orchestrator = new DemographicsOrchestrator([new CensusProvider()]);

    // Create test GeoJSON point
    const testArea: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        test: true,
      },
    };

    console.log("Testing ONS demographics API with coordinates:", { lat, lng });

    // --- Temporarily modify to fetch and return dataset titles for debugging ---
    try {
      const censusProvider = new CensusProvider() as any; // Cast to access private method
      const datasets = await censusProvider.findCensusDataset(true); // Pass flag to return all

      return NextResponse.json({
        message: "Debug: Available Census Datasets",
        datasets,
      });
    } catch (debugError: any) {
      return NextResponse.json({
        error: "Failed to fetch datasets for debugging",
        detail: debugError.message,
      });
    }
    // --- End temporary modification ---
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("ONS API Test Error:", msg);

    // Provide more detailed error information for debugging
    const errorResponse = {
      error: "Failed to fetch demographic data",
      detail: msg,
      type: err?.name || "UnknownError",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
