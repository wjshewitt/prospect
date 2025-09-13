"use client";

import React from "react";
import { Annotation, DimensionAnnotation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AnnotationOverlayProps {
  annotations: Annotation[];
  onAnnotationClick: (annotation: Annotation) => void;
  onAnnotationEdit: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  annotations,
  onAnnotationClick,
  onAnnotationEdit,
  onAnnotationDelete,
}) => {
  const renderAnnotation = (annotation: Annotation) => {
    if (annotation.type === "dimension") {
      const dimAnnotation = annotation as DimensionAnnotation;
      return (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: `${annotation.position.lng}px`,
            top: `${annotation.position.lat}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Dimension line */}
          <svg
            className="absolute"
            style={{
              left: `${dimAnnotation.startPoint.lng}px`,
              top: `${dimAnnotation.startPoint.lat}px`,
              width: `${Math.abs(
                dimAnnotation.endPoint.lng - dimAnnotation.startPoint.lng
              )}px`,
              height: `${Math.abs(
                dimAnnotation.endPoint.lat - dimAnnotation.startPoint.lat
              )}px`,
            }}
          >
            <line
              x1={0}
              y1={0}
              x2={dimAnnotation.endPoint.lng - dimAnnotation.startPoint.lng}
              y2={dimAnnotation.endPoint.lat - dimAnnotation.startPoint.lat}
              stroke={annotation.style.color}
              strokeWidth="2"
              strokeDasharray={
                annotation.style.leaderLine?.style === "dashed" ? "5,5" : "none"
              }
            />
          </svg>

          {/* Dimension text */}
          <div
            className={cn(
              "bg-background/90 backdrop-blur-sm rounded px-2 py-1 text-xs border shadow-sm",
              "cursor-pointer hover:bg-background"
            )}
            style={{
              fontSize: annotation.style.fontSize,
              fontFamily: annotation.style.fontFamily,
              color: annotation.style.color,
              backgroundColor: annotation.style.backgroundColor,
            }}
            onClick={() => onAnnotationClick(annotation)}
            onDoubleClick={() => onAnnotationEdit(annotation)}
          >
            {`${dimAnnotation.distance.toFixed(1)} ${dimAnnotation.units}`}
          </div>
        </div>
      );
    }

    return (
      <div
        className="absolute pointer-events-auto"
        style={{
          left: `${annotation.position.lng}px`,
          top: `${annotation.position.lat}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className={cn(
            "bg-background/90 backdrop-blur-sm rounded px-2 py-1 border shadow-sm",
            "cursor-pointer hover:bg-background max-w-xs"
          )}
          style={{
            fontSize: annotation.style.fontSize,
            fontFamily: annotation.style.fontFamily,
            color: annotation.style.color,
            backgroundColor: annotation.style.backgroundColor,
          }}
          onClick={() => onAnnotationClick(annotation)}
          onDoubleClick={() => onAnnotationEdit(annotation)}
        >
          {annotation.content}
        </div>
      </div>
    );
  };

  return annotations
    .filter((annotation) => annotation.visible !== false)
    .map((annotation) => (
      <React.Fragment key={annotation.id}>
        {renderAnnotation(annotation)}
      </React.Fragment>
    ));
};
