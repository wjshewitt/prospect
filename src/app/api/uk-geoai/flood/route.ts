import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bbox = searchParams.get("bbox"); // minLng,minLat,maxLng,maxLat
  const siteGeoJson = searchParams.get("site"); // Optional site polygon GeoJSON

  if (!bbox) {
    return NextResponse.json({ error: "Bbox required" }, { status: 400 });
  }

  try {
    // Try local Docker flood service first
    try {
      const baseUrl = process.env.FLOOD_SERVICE_URL || "http://localhost:5000";
      const floodUrl = `${baseUrl}/flood?bbox=${bbox}${
        siteGeoJson ? `&site=${encodeURIComponent(siteGeoJson)}` : ""
      }`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(floodUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        const output = await response.json();
        return NextResponse.json(output);
      }
      throw new Error("Local service returned non-OK status");
    } catch (localError: any) {
      console.warn("Local flood service failed:", localError.message);

      // Fallback to working uk-data/flood API
      const fallbackUrl = new URL(
        `${request.nextUrl.origin}/api/uk-data/flood`
      );
      fallbackUrl.searchParams.set("bbox", bbox);
      if (siteGeoJson) {
        fallbackUrl.searchParams.set("site", siteGeoJson);
      }

      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(
        () => fallbackController.abort(),
        10000
      );

      const fallbackResponse = await fetch(fallbackUrl.toString(), {
        method: "GET",
        signal: fallbackController.signal,
      });

      clearTimeout(fallbackTimeoutId);

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback API error: ${fallbackResponse.status}`);
      }

      const fallbackData = await fallbackResponse.json();
      return NextResponse.json(fallbackData);
    }
  } catch (error: any) {
    console.error("UK Flood processing error:", error);
    return NextResponse.json(
      {
        error: "Failed to process UK flood data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
