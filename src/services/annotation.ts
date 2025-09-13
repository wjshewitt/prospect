import {
  Annotation,
  DimensionAnnotation,
  LatLng,
  AnnotationStyle,
} from "../lib/types";
import { uuid } from "../components/map/map-canvas";

export class AnnotationService {
  static createAnnotation(
    type: "text" | "dimension" | "area-label",
    position: LatLng,
    content: string,
    style: AnnotationStyle,
    attachedTo?: string
  ): Annotation {
    const baseAnnotation = {
      id: uuid(),
      type,
      position,
      content,
      style,
      attachedTo,
      visible: true,
    };

    return baseAnnotation as Annotation;
  }

  static createDimensionAnnotation(
    position: LatLng,
    startPoint: LatLng,
    endPoint: LatLng,
    distance: number,
    units: string,
    style: AnnotationStyle
  ): DimensionAnnotation {
    return {
      id: uuid(),
      type: "dimension",
      position,
      content: `${distance.toFixed(1)} ${units}`,
      style,
      visible: true,
      startPoint,
      endPoint,
      distance,
      units: units as any,
      offset: 10,
    };
  }

  static updateAnnotation(
    annotations: Annotation[],
    id: string,
    updates: Partial<Annotation>
  ): Annotation[] {
    return annotations.map((annotation) =>
      annotation.id === id ? { ...annotation, ...updates } : annotation
    );
  }

  static deleteAnnotation(annotations: Annotation[], id: string): Annotation[] {
    return annotations.filter((annotation) => annotation.id !== id);
  }

  static attachToShape(
    annotations: Annotation[],
    annotationId: string,
    shapeId: string
  ): Annotation[] {
    return annotations.map((annotation) =>
      annotation.id === annotationId
        ? { ...annotation, attachedTo: shapeId }
        : annotation
    );
  }
}
