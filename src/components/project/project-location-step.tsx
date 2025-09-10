"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJsApiLoader, GoogleMap, Marker } from "@react-google-maps/api";
import {
  Search,
  MapPin,
  Navigation,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface ProjectLocationStepProps {
  onNext: (data: {
    location: string;
    coordinates: { lat: number; lng: number };
  }) => void;
  onBack: () => void;
}

const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 }; // London
const LIBRARIES: "places"[] = ["places"];

export function ProjectLocationStep({
  onNext,
  onBack,
}: ProjectLocationStepProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "new-project-gmap",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showConfirmTick, setShowConfirmTick] = useState(false);

  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autoServiceRef = useRef<google.maps.places.AutocompleteService | null>(
    null
  );
  const placeServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Initialize services when API is ready
  useEffect(() => {
    if (!isLoaded) return;
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    if (!autoServiceRef.current) {
      autoServiceRef.current = new google.maps.places.AutocompleteService();
    }
  }, [isLoaded]);

  // Debounced reverse geocoding when coordinates change
  useEffect(() => {
    if (!coords || !geocoderRef.current) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      geocoderRef.current!.geocode({ location: coords }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          setAddress(results[0].formatted_address);
          // subtle confirmation animation
          setShowConfirmTick(true);
          window.setTimeout(() => setShowConfirmTick(false), 900);
        }
      });
    }, 500);
    return () => {
      if (debounceTimerRef.current)
        window.clearTimeout(debounceTimerRef.current);
    };
  }, [coords]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // PlacesService can be bound to a Map instance for biasing results
    if (!placeServiceRef.current) {
      placeServiceRef.current = new google.maps.places.PlacesService(map);
    }
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const mapOptions = useMemo<google.maps.MapOptions>(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      styles: undefined,
    }),
    []
  );

  const requestPredictions = useCallback((text: string) => {
    if (!autoServiceRef.current || !text || text.trim().length < 2) {
      setPredictions([]);
      setHighlightedIndex(-1);
      return;
    }
    autoServiceRef.current.getPlacePredictions(
      { input: text, types: ["geocode"] },
      (res) => {
        setPredictions(res || []);
        setHighlightedIndex(res && res.length > 0 ? 0 : -1);
      }
    );
  }, []);

  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      if (!placeServiceRef.current) return;
      placeServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ["geometry.location", "formatted_address", "name"],
        },
        (place, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place?.geometry?.location
          )
            return;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setCoords({ lat, lng });
          setAddress(
            place.formatted_address || place.name || prediction.description
          );
          setPredictions([]);
          setHighlightedIndex(-1);
          mapRef.current?.panTo({ lat, lng });
          mapRef.current?.setZoom(16);
          setShowConfirmTick(true);
          window.setTimeout(() => setShowConfirmTick(false), 900);
        }
      );
    },
    []
  );

  const handleInputChange = (text: string) => {
    setAddress(text);
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(
      () => requestPredictions(text),
      250
    );
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectPrediction(predictions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setPredictions([]);
      setHighlightedIndex(-1);
    }
  };

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setCoords({ lat, lng });
  }, []);

  const handleUseMyLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        const next = { lat: latitude, lng: longitude };
        setCoords(next);
        mapRef.current?.panTo(next);
        mapRef.current?.setZoom(16);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            "Permission denied. Enable location access to use this feature."
          );
        } else {
          setGeoError("Unable to retrieve your location right now.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleRetryScript = () => {
    window.location.reload();
  };

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore copy failures silently
    }
  };

  const handleNext = () => {
    if (address && coords) {
      onNext({ location: address, coordinates: coords });
    }
  };

  // Fallback: missing key
  if (!apiKey) {
    return (
      <div className="space-y-4">
        <Label>Project Location</Label>
        <div className="rounded-xl border p-4 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Google Maps API key not configured</p>
            <p className="text-sm opacity-80">
              Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment, then
              reload.
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled>Next</Button>
        </div>
      </div>
    );
  }

  // Offline message
  if (!isOnline) {
    return (
      <div className="space-y-4">
        <Label>Project Location</Label>
        <div className="rounded-xl border p-4 bg-muted flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">You are offline</p>
            <p className="text-sm opacity-80">
              Reconnect to the internet to search and confirm a location.
            </p>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled>Next</Button>
        </div>
      </div>
    );
  }

  // Script load error
  if (loadError) {
    return (
      <div className="space-y-4">
        <Label>Project Location</Label>
        <div className="rounded-xl border p-4 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Map failed to initialize</p>
            <p className="text-sm opacity-80">
              Check your API key, billing, and allowed referrers in Google Cloud
              Console.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetryScript}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled>Next</Button>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (!isLoaded) {
    return (
      <div className="space-y-4">
        <Label>Project Location</Label>
        <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
        <div className="h-64 w-full rounded-xl border overflow-hidden">
          <div className="w-full h-full bg-muted animate-pulse" />
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled>Next</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="location">Project Location</Label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div className="relative">
            <Input
              id="location"
              value={address}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search an address or place..."
              className="pl-10 rounded-lg"
              aria-label="Search address"
              autoComplete="off"
            />
            {predictions.length > 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-lg border bg-popover shadow-md overflow-hidden">
                <ul
                  role="listbox"
                  aria-label="Place suggestions"
                  className="max-h-64 overflow-auto"
                >
                  {predictions.map((p, idx) => (
                    <li key={p.place_id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={idx === highlightedIndex}
                        onClick={() => selectPrediction(p)}
                        className={`w-full text-left px-3 py-2 transition ${
                          idx === highlightedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {p.description}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Address preview chip */}
        {address && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs shadow-sm">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[52ch] truncate">{address}</span>
            <button
              type="button"
              onClick={copyAddress}
              aria-label="Copy address"
              className="ml-1 text-muted-foreground hover:text-foreground transition"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Select location on map</Label>
        <div className="relative h-64 w-full rounded-xl border overflow-hidden bg-muted">
          <GoogleMap
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
            center={coords || DEFAULT_CENTER}
            zoom={coords ? 16 : 10}
            mapContainerStyle={{ width: "100%", height: "100%" }}
            options={mapOptions}
          >
            {coords && (
              <Marker
                position={coords}
                draggable
                onDragEnd={handleMarkerDragEnd}
                animation={google.maps.Animation.DROP}
              />
            )}
          </GoogleMap>

          {/* Floating controls */}
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute right-3 top-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleUseMyLocation}
                aria-label="Use my current location"
                className="rounded-full backdrop-blur bg-background/80 hover:shadow-md transition-shadow"
              >
                <Navigation
                  className={`mr-2 h-4 w-4 ${geoLoading ? "animate-spin" : ""}`}
                />
                {geoLoading ? "Locating..." : "Use my location"}
              </Button>
            </div>
            {/* Subtle celebratory tick */}
            {showConfirmTick && (
              <div className="absolute left-1/2 top-3 -translate-x-1/2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 animate-[scaleIn_300ms_ease-out]" />
              </div>
            )}
          </div>
        </div>

        {geoError && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">
            {geoError}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {coords && address && (
            <CheckCircle2
              className="h-4 w-4 text-emerald-500 animate-pulse"
              aria-hidden
            />
          )}
          <Button
            onClick={handleNext}
            disabled={!coords || !address}
            className="relative overflow-hidden"
          >
            <span className="relative z-10">Next</span>
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scaleIn {
          from {
            transform: scale(0.8);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
