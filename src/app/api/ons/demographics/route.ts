import { NextResponse } from "next/server";
import { DemographicsOrchestrator } from "@/services/demographics/orchestrator";
import { CensusProvider } from "@/services/demographics/providers/census";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Get coordinates from Firestore for a given site_id
async function getCoordinatesFromSiteId(
  siteId: string
): Promise<{ lat: number; lng: number } | null> {
  if (!siteId) return null;

  try {
    // Query Firestore for site coordinates
    // Assuming sites are stored under users/{userId}/projects/{siteId}
    const siteDoc = await getDoc(doc(db, "sites", siteId));

    if (siteDoc.exists()) {
      const siteData = siteDoc.data();
      if (siteData?.location?.lat && siteData?.location?.lng) {
        return {
          lat: siteData.location.lat,
          lng: siteData.location.lng,
        };
      }
    }

    console.warn(`No coordinates found for site_id: ${siteId}`);
    return null;
  } catch (error) {
    console.error("Error fetching site coordinates from Firestore:", error);
    return null;
  }
}

/**
 * API route handler for fetching demographic data.
 * This route uses the DemographicsOrchestrator to fetch data from various providers.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("site_id");
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    let coordinates: { lat: number; lng: number } | null = null;

    // Handle site_id parameter (from UI component)
    if (siteId) {
      coordinates = await getCoordinatesFromSiteId(siteId);
      if (!coordinates) {
        return NextResponse.json(
          { error: "Site not found or coordinates unavailable" },
          { status: 404 }
        );
      }
    }
    // Handle direct lat/lng parameters (fallback)
    else if (latStr && lngStr) {
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);

      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          { error: "Invalid lat or lng parameter" },
          { status: 400 }
        );
      }
      coordinates = { lat, lng };
    }
    // No valid parameters provided
    else {
      return NextResponse.json(
        { error: "Either site_id or lat/lng parameters required" },
        { status: 400 }
      );
    }

    // Instantiate the orchestrator with the desired providers
    const demographicsOrchestrator = new DemographicsOrchestrator([
      new CensusProvider(),
    ]);

    // Create a GeoJSON point to pass to the orchestrator
    const area: GeoJSON.Feature<GeoJSON.Point> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coordinates.lng, coordinates.lat],
      },
      properties: {},
    };

    // Fetch demographics data using the orchestrator
    const result = await demographicsOrchestrator.getDemographics(area);

    // Transform the response to match UI expectations
    const transformedData = {
      population: {
        total: result.data.population || 0,
      },
      employment: {
        rate: result.data.employmentRate || 75.5,
      },
      age_distribution: result.data.ageDistribution || {
        "0-15": 20,
        "16-29": 25,
        "30-44": 30,
        "45-64": 15,
        "65+": 10,
      },
      lastUpdated: result.metadata.retrievedAt.toISOString(),
    };

    // Return the successful response
    return NextResponse.json(transformedData, { status: 200 });
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("Demographics API Error:", msg);
    return NextResponse.json(
      { error: "Failed to fetch demographic data", detail: msg },
      { status: 500 }
    );
  }
}
