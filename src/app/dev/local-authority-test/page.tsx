"use client";

import React, { useState, useCallback } from "react";
import {
  APIProvider,
  Map,
  useMap,
  MapCameraChangedEvent,
} from "@vis.gl/react-google-maps";
import { LocalAuthorityLayer } from "@/components/map/local-authority-layer";
import { LayerControl } from "@/components/map/layer-control";
import { MAP_PROVIDERS } from "@/lib/map-providers";
import { MapProviderManager } from "@/components/map/map-provider-manager";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

const containerStyle = {
  width: "100%",
  height: "100vh",
};

const initialCenter = {
  lat: 54.5,
  lng: -2.5,
};

function LocalAuthorityTestMap() {
  const [viewState, setViewState] = useState({
    longitude: initialCenter.lng,
    latitude: initialCenter.lat,
    zoom: 7,
  });

  const [layerVisibility, setLayerVisibility] = useState<{
    [key: string]: boolean;
  }>({ "local-authorities": true });
  const [mapProvider, setMapProvider] = useState("google-roadmap");

  const onCameraChanged = useCallback((ev: MapCameraChangedEvent) => {
    const { center, zoom } = ev.detail;
    setViewState({
      longitude: center.lng,
      latitude: center.lat,
      zoom,
    });
  }, []);

  const onOverlayToggle = (overlayId: string, visible: boolean) => {
    setLayerVisibility((prev) => ({ ...prev, [overlayId]: visible }));
  };

  const onOpacityChange = (overlayId: string, opacity: number) => {
    // Opacity change handler to be implemented if needed
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapProviderManager
        activeProvider={mapProvider}
        onProviderChange={setMapProvider}
      >
        <Map
          center={{ lat: viewState.latitude, lng: viewState.longitude }}
          zoom={viewState.zoom}
          onCameraChanged={onCameraChanged}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
          gestureHandling="greedy"
          disableDefaultUI={true}
        >
          <LocalAuthorityLayer
            visible={layerVisibility["local-authorities"]}
            opacity={0.3}
          />
        </Map>
      </MapProviderManager>
      <div style={{ position: "absolute", top: "10px", right: "10px" }}>
        <LayerControl
          activeProvider={mapProvider}
          onProviderChange={setMapProvider}
          overlays={[
            {
              id: "local-authorities",
              name: "Local Authority Boundaries",
              visible: layerVisibility["local-authorities"],
              opacity: 0.3,
              type: "administrative",
            },
          ]}
          onOverlayToggle={onOverlayToggle}
          onOpacityChange={onOpacityChange}
        />
      </div>
    </div>
  );
}

export default function LocalAuthorityTestPage() {
  if (!API_KEY) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <h1>Google Maps API Key is missing.</h1>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <div style={containerStyle}>
        <LocalAuthorityTestMap />
      </div>
    </APIProvider>
  );
}
