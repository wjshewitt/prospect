import { NextRequest } from "next/server";

// Mapbox API configuration
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAPBOX_API_URL = "https://api.mapbox.com";

export async function GET(request: NextRequest) {
  try {
    // Extract the path parameter from the query string
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    // Validate that path is provided
    if (!path) {
      return new Response(JSON.stringify({ error: "Missing path parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate that Mapbox token is configured
    if (!MAPBOX_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Mapbox token not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Construct the full Mapbox API URL
    const mapboxUrl = `${MAPBOX_API_URL}${path}${
      path.includes("?") ? "&" : "?"
    }access_token=${MAPBOX_TOKEN}`;

    // Fetch the resource from Mapbox
    const mapboxResponse = await fetch(mapboxUrl);

    // Check if the response is successful
    if (!mapboxResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `Mapbox API error: ${mapboxResponse.status} ${mapboxResponse.statusText}`,
        }),
        {
          status: mapboxResponse.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get the content type from the Mapbox response
    const contentType =
      mapboxResponse.headers.get("content-type") || "application/octet-stream";

    // Return the response with the same content type
    return new Response(mapboxResponse.body, {
      status: mapboxResponse.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000", // Cache for 1 year
      },
    });
  } catch (error) {
    console.error("Mapbox proxy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
