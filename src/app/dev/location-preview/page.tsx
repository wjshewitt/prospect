"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ProjectLocationStep } from "@/components/project/project-location-step";
import { AlertCircle } from "lucide-react";

export default function LocationPreviewPage() {
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const isProd = process.env.NODE_ENV === "production";

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Location Step Preview (Dev)
          </h1>
          <a
            className="text-sm underline text-muted-foreground hover:text-foreground"
            href="/welcome"
          >
            Back to Welcome
          </a>
        </header>

        {isProd ? (
          <div className="rounded-xl border p-4 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-100 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Preview disabled in production</p>
              <p className="text-sm opacity-80">
                This route is available only during development for validating
                the Location step locally.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border p-4">
              <ProjectLocationStep
                onBack={() => window.history.back()}
                onNext={(data) => {
                  setLocation(data.location);
                  setLat(data.coordinates.lat);
                  setLng(data.coordinates.lng);
                }}
              />
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <h2 className="text-lg font-semibold">Form State</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="preview-location">Address</Label>
                  <Input id="preview-location" value={location} readOnly />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preview-lat">Latitude</Label>
                  <Input id="preview-lat" value={lat ?? ""} readOnly />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="preview-lng">Longitude</Label>
                  <Input id="preview-lng" value={lng ?? ""} readOnly />
                </div>
              </div>
              <div className="pt-2">
                <Button
                  disabled={!location || lat == null || lng == null}
                  onClick={() =>
                    alert("Values captured. Integrates with create flow.")
                  }
                >
                  Simulate Continue
                </Button>
              </div>
            </div>

            <div className="rounded-xl border p-4 text-sm text-muted-foreground">
              Tip: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local and ensure
              your Google Cloud Console API Key has HTTP referrer restrictions
              for your local dev origin (e.g., http://localhost:3000/*).
            </div>
          </>
        )}
      </div>
    </div>
  );
}
