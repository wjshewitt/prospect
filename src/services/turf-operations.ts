
'use client';

import type { Shape } from '@/lib/types';
import * as turf from '@turf/turf';
import { uuid } from '@/components/map/map-canvas';

function shapeToTurfPolygon(shape: Shape): turf.Feature<turf.Polygon> {
    const turfPoints = shape.path.map(p => [p.lng, p.lat]);
    if (turfPoints.length > 0 && (turfPoints[0][0] !== turfPoints[turfPoints.length - 1][0] || turfPoints[0][1] !== turfPoints[turfPoints.length - 1][1])) {
        turfPoints.push(turfPoints[0]);
    }
    return turf.polygon([turfPoints]);
}

function turfPolygonToShape(
    polygon: turf.Feature<turf.Polygon | turf.MultiPolygon> | null, 
    type: Shape['type']
): Shape | null {
    if (!polygon || !polygon.geometry) return null;

    const getPathFromCoords = (coords: number[][]) => {
        const path = coords.map(p => ({ lat: p[1], lng: p[0] }));
        if (path.length > 1 && path[0].lat === path[path.length - 1].lat && path[0].lng === path[path.length - 1].lng) {
            path.pop();
        }
        return path;
    };
    
    // For now, we only handle the first polygon in a multipolygon result for simplicity
    const coordinates = polygon.geometry.type === 'Polygon'
        ? polygon.geometry.coordinates[0]
        : polygon.geometry.coordinates[0][0];

    if (!coordinates || coordinates.length === 0) return null;

    const newPath = getPathFromCoords(coordinates);
    const newArea = google.maps.geometry.spherical.computeArea(newPath);

    return {
        id: uuid(),
        type,
        path: newPath,
        area: newArea,
    };
}


export function applyUnion(shape1: Shape, shape2: Shape): Shape | null {
    const poly1 = shapeToTurfPolygon(shape1);
    const poly2 = shapeToTurfPolygon(shape2);

    const unionResult = turf.union(poly1, poly2);

    return turfPolygonToShape(unionResult, 'union');
}

export function applyDifference(minuend: Shape, subtrahend: Shape): Shape | null {
    const poly1 = shapeToTurfPolygon(minuend);
    const poly2 = shapeToTurfPolygon(subtrahend);
    
    const differenceResult = turf.difference(poly1, poly2);
    
    if (!differenceResult) {
        throw new Error('Subtraction resulted in an empty shape. The subtracted area may completely contain the original area.');
    }

    return turfPolygonToShape(differenceResult, 'difference');
}
