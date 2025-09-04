'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Droplets, Layers, Mountain } from 'lucide-react';
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

    // Enhanced elevation getter with bicubic interpolation
    const getElevationAt = (x: number, y: number): number => {
      if (!grid || nx < 2 || ny < 2) return minElev;
      
      const u = ((x - minX) / (maxX - minX)) * (nx - 1);
      const v = ((y - minY) / (maxY - minY)) * (ny - 1);
      
      const i = Math.floor(u);
      const j = Math.floor(v);

      if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) {
        const clampedI = Math.max(0, Math.min(nx - 1, Math.round(u)));
        const clampedJ = Math.max(0, Math.min(ny - 1, Math.round(v)));
        return grid[clampedJ * nx + clampedI] || minElev;
      }

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

    // Calculate boundary bounds
    const boundaryPoints = boundary.path.map(p => proj.toLocal(p));
    let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
    boundaryPoints.forEach(p => {
      bMinX = Math.min(bMinX, p.x);
      bMaxX = Math.max(bMaxX, p.x);
      bMinY = Math.min(bMinY, p.y);
      bMaxY = Math.max(bMaxY, p.y);
    });

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

    // Create LOD terrain meshes
    const createTerrainLOD = () => {
      const lodGroup = new THREE.LOD();
      
      // Different resolutions for LOD
      const resolutions = [
        { segments: 100, distance: 0 },    // High detail
        { segments: 50, distance: 100 },   // Medium detail
        { segments: 25, distance: 300 },   // Low detail
        { segments: 10, distance: 500 }    // Very low detail
      ];

      resolutions.forEach(({ segments, distance }) => {
        const gridWidth = Math.ceil((bMaxX - bMinX) / 2) * 2;
        const gridHeight = Math.ceil((bMaxY - bMinY) / 2) * 2;
        const segmentsX = Math.max(5, Math.min(segments, gridWidth));
        const segmentsY = Math.max(5, Math.min(segments, gridHeight));

        const geometry = new THREE.PlaneGeometry(
          gridWidth,
          gridHeight,
          segmentsX,
          segmentsY
        );

        const positions = geometry.attributes.position;
        const uvs = geometry.attributes.uv;
        const colors = new Float32Array(positions.count * 3);
        const slopes = new Float32Array(positions.count); // Store slope for texture blending
        
        // Apply elevation to vertices
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i) + (bMinX + bMaxX) / 2;
          const y = positions.getY(i) + (bMinY + bMaxY) / 2;
          const z = getElevationAt(x, y);
          
          positions.setZ(i, z);
          
          // Calculate slope for texture blending
          const dx = 1; // Sample distance
          const zDx = getElevationAt(x + dx, y) - getElevationAt(x - dx, y);
          const zDy = getElevationAt(x, y + dx) - getElevationAt(x, y - dx);
          const slope = Math.sqrt(zDx * zDx + zDy * zDy) / (2 * dx);
          slopes[i] = Math.min(slope / 0.5, 1); // Normalize slope
          
          // Calculate vertex colors based on elevation and slope
          const normalizedHeight = (z - minElev) / (elevRange || 1);
          
          let color;
          if (slope > 0.7) {
            // Steep slopes - rock/cliff color
            color = new THREE.Color(0x8b7355);
          } else if (normalizedHeight < 0.3) {
            // Low elevation - lush green
            color = new THREE.Color(0x2d5016);
          } else if (normalizedHeight < 0.6) {
            // Mid elevation - grass
            color = new THREE.Color(0x4a6741);
          } else if (normalizedHeight < 0.85) {
            // High elevation - rocky grass
            color = new THREE.Color(0x7a6f5d);
          } else {
            // Peak - rock/snow
            color = new THREE.Color(0xd2b48c);
          }
          
          // Add some color variation
          const variation = (Math.random() - 0.5) * 0.1;
          color.r = Math.max(0, Math.min(1, color.r + variation));
          color.g = Math.max(0, Math.min(1, color.g + variation));
          color.b = Math.max(0, Math.min(1, color.b + variation));
          
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        
        // Smooth terrain for lower LODs
        if (segments < 50) {
          const smoothingPasses = segments < 25 ? 3 : 1;
          for (let pass = 0; pass < smoothingPasses; pass++) {
            const newZ = new Float32Array(positions.count);
            
            for (let i = 0; i <= segmentsY; i++) {
              for (let j = 0; j <= segmentsX; j++) {
                const idx = i * (segmentsX + 1) + j;
                let sumZ = positions.getZ(idx);
                let count = 1;
                
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
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('slope', new THREE.BufferAttribute(slopes, 1));
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;

        // Create material based on texture availability
        let material;
        if (showTextures) {
          // Custom shader material for texture blending
          material = new THREE.ShaderMaterial({
            uniforms: {
              grassTexture: { value: grassTexture },
              rockTexture: { value: rockTexture },
              sandTexture: { value: sandTexture },
              fogColor: { value: new THREE.Color(0x87CEEB) },
              fogNear: { value: 10 },
              fogFar: { value: 1000 }
            },
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vNormal;
              varying vec3 vPosition;
              varying vec3 vColor;
              varying float vSlope;
              attribute vec3 color;
              attribute float slope;
              
              void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
                vColor = color;
                vSlope = slope;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D grassTexture;
              uniform sampler2D rockTexture;
              uniform sampler2D sandTexture;
              uniform vec3 fogColor;
              uniform float fogNear;
              uniform float fogFar;
              
              varying vec2 vUv;
              varying vec3 vNormal;
              varying vec3 vPosition;
              varying vec3 vColor;
              varying float vSlope;
              
              void main() {
                vec3 grass = texture2D(grassTexture, vUv * 20.0).rgb;
                vec3 rock = texture2D(rockTexture, vUv * 15.0).rgb;
                vec3 sand = texture2D(sandTexture, vUv * 25.0).rgb;
                
                // Blend textures based on slope and color
                vec3 color = mix(grass, rock, vSlope);
                color = mix(color, sand, smoothstep(0.8, 1.0, vColor.r));
                color *= vColor;
                
                // Add lighting
                vec3 light = normalize(vec3(0.5, 1.0, 0.3));
                float diffuse = max(dot(vNormal, light), 0.0);
                color *= 0.5 + 0.5 * diffuse;
                
                // Apply fog
                float depth = length(vPosition);
                float fogFactor = smoothstep(fogNear, fogFar, depth);
                color = mix(color, fogColor, fogFactor);
                
                gl_FragColor = vec4(color, 1.0);
              }
            `,
            side: THREE.DoubleSide,
            fog: true
          });
          } catch (error) {
            console.warn('Shader compilation failed, falling back to standard material', error);
            material = new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.9,
              metalness: 0.0,
              side: THREE.DoubleSide,
              flatShading: false
            });
          }
        } else {
          // Simple vertex color material
          material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.0,
            side: THREE.DoubleSide,
            flatShading: segments < 25
          });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = segments > 50;
        mesh.position.set((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2, 0);
        
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
      const waterGeometry = new THREE.PlaneGeometry(
        (bMaxX - bMinX) * 2,
        (bMaxY - bMinY) * 2,
        1,
        1
      );
      
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
            
            // Simple wave animation
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
            // Animated water pattern
            vec2 uv = vUv;
            uv.x += sin(uv.y * 10.0 + time * flowSpeed) * 0.01;
            uv.y += cos(uv.x * 10.0 + time * flowSpeed * 0.8) * 0.01;
            
            // Create ripples
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
      waterMesh.position.set((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2, waterLevel);
      waterMesh.receiveShadow = true;
      geoGroup.add(waterMesh);
    }

    // Boundary outline
    const boundaryShape = new THREE.Shape();
    boundaryPoints.forEach((p, i) => {
      if (i === 0) boundaryShape.moveTo(p.x, p.y);
      else boundaryShape.lineTo(p.x, p.y);
    });
    boundaryShape.closePath();

    const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(
      boundaryShape.getPoints(50)
    );
    const boundaryLine = new THREE.Line(
      boundaryGeometry,
      new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 2 })
    );
    boundaryLine.position.z = maxElev + 0.5;
    geoGroup.add(boundaryLine);

    // Zone rendering with improved materials
    zones.forEach(zone => {
      const zonePoints = zone.path.map(p => proj.toLocal(p));
      const zoneShape = new THREE.Shape();
      zonePoints.forEach((p, i) => {
        if (i === 0) zoneShape.moveTo(p.x, p.y);
        else zoneShape.lineTo(p.x, p.y);
      });
      zoneShape.closePath();

      const zoneGeometry = new THREE.ShapeGeometry(zoneShape);
      const positions = zoneGeometry.attributes.position;
      
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = getElevationAt(x, y) + 0.1;
        positions.setZ(i, z);
      }
      
      zoneGeometry.computeVertexNormals();
      
      let zoneColor = 0x555555;
      let emissiveColor = 0x000000;
      switch(zone.zoneMeta?.kind) {
        case 'residential': 
          zoneColor = 0x4CAF50; 
          emissiveColor = 0x1b5e20;
          break;
        case 'commercial': 
          zoneColor = 0x2196F3; 
          emissiveColor = 0x0d47a1;
          break;
        case 'amenity': 
          zoneColor = 0xFFC107; 
          emissiveColor = 0xf57c00;
          break;
        case 'green_space': 
          zoneColor = 0x2E7D32; 
          emissiveColor = 0x1b5e20;
          break;
        case 'solar': 
          zoneColor = 0xFF9800; 
          emissiveColor = 0xe65100;
          break;
      }
      
      const zoneMaterial = new THREE.MeshStandardMaterial({
        color: zoneColor,
        emissive: emissiveColor,
        emissiveIntensity: 0.1,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
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
        
        // Create LOD for buildings
        lodAsset = new THREE.LOD();
        
        // High detail version
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
        
        // Medium detail version
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
        
        // Low detail version - simple box
        const lowDetailGeometry = new THREE.ExtrudeGeometry(footprintShape, {
          depth: height,
          bevelEnabled: false
        });
        const lowDetailMesh = new THREE.Mesh(lowDetailGeometry, material.clone());
        lowDetailMesh.castShadow = false;
        lowDetailMesh.receiveShadow = true;
        lodAsset.addLevel(lowDetailMesh, 150);
        
        // Store for selection
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
      
      // Update water animation
      if (waterMesh && waterMesh.material instanceof THREE.ShaderMaterial) {
        waterMesh.material.uniforms.time.value = clock.getElapsedTime();
      }
      
      // Update LODs based on camera distance
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
  }, [assets, zones, boundary, elevationGrid, terrainQuality, showWater, waterLevel, showTextures]);

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
        <div className="text-xs font-semibold mb-1 flex items-center gap-1">
          <Mountain className="w-3 h-3" />
          Terrain Quality
        </div>
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
      
      {/* Texture toggle */}
      <div className="absolute top-36 right-4 bg-background/80 p-2 rounded-md shadow-lg">
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
      
      {/* Water controls */}
      <div className="absolute top-52 right-4 bg-background/80 p-2 rounded-md shadow-lg">
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