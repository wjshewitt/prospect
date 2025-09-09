'use client';

import { runPythonCode } from './sandbox';

interface TerrainAnalysisResult {
    suitableAreas: number[][]; // Array of [lat, lng] coordinates for suitable building areas
    steepSlopes: number[][]; // Array of [lat, lng] coordinates for steep areas
    maxSlope: number;
    meanSlope: number;
    recommendedBuildingPads: {
        coordinates: number[];
        sizeSquareMeters: number;
    }[];
}

export async function analyzeTerrainForBuilding(
    elevationPoints: { lat: number; lng: number; elevation: number }[]
): Promise<TerrainAnalysisResult> {
    // Convert our elevation data to a format Python can easily parse
    const points = elevationPoints.map(p => [p.lat, p.lng, p.elevation]);
    
    const pythonCode = `
import numpy as np
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
import json

# Parse input points
points_data = ${JSON.stringify(points)}
points = np.array(points_data)
x, y, z = points[:, 0], points[:, 1], points[:, 2]

# Create a regular grid to interpolate the data
grid_x, grid_y = np.mgrid[
    x.min():x.max():100j,
    y.min():y.max():100j
]

# Interpolate elevation data
grid_z = griddata(points[:, :2], z, (grid_x, grid_y), method='cubic')

# Smooth the elevation data to reduce noise
grid_z = gaussian_filter(grid_z, sigma=1)

# Calculate slopes
dy, dx = np.gradient(grid_z)
slope = np.sqrt(dx**2 + dy**2)
slope_degrees = np.degrees(np.arctan(slope))

# Find areas suitable for building (slope < 15 degrees)
suitable_mask = slope_degrees < 15
steep_mask = slope_degrees > 25

# Get coordinates of suitable and steep areas
suitable_coords = []
steep_coords = []
for i in range(0, len(grid_x), 5):  # Sample every 5th point to reduce data size
    for j in range(0, len(grid_y), 5):
        if suitable_mask[i, j]:
            suitable_coords.append([float(grid_x[i, j]), float(grid_y[i, j])])
        if steep_mask[i, j]:
            steep_coords.append([float(grid_x[i, j]), float(grid_y[i, j])])

# Find potential building pads (continuous suitable areas)
from scipy import ndimage
labeled_array, num_features = ndimage.label(suitable_mask)
building_pads = []

for i in range(1, num_features + 1):
    pad_mask = labeled_array == i
    if np.sum(pad_mask) > 100:  # Min size threshold
        y_indices, x_indices = np.where(pad_mask)
        center_y = float(grid_x[int(np.mean(y_indices)), 0])
        center_x = float(grid_y[0, int(np.mean(x_indices))])
        area_sqm = np.sum(pad_mask) * ((x.max() - x.min()) / 100) * ((y.max() - y.min()) / 100)
        building_pads.append({
            "coordinates": [center_y, center_x],
            "sizeSquareMeters": float(area_sqm)
        })

result = {
    "suitableAreas": suitable_coords,
    "steepSlopes": steep_coords,
    "maxSlope": float(np.max(slope_degrees)),
    "meanSlope": float(np.mean(slope_degrees)),
    "recommendedBuildingPads": building_pads
}

print(json.dumps(result))
`;

    try {
        const execution = await runPythonCode(pythonCode);
        const result = JSON.parse(execution.logs);
        return result as TerrainAnalysisResult;
    } catch (error) {
        console.error('Error in terrain analysis:', error);
        throw new Error('Failed to analyze terrain data');
    }
}

export async function estimateExcavationVolume(
    elevationPoints: { lat: number; lng: number; elevation: number }[],
    targetElevation: number
): Promise<{ cutVolume: number; fillVolume: number }> {
    const points = elevationPoints.map(p => [p.lat, p.lng, p.elevation]);
    
    const pythonCode = `
import numpy as np
from scipy.interpolate import griddata
import json

# Parse input points
points_data = ${JSON.stringify(points)}
target_elevation = ${targetElevation}
points = np.array(points_data)
x, y, z = points[:, 0], points[:, 1], points[:, 2]

# Create a regular grid
grid_x, grid_y = np.mgrid[
    x.min():x.max():50j,
    y.min():y.max():50j
]

# Interpolate elevation data
grid_z = griddata(points[:, :2], z, (grid_x, grid_y), method='cubic')

# Calculate cell size in meters (approximate)
dx = (x.max() - x.min()) * 111000 / 50  # Convert degrees to meters
dy = (y.max() - y.min()) * 111000 * np.cos(np.mean(y) * np.pi/180) / 50

# Calculate volumes
diff = grid_z - target_elevation
cell_area = dx * dy

cut_volume = abs(np.sum(diff[diff < 0])) * cell_area
fill_volume = np.sum(diff[diff > 0]) * cell_area

result = {
    "cutVolume": float(cut_volume),
    "fillVolume": float(fill_volume)
}

print(json.dumps(result))
`;

    try {
        const execution = await runPythonCode(pythonCode);
        return JSON.parse(execution.logs);
    } catch (error) {
        console.error('Error in excavation calculation:', error);
        throw new Error('Failed to calculate excavation volumes');
    }
}
