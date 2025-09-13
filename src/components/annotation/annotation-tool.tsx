"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { Annotation, DimensionAnnotation, LatLng, Shape } from "@/lib/types";
import { AnnotationService } from "@/services/annotation";
import { MeasurementService } from "@/services/measurement";
import { AnnotationEditor } from "./annotation-editor";
import { Button } from "@/components/ui/button";

interface AnnotationToolProps {
  mode: "text" | "dimension" | "area-label" | "none";
  onAnnotationCreate: (annotation: Annotation) => void;
  selectedShapes: Shape[];
  onFinish: () => void;
}

export const AnnotationTool: React.FC<AnnotationToolProps> = ({
  mode,
  onAnnotationCreate,
  selectedShapes,
  onFinish,
}) => {
  const map = useMap();
  const [isPlacing, setIsPlacing] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] =
    useState<Partial<Annotation> | null>(null);
  const [dimensionStartPoint, setDimensionStartPoint] = useState<LatLng | null>(
    null
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || mode === "none") return;

      const position = e.latLng.toJSON();

      if (mode === "text") {
        setPendingAnnotation({
          type: "text",
          position,
          content: "",
          style: {
            fontSize: 14,
            fontFamily: "sans-serif",
            color: "#000000",
            backgroundColor: "#ffffff",
          },
        });
        setIsPlacing(true);
      } else if (mode === "dimension") {
        if (!dimensionStartPoint) {
          setDimensionStartPoint(position);
        } else {
          const distance = MeasurementService.calculateDistance(
            dimensionStartPoint,
            position
          );

          const dimensionAnnotation =
            AnnotationService.createDimensionAnnotation(
              {
                lat: (dimensionStartPoint.lat + position.lat) / 2,
                lng: (dimensionStartPoint.lng + position.lng) / 2,
              },
              dimensionStartPoint,
              position,
              distance,
              "feet",
              {
                fontSize: 12,
                fontFamily: "monospace",
                color: "#000000",
                backgroundColor: "#ffffff",
                leaderLine: {
                  enabled: true,
                  style: "solid",
                  color: "#000000",
                },
              }
            );

          onAnnotationCreate(dimensionAnnotation);
          setDimensionStartPoint(null);
        }
      } else if (mode === "area-label" && selectedShapes.length > 0) {
        const shape = selectedShapes[0];
        const area = shape.area || 0;
        const formattedArea = MeasurementService.formatArea(
          area,
          "imperial",
          2
        );

        onAnnotationCreate(
          AnnotationService.createAnnotation(
            "area-label",
            position,
            formattedArea,
            {
              fontSize: 16,
              fontFamily: "sans-serif",
              color: "#000000",
              backgroundColor: "#ffffff",
            },
            shape.id
          )
        );
      }
    },
    [
      map,
      mode,
      selectedShapes,
      onAnnotationCreate,
      dimensionStartPoint,
      setDimensionStartPoint,
    ]
  );

  useEffect(() => {
    if (!map || mode === "none") return;
    const clickListener = map.addListener("click", handleMapClick);
    return () => clickListener.remove();
  }, [map, handleMapClick, mode]);

  const handleSaveAnnotation = (annotation: Annotation) => {
    onAnnotationCreate(annotation);
    setPendingAnnotation(null);
    setIsPlacing(false);
  };

  const handleCancelAnnotation = () => {
    setPendingAnnotation(null);
    setIsPlacing(false);
    onFinish();
  };

  return (
    <>
      {isPlacing && pendingAnnotation && pendingAnnotation.type === "text" && (
        <AnnotationEditor
          annotation={pendingAnnotation as Partial<Annotation>}
          onSave={handleSaveAnnotation}
          onCancel={handleCancelAnnotation}
        />
      )}
      {dimensionStartPoint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background p-2 rounded-md shadow-lg z-10">
          <p className="text-sm">Select the second point for the dimension.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDimensionStartPoint(null)}
          >
            Cancel
          </Button>
        </div>
      )}
    </>
  );
};
