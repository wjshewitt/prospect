
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Droplets, Layers, Mountain, Camera, CameraOff } from 'lucide-react';
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
  const orbitControlsRef = useRef<OrbitControls | null>(null);
  
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);
  const [elevationStats, setElevationStats] = useState({ min: 0, max: 0, range: 0 });
  const [terrainQuality, setTerrainQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [showWater, setShowWater] = useState(false);
  const [waterLevel, setWaterLevel] = useState(0);
  const [showTextures, setShowTextures] = useState(true);

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
      logarithmicDepthBuffer: true,
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
    orbitControlsRef.current = orbitControls;

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
    const R_EARTH = 6371e3;
    const COS_LAT = Math.cos(siteCenter.lat * Math.PI / 180);

    const proj = {
      toLocal: (p: LatLng) => {
        const dLat = (p.lat - siteCenter.lat) * Math.PI / 180;
        const dLng = (p.lng - siteCenter.lng) * Math.PI / 180;
        const x = dLng * R_EARTH * COS_LAT;
        const y = dLat * R_EARTH;
        return { x, y };
      },
      xyToLL: (x: number, y: number): LatLng => {
        const dLat = y / R_EARTH;
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
    setWaterLevel(minElev + elevRange * 0.3); // Default water at 30% of elevation range

    const getElevationAt = (x: number, y: number): number => {
      if (!grid || nx < 2 || ny < 2) return minElev;
    
      const u = (x - minX) / (maxX - minX);
      const v = 1 - ((y - minY) / (maxY - minY)); // Flipped V for correct mapping
    
      const gridU = u * (nx - 1);
      const gridV = v * (ny - 1);
    
      const i = Math.floor(gridU);
      const j = Math.floor(gridV);
    
      if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) {
        const clampedI = Math.max(0, Math.min(nx - 1, i));
        const clampedJ = Math.max(0, Math.min(ny - 1, j));
        return grid[clampedJ * nx + clampedI] || minElev;
      }
    
      const s = gridU - i; // Fractional part for interpolation in u
      const t = gridV - j; // Fractional part for interpolation in v
    
      // Bilinear interpolation
      const z00 = grid[j * nx + i] || minElev;
      const z10 = grid[j * nx + i + 1] || minElev;
      const z01 = grid[(j + 1) * nx + i] || minElev;
      const z11 = grid[(j + 1) * nx + i + 1] || minElev;
    
      const z0 = z00 * (1 - s) + z10 * s;
      const z1 = z01 * (1 - s) + z11 * s;
    
      return z0 * (1 - t) + z1 * t;
    };


    // Calculate boundary bounds and create shape
    const boundaryPoints = boundary.path.map(p => proj.toLocal(p));
    const boundaryShape = new THREE.Shape();
    boundaryPoints.forEach((p, i) => {
      if (i === 0) boundaryShape.moveTo(p.x, p.y);
      else boundaryShape.lineTo(p.x, p.y);
    });
    boundaryShape.closePath();

    // Create terrain textures
    const textureLoader = new THREE.TextureLoader();
    
    // Create procedural textures using canvas
    const createTerrainTexture = (baseColor: string, variation: number = 0.1) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Base color
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, 512, 512);
      
      // Add noise/variation
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 3;
        const alpha = Math.random() * variation;
        ctx.fillStyle = `rgba(${Math.random()*50}, ${Math.random()*50}, ${Math.random()*50}, ${alpha})`;
        ctx.fillRect(x, y, size, size);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
      return texture;
    };

    const grassTexture = createTerrainTexture('#3a5f1a', 0.2);
    const rockTexture = createTerrainTexture('#8b7355', 0.3);
    const sandTexture = createTerrainTexture('#c2b280', 0.15);


    // --- Zone and Material Mapping ---
    const zoneMaterialMap = new Map<string, number>();
    const materials: THREE.Material[] = [
        new THREE.MeshStandardMaterial({ color: 0x2d5016, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide }) // Default terrain
    ];

    const zoneKindToColor: Record<Shape['zoneMeta']['kind'], number> = {
        'residential': 0x4CAF50, // Green
        'commercial':  0x2196F3, // Blue
        'amenity':     0xFFC107, // Amber
        'green_space': 0x2E7D32, // Dark Green
        'solar':       0xFF9800, // Orange
    };
    
    zones.forEach(zone => {
        const color = zoneKindToColor[zone.zoneMeta!.kind] || 0x555555;
        materials.push(new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
        zoneMaterialMap.set(zone.id, materials.length - 1);
    });
    
    // Create LOD terrain meshes
    const createTerrainLOD = () => {
      const lodGroup = new THREE.LOD();
      
      const resolutions = [
        { segments: 100, distance: 0 },
        { segments: 50, distance: 100 },
        { segments: 25, distance: 300 },
      ];

      resolutions.forEach(({ segments, distance }) => {
        const geometry = new THREE.ShapeGeometry(boundaryShape, segments);
        const positions = geometry.attributes.position;
        
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = getElevationAt(x, y);
          positions.setZ(i, z);
        }

        // --- Assign materials based on zone ---
        geometry.clearGroups();
        const faces = Earcut.triangulate(positions.array, [], 3);
        const facesByMaterial: { [index: number]: number[] } = { 0: [] };
        zones.forEach(zone => { facesByMaterial[zoneMaterialMap.get(zone.id)!] = []; });

        for (let i = 0; i < faces.length; i += 3) {
            const i1 = faces[i];
            const i2 = faces[i+1];
            const i3 = faces[i+2];

            const cx = (positions.getX(i1) + positions.getX(i2) + positions.getX(i3)) / 3;
            const cy = (positions.getY(i1) + positions.getY(i2) + positions.getY(i3)) / 3;
            
            let materialIndex = 0; // Default terrain
            for (const zone of zones) {
                const googleZone = new google.maps.Polygon({ paths: zone.path });
                const centerLL = proj.xyToLL(cx, cy);
                if(google.maps.geometry.poly.containsLocation(new google.maps.LatLng(centerLL), googleZone)) {
                    materialIndex = zoneMaterialMap.get(zone.id) ?? 0;
                    break;
                }
            }
            
            facesByMaterial[materialIndex].push(i1, i2, i3);
        }

        let currentStart = 0;
        Object.entries(facesByMaterial).forEach(([matIndex, faceIndices]) => {
            if (faceIndices.length > 0) {
                geometry.addGroup(currentStart, faceIndices.length, parseInt(matIndex));
                currentStart += faceIndices.length;
            }
        });
        
        geometry.setIndex(faces);
        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        lodGroup.addLevel(mesh, distance);
      });

      return lodGroup;
    };

    // Add terrain LOD to scene
    const terrainLOD = createTerrainLOD();
    geoGroup.add(terrainLOD);

    // Water feature
    let waterMesh: THREE.Mesh | null = null;
    if (showWater) {
       const boundaryBBox = new THREE.Box3().setFromPoints(boundaryPoints.map(p => new THREE.Vector3(p.x, p.y, 0)));
       const size = boundaryBBox.getSize(new THREE.Vector3());

      const waterGeometry = new THREE.PlaneGeometry(size.x * 1.2, size.y * 1.2, 1, 1);
      
      const waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          waterColor: { value: new THREE.Color(0x006994) },
          waterHighlight: { value: new THREE.Color(0x4db8ff) },
          flowSpeed: { value: 0.03 }
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float time;
          
          void main() {
            vUv = uv;
            vec3 pos = position;
            
            pos.z += sin(position.x * 0.1 + time) * 0.2;
            pos.z += cos(position.y * 0.15 + time * 1.2) * 0.15;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform vec3 waterColor;
          uniform vec3 waterHighlight;
          uniform float flowSpeed;
          varying vec2 vUv;
          
          void main() {
            vec2 uv = vUv;
            uv.x += sin(uv.y * 10.0 + time * flowSpeed) * 0.01;
            uv.y += cos(uv.x * 10.0 + time * flowSpeed * 0.8) * 0.01;
            
            float ripple1 = sin(length(uv - vec2(0.5)) * 20.0 - time) * 0.5 + 0.5;
            float ripple2 = cos(length(uv - vec2(0.3, 0.7)) * 15.0 - time * 0.8) * 0.5 + 0.5;
            float ripples = (ripple1 + ripple2) * 0.5;
            
            vec3 color = mix(waterColor, waterHighlight, ripples * 0.3);
            
            gl_FragColor = vec4(color, 0.85);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      
      waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      const center = boundaryBBox.getCenter(new THREE.Vector3());
      waterMesh.position.set(center.x, center.y, waterLevel);
      waterMesh.receiveShadow = true;
      geoGroup.add(waterMesh);
    }
    
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

    // Render assets with LOD support
    assets.forEach(asset => {
      if (!asset.assetMeta) return;

      const assetCenterLL = getPolygonCenter(asset.path);
      const centerXY = proj.toLocal(assetCenterLL);
      const baseElevation = getElevationAt(centerXY.x, centerXY.y);
      const footprintShape = shapeFromPathRelativeToCenter(asset.path, centerXY);
      
      let height = 0;
      let material: THREE.Material;
      let lodAsset: THREE.LOD | THREE.Object3D;

      if(asset.assetMeta.assetType === 'building') {
        height = (asset.assetMeta.floors ?? 1) * 3.2;
        material = buildingMaterial.clone();
        
        lodAsset = new THREE.LOD();
        
        const highDetailGeometry = new THREE.ExtrudeGeometry(footprintShape, {
          depth: height,
          bevelEnabled: true,
          bevelThickness: 0.1,
          bevelSize: 0.1,
          bevelSegments: 3
        });
        const highDetailMesh = new THREE.Mesh(highDetailGeometry, material.clone());
        highDetailMesh.castShadow = true;
        highDetailMesh.receiveShadow = true;
        lodAsset.addLevel(highDetailMesh, 0);
        
        const medDetailGeometry = new THREE.ExtrudeGeometry(footprintShape, {
          depth: height,
          bevelEnabled: true,
          bevelThickness: 0.05,
          bevelSize: 0.05,
          bevelSegments: 1
        });
        const medDetailMesh = new THREE.Mesh(medDetailGeometry, material.clone());
        medDetailMesh.castShadow = true;
        medDetailMesh.receiveShadow = true;
        lodAsset.addLevel(medDetailMesh, 50);
        
        const lowDetailGeometry = new THREE.ExtrudeGeometry(footprintShape, {
          depth: height,
          bevelEnabled: false
        });
        const lowDetailMesh = new THREE.Mesh(lowDetailGeometry, material.clone());
        lowDetailMesh.castShadow = false;
        lowDetailMesh.receiveShadow = true;
        lodAsset.addLevel(lowDetailMesh, 150);
        
        [highDetailMesh, medDetailMesh, lowDetailMesh].forEach(mesh => {
          mesh.userData = { shape: asset, originalMaterial: material };
          originalMaterials.set(mesh, material.clone());
          selectableMeshes.push(mesh);
        });
        
      } else if(asset.assetMeta.assetType === 'solar_panel') {
        height = 0.1;
        material = solarPanelMaterial.clone();
        
        const geometry = new THREE.ExtrudeGeometry(footprintShape, {
          depth: height,
          bevelEnabled: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { shape: asset, originalMaterial: material };
        originalMaterials.set(mesh, material);
        selectableMeshes.push(mesh);
        lodAsset = mesh;
      } else {
        return;
      }

      const pivot = new THREE.Object3D();
      const elevationOffset = asset.assetMeta.assetType === 'solar_panel' ? 0.1 : 0;
      pivot.position.set(centerXY.x, centerXY.y, baseElevation + elevationOffset);
      pivot.add(lodAsset);
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
      
      if (waterMesh && waterMesh.material instanceof THREE.ShaderMaterial) {
        waterMesh.material.uniforms.time.value = clock.getElapsedTime();
      }
      
      terrainLOD.update(camera);
      assets.forEach(asset => {
        const lodObject = geoGroup.children.find(child => 
          child.children.some(grandchild => 
            grandchild instanceof THREE.LOD && 
            grandchild.children.some(mesh => 
              (mesh as any).userData?.shape === asset
            )
          )
        );
        if (lodObject && lodObject.children[0] instanceof THREE.LOD) {
          lodObject.children[0].update(camera);
        }
      });
      
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
  }, [assets, zones, boundary, elevationGrid, terrainQuality, showWater, waterLevel, showTextures, onDeleteAsset, selectedAsset]);

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
      
      <div className="absolute top-20 right-4 bg-background/80 p-2 rounded-md shadow-lg">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Textures
        </div>
        <button
          onClick={() => setShowTextures(!showTextures)}
          className={cn(
            "px-3 py-1 text-xs rounded w-full",
            showTextures ? "bg-primary text-primary-foreground" : "bg-background"
          )}
        >
          {showTextures ? 'On' : 'Off'}
        </button>
      </div>
      
      <div className="absolute top-36 right-4 bg-background/80 p-2 rounded-md shadow-lg">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1">
          <Droplets className="w-3 h-3" />
          Water
        </div>
        <button
          onClick={() => setShowWater(!showWater)}
          className={cn(
            "px-3 py-1 text-xs rounded w-full mb-2",
            showWater ? "bg-primary text-primary-foreground" : "bg-background"
          )}
        >
          {showWater ? 'On' : 'Off'}
        </button>
        {showWater && (
          <div className="space-y-1">
            <div className="text-xs">Level: {waterLevel.toFixed(1)}m</div>
            <input
              type="range"
              min={elevationStats.min}
              max={elevationStats.max}
              step="0.5"
              value={waterLevel}
              onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
              className="w-full h-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}
