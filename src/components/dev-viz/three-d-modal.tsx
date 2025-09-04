'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Orbit, MousePointer, X, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Earcut } from 'three/src/extras/Earcut';

// Helper to calculate the center of a polygon
const getPolygonCenter = (path: LatLng[]): LatLng => {
  if (!window.google || !window.google.maps) {
    return path[0] || { lat: 0, lng: 0 };
  }
  const bounds = new google.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  return bounds.getCenter().toJSON();
};

// Compass component
const Compass = ({ camera }: { camera: THREE.Camera | null }) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!camera) return;

    const updateCompass = () => {
      const vector = new THREE.Vector3();
      camera.getWorldDirection(vector);
      const angle = Math.atan2(vector.x, vector.z);
      setRotation(angle);
    };

    const controls = (camera as any)._controls;
    if (controls && controls.addEventListener) {
      controls.addEventListener('change', updateCompass);
      updateCompass();
      return () => controls.removeEventListener('change', updateCompass);
    }
  }, [camera]);

  return (
    <div className="absolute top-4 right-4 w-16 h-16 bg-background/50 rounded-full flex items-center justify-center text-foreground backdrop-blur-sm shadow-lg pointer-events-none">
      <div
        className="relative w-full h-full transition-transform"
        style={{ transform: `rotate(${-rotation}rad)` }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 font-bold text-lg">N</div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm">S</div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-sm">W</div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">E</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp className="w-6 h-6 text-red-500" />
      </div>
    </div>
  );
};

// Elevation stats display
const ElevationStats = ({ min, max, range }: { min: number; max: number; range: number }) => (
  <div className="absolute bottom-4 left-4 bg-background/80 p-3 rounded-md shadow-lg text-foreground text-sm">
    <div className="font-semibold mb-1">Elevation</div>
    <div className="space-y-0.5 text-xs">
      <div>Min: {min.toFixed(1)}m</div>
      <div>Max: {max.toFixed(1)}m</div>
      <div>Range: {range.toFixed(1)}m</div>
    </div>
  </div>
);

interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

export function ThreeDVisualizationModal({ 
  assets, 
  zones, 
  boundary, 
  elevationGrid, 
  onDeleteAsset 
}: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);
  const [elevationStats, setElevationStats] = useState({ min: 0, max: 0, range: 0 });
  const [terrainQuality, setTerrainQuality] = useState<'low' | 'medium' | 'high'>('medium');

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAsset) {
      onDeleteAsset(selectedAsset.shape.id);
      setSelectedAsset(null);
    }
  }, [selectedAsset, onDeleteAsset]);
  
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;
    let animationFrameId: number;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0008);

    const camera = new THREE.PerspectiveCamera(
      65, 
      mountNode.clientWidth / mountNode.clientHeight, 
      0.1, 
      10000
    );
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true, // Better depth precision for large terrains
    });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;
    mountNode.appendChild(renderer.domElement);

    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF8DC, 1.8);
    sunLight.position.set(150, 300, 100);
    sunLight.castShadow = true;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1000;
    sunLight.shadow.camera.top = 400;
    sunLight.shadow.camera.bottom = -400;
    sunLight.shadow.camera.left = -400;
    sunLight.shadow.camera.right = 400;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x4F2E14, 0.3);
    scene.add(hemiLight);

    // Add fill light to reduce harsh shadows
    const fillLight = new THREE.DirectionalLight(0xFFFFFF, 0.3);
    fillLight.position.set(-100, 200, -50);
    scene.add(fillLight);

    // Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = false;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 1000;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    (camera as any)._controls = orbitControls;

    // Raycasting for selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectableMeshes: THREE.Mesh[] = [];

    const onMouseClick = (event: MouseEvent) => {
      if (!renderer.domElement.parentElement?.contains(event.target as Node)) {
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(selectableMeshes);

      if (intersects.length > 0) {
        const firstIntersect = intersects[0].object;
        if (firstIntersect instanceof THREE.Mesh) {
          const shape = (firstIntersect.userData as {shape: Shape}).shape;
          setSelectedAsset({mesh: firstIntersect, shape});
        }
      } else {
        setSelectedAsset(null);
      }
    };
    mountNode.addEventListener('click', onMouseClick);

    // Main geo group
    const geoGroup = new THREE.Group();
    geoGroup.rotation.x = -Math.PI / 2;
    scene.add(geoGroup);

    // Coordinate System & Projections
    const siteCenter = getPolygonCenter(boundary.path);
    const R_EARTH = 6371e3; // meters
    const COS_LAT = Math.cos(siteCenter.lat * Math.PI / 180);

    const proj = {
      toLocal: (p: LatLng) => {
        const dLat = (p.lat - siteCenter.lat) * Math.PI / 180;
        const dLng = (p.lng - siteCenter.lng) * Math.PI / 180;
        const x = dLng * R_EARTH * COS_LAT;
        const y = dLat * R_EARTH; // Fixed: removed negative sign
        return { x, y };
      },
      xyToLL: (x: number, y: number): LatLng => {
        const dLat = y / R_EARTH; // Fixed: removed negative sign
        const dLng = x / (R_EARTH * COS_LAT);
        return {
          lat: siteCenter.lat + dLat * 180 / Math.PI,
          lng: siteCenter.lng + dLng * 180 / Math.PI,
        };
      },
    };

    // Enhanced Elevation Data Processing
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;

    // Calculate elevation statistics
    let minElev = Infinity, maxElev = -Infinity;
    for (let i = 0; i < grid.length; i++) {
      if (isFinite(grid[i])) {
        minElev = Math.min(minElev, grid[i]);
        maxElev = Math.max(maxElev, grid[i]);
      }
    }
    const elevRange = maxElev - minElev;
    setElevationStats({ min: minElev, max: maxElev, range: elevRange });

    // Enhanced elevation getter with bicubic interpolation
    const getElevationAt = (x: number, y: number): number => {
      if (!grid || nx < 2 || ny < 2) return minElev;
      
      const u = ((x - minX) / (maxX - minX)) * (nx - 1);
      const v = ((y - minY) / (maxY - minY)) * (ny - 1); // Fixed: removed inversion
      
      const i = Math.floor(u);
      const j = Math.floor(v);

      if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) {
        // Extrapolate for points outside grid
        const clampedI = Math.max(0, Math.min(nx - 1, Math.round(u)));
        const clampedJ = Math.max(0, Math.min(ny - 1, Math.round(v)));
        return grid[clampedJ * nx + clampedI] || minElev;
      }

      // Bilinear interpolation
      const s = u - i;
      const t = v - j;

      const z00 = grid[j * nx + i] || minElev;
      const z10 = grid[j * nx + i + 1] || minElev;
      const z01 = grid[(j + 1) * nx + i] || minElev;
      const z11 = grid[(j + 1) * nx + i + 1] || minElev;

      const z0 = z00 * (1 - s) + z10 * s;
      const z1 = z01 * (1 - s) + z11 * s;

      return z0 * (1 - t) + z1 * t;
    };

    // Create high-resolution terrain mesh
    const boundaryPoints = boundary.path.map(p => proj.toLocal(p));
    
    // Calculate boundary bounds
    let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
    boundaryPoints.forEach(p => {
      bMinX = Math.min(bMinX, p.x);
      bMaxX = Math.max(bMaxX, p.x);
      bMinY = Math.min(bMinY, p.y);
      bMaxY = Math.max(bMaxY, p.y);
    });

    // Create dense grid for terrain mesh
    const gridResolution = terrainQuality === 'high' ? 100 : terrainQuality === 'medium' ? 50 : 25;
    const gridWidth = Math.ceil((bMaxX - bMinX) / 2) * 2; // Ensure even number
    const gridHeight = Math.ceil((bMaxY - bMinY) / 2) * 2;
    const segmentsX = Math.max(10, Math.min(gridResolution, gridWidth));
    const segmentsY = Math.max(10, Math.min(gridResolution, gridHeight));

    // Create plane geometry with proper resolution
    const terrainGeometry = new THREE.PlaneGeometry(
      gridWidth,
      gridHeight,
      segmentsX,
      segmentsY
    );

    // Apply elevation to vertices
    const positions = terrainGeometry.attributes.position;
    const vertices = [];
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + (bMinX + bMaxX) / 2;
      const y = positions.getY(i) + (bMinY + bMaxY) / 2;
      const z = getElevationAt(x, y);
      
      positions.setZ(i, z);
      vertices.push(new THREE.Vector3(x, y, z));
    }

    // Smooth terrain by averaging nearby vertices
    const smoothingPasses = 2;
    for (let pass = 0; pass < smoothingPasses; pass++) {
      const newZ = new Float32Array(positions.count);
      
      for (let i = 0; i < segmentsY + 1; i++) {
        for (let j = 0; j < segmentsX + 1; j++) {
          const idx = i * (segmentsX + 1) + j;
          let sumZ = positions.getZ(idx);
          let count = 1;
          
          // Average with neighbors
          const neighbors = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
          ];
          
          for (const [di, dj] of neighbors) {
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni <= segmentsY && nj >= 0 && nj <= segmentsX) {
              const nIdx = ni * (segmentsX + 1) + nj;
              sumZ += positions.getZ(nIdx);
              count++;
            }
          }
          
          newZ[idx] = sumZ / count;
        }
      }
      
      for (let i = 0; i < positions.count; i++) {
        positions.setZ(i, newZ[i]);
      }
    }

    // Recompute normals for smooth shading
    terrainGeometry.computeVertexNormals();
    terrainGeometry.attributes.position.needsUpdate = true;

    // Create terrain material with vertex colors based on elevation
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i);
      const normalizedHeight = (z - minElev) / (elevRange || 1);
      
      // Gradient from green (low) to brown (high)
      const lowColor = new THREE.Color(0x2D5016);
      const midColor = new THREE.Color(0x8B7355);
      const highColor = new THREE.Color(0xD2B48C);
      
      let color;
      if (normalizedHeight < 0.5) {
        color = lowColor.clone().lerp(midColor, normalizedHeight * 2);
      } else {
        color = midColor.clone().lerp(highColor, (normalizedHeight - 0.5) * 2);
      }
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create terrain material
    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.position.set((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2, 0);
    geoGroup.add(terrainMesh);

    // Clip terrain to boundary (visual mask)
    const boundaryShape = new THREE.Shape();
    boundaryPoints.forEach((p, i) => {
      if (i === 0) boundaryShape.moveTo(p.x, p.y);
      else boundaryShape.lineTo(p.x, p.y);
    });
    boundaryShape.closePath();

    // Add boundary outline
    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(
      boundaryShape.getPoints(50)
    );
    const boundaryLine = new THREE.Line(
      boundaryGeometry,
      new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 2 })
    );
    boundaryLine.position.z = maxElev + 0.5;
    geoGroup.add(boundaryLine);

    // Zone rendering with elevation-aware placement
    zones.forEach(zone => {
      const zonePoints = zone.path.map(p => proj.toLocal(p));
      const zoneShape = new THREE.Shape();
      zonePoints.forEach((p, i) => {
        if (i === 0) zoneShape.moveTo(p.x, p.y);
        else zoneShape.lineTo(p.x, p.y);
      });
      zoneShape.closePath();

      // Create zone overlay
      const zoneGeometry = new THREE.ShapeGeometry(zoneShape);
      const positions = zoneGeometry.attributes.position;
      
      // Apply elevation to zone vertices
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = getElevationAt(x, y) + 0.25; // Increased offset above terrain
        positions.setZ(i, z);
      }
      
      zoneGeometry.computeVertexNormals();
      
      let zoneColor = 0x555555;
      switch(zone.zoneMeta?.kind) {
        case 'residential': zoneColor = 0x4CAF50; break;
        case 'commercial': zoneColor = 0x2196F3; break;
        case 'amenity': zoneColor = 0xFFC107; break;
        case 'green_space': zoneColor = 0x2E7D32; break;
        case 'solar': zoneColor = 0xFF9800; break;
      }
      
      const zoneMaterial = new THREE.MeshStandardMaterial({
        color: zoneColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false, // Prevent zone from hiding things behind it
      });
      
      const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
      geoGroup.add(zoneMesh);
    });

    // Asset materials
    const buildingMaterial = new THREE.MeshStandardMaterial({ 
      color: '#D2B48C', 
      roughness: 0.7, 
      metalness: 0.1 
    });
    
    const solarPanelMaterial = new THREE.MeshStandardMaterial({ 
      color: '#0A2A48', 
      roughness: 0.2, 
      metalness: 0.8,
      envMapIntensity: 1.5
    });
    
    const selectedMaterial = new THREE.MeshStandardMaterial({ 
      color: '#ff8c00', 
      emissive: '#ff8c00', 
      emissiveIntensity: 0.3 
    });
    
    const originalMaterials = new WeakMap();

    // Helper for asset shapes
    const shapeFromPathRelativeToCenter = (path: LatLng[], centerXY: { x: number; y: number }) => {
      const points = path.map(p => {
        const l = proj.toLocal(p);
        return new THREE.Vector2(l.x - centerXY.x, l.y - centerXY.y);
      });
      return new THREE.Shape(points);
    };

    // Render assets with proper elevation
    assets.forEach(asset => {
      if (!asset.assetMeta) return;

      const assetCenterLL = getPolygonCenter(asset.path);
      const centerXY = proj.toLocal(assetCenterLL);
      const baseElevation = getElevationAt(centerXY.x, centerXY.y);
      const footprintShape = shapeFromPathRelativeToCenter(asset.path, centerXY);
      
      let height = 0;
      let material: THREE.Material;

      if(asset.assetMeta.assetType === 'building') {
        height = (asset.assetMeta.floors ?? 1) * 3.2;
        material = buildingMaterial.clone();
        
        // Add windows to buildings
        const windowTexture = new THREE.TextureLoader().load(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );
        (material as THREE.MeshStandardMaterial).emissiveMap = windowTexture;
        (material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x222222);
      } else if(asset.assetMeta.assetType === 'solar_panel') {
        height = 0.1;
        material = solarPanelMaterial.clone();
      } else {
        return;
      }

      const extrudeSettings = {
        depth: height,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2
      };

      const geometry = new THREE.ExtrudeGeometry(footprintShape, extrudeSettings);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { shape: asset, originalMaterial: material };
      originalMaterials.set(mesh, material);
      selectableMeshes.push(mesh);
      
      const pivot = new THREE.Object3D();
      const elevationOffset = asset.assetMeta.assetType === 'solar_panel' ? 0.1 : 0;
      pivot.position.set(centerXY.x, centerXY.y, baseElevation + elevationOffset);
      pivot.add(mesh);
      pivot.rotation.z = -(asset.assetMeta.rotation ?? 0) * (Math.PI / 180);
      geoGroup.add(pivot);
    });

    // Camera positioning
    const groupBBox = new THREE.Box3().setFromObject(geoGroup);
    const groupCenter = groupBBox.getCenter(new THREE.Vector3());
    const groupSize = groupBBox.getSize(new THREE.Vector3());
    const radius = Math.max(groupSize.x, groupSize.z) * 0.7;
    
    camera.position.set(
      groupCenter.x - radius * 0.8,
      groupCenter.y + radius * 1.2,
      groupCenter.z + radius * 0.8
    );
    camera.lookAt(groupCenter);
    orbitControls.target.copy(groupCenter);

    // Animation loop with performance monitoring
    const clock = new THREE.Clock();
    let lastTime = 0;
    const targetFPS = 60;
    const frameTime = 1000 / targetFPS;
    
    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);
      
      const deltaTime = currentTime - lastTime;
      if (deltaTime < frameTime) return;
      lastTime = currentTime;
      
      // Update selected asset material
      selectableMeshes.forEach(mesh => {
        if (selectedAsset?.mesh === mesh) {
          mesh.material = selectedMaterial;
        } else {
          mesh.material = originalMaterials.get(mesh) || mesh.userData.originalMaterial;
        }
      });
      
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate(0);

    // Resize handler
    const handleResize = () => {
      if (!mountNode) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountNode.removeEventListener('click', onMouseClick);
      cancelAnimationFrame(animationFrameId);

      orbitControls.dispose();

      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      renderer.dispose();
      if (mountNode && renderer.domElement && mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [assets, zones, boundary, elevationGrid, terrainQuality]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={mountRef} className="w-full h-full" />
      <Compass camera={cameraRef.current} />
      
      {elevationStats.range > 0 && (
        <ElevationStats 
          min={elevationStats.min} 
          max={elevationStats.max} 
          range={elevationStats.range} 
        />
      )}

      {selectedAsset && (
        <div className="absolute top-4 left-4 bg-background/80 p-2 rounded-md shadow-lg text-foreground text-sm flex items-center gap-2">
          <span>Selected: <span className="font-semibold">{selectedAsset.shape.assetMeta?.key}</span></span>
          <span className="text-xs text-muted-foreground">(Press Delete to remove)</span>
        </div>
      )}
      
      {/* Quality selector */}
      <div className="absolute top-20 right-4 bg-background/80 p-2 rounded-md shadow-lg">
        <div className="text-xs font-semibold mb-1">Terrain Quality</div>
        <div className="flex gap-1">
          <button
            onClick={() => setTerrainQuality('low')}
            className={cn(
              "px-2 py-1 text-xs rounded",
              terrainQuality === 'low' ? "bg-primary text-primary-foreground" : "bg-background"
            )}
          >
            Low
          </button>
          <button
            onClick={() => setTerrainQuality('medium')}
            className={cn(
              "px-2 py-1 text-xs rounded",
              terrainQuality === 'medium' ? "bg-primary text-primary-foreground" : "bg-background"
            )}
          >
            Med
          </button>
          <button
            onClick={() => setTerrainQuality('high')}
            className={cn(
              "px-2 py-1 text-xs rounded",
              terrainQuality === 'high' ? "bg-primary text-primary-foreground" : "bg-background"
            )}
          >
            High
          </button>
        </div>
      </div>
    </div>
  );
}
