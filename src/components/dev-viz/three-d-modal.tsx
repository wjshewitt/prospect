
'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Layers, MousePointer, Settings, Mountain, Grid3x3, ChevronsUpDown, Star, Sigma, Eye, Sun, Cloud } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Wireframe } from 'three/examples/jsm/lines/Wireframe.js';
import { WireframeGeometry2 } from 'three/examples/jsm/lines/WireframeGeometry2.js';

// Helper to calculate the center of a polygon
const getPolygonCenter = (path: LatLng[]): LatLng => {
  if (!path || path.length === 0) return { lat: 0, lng: 0 };
  
  let sumLat = 0, sumLng = 0;
  path.forEach(p => {
    sumLat += p.lat;
    sumLng += p.lng;
  });
  return { lat: sumLat / path.length, lng: sumLng / path.length };
};

// Enhanced Compass with elevation indicator
const Compass = ({ rotation, elevation }: { rotation: number; elevation: number }) => (
  <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-md rounded-xl shadow-2xl p-3 pointer-events-none z-50 border border-white/20">
    <div className="w-16 h-16 relative">
      <div
        className="relative w-full h-full transition-transform duration-200"
        style={{ transform: `rotate(${-rotation}rad)` }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 font-bold text-base text-red-600 drop-shadow-md">N</div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-sm text-muted-foreground">S</div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">W</div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">E</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp className="w-7 h-7 text-red-600 drop-shadow-lg" />
      </div>
    </div>
    <div className="text-xs text-center mt-1 font-semibold">
      {Math.abs(elevation).toFixed(0)}°
    </div>
  </div>
);

// Enhanced elevation stats with better visualization
const ElevationStats = ({ min, max, range, currentElev }: { 
  min: number; 
  max: number; 
  range: number;
  currentElev?: number;
}) => (
  <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-white/20">
    <div className="flex items-center gap-2 mb-3">
      <Mountain className="w-5 h-5 text-primary" />
      <span className="font-bold text-base">Elevation</span>
    </div>
    <div className="space-y-1.5 text-sm">
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Min:</span>
        <span className="font-mono font-semibold">{min.toFixed(1)}m</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Max:</span>
        <span className="font-mono font-semibold">{max.toFixed(1)}m</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Range:</span>
        <span className="font-mono font-semibold">{range.toFixed(1)}m</span>
      </div>
      {currentElev !== undefined && (
        <div className="flex justify-between gap-6 pt-2 mt-2 border-t border-white/10">
          <span className="text-muted-foreground">Cursor:</span>
          <span className="font-mono font-bold text-primary">{currentElev.toFixed(1)}m</span>
        </div>
      )}
    </div>
    <div className="mt-3 h-3 rounded-full overflow-hidden bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600 shadow-inner" />
  </div>
);

// Performance monitor component
const PerformanceMonitor = ({ fps, triangles, drawCalls }: {
  fps: number;
  triangles: number;
  drawCalls: number;
}) => (
  <div className="absolute top-24 right-4 bg-background/90 backdrop-blur-md p-3 rounded-xl shadow-2xl text-sm space-y-1.5 border border-white/20">
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">FPS:</span>
      <span className={cn("font-mono font-bold", 
        fps < 30 ? "text-red-500" : 
        fps < 50 ? "text-yellow-500" : 
        "text-green-500")}>
        {fps.toFixed(0)}
      </span>
    </div>
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">Triangles:</span>
      <span className="font-mono">{(triangles / 1000).toFixed(1)}k</span>
    </div>
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">Draws:</span>
      <span className="font-mono">{drawCalls}</span>
    </div>
  </div>
);

// Enhanced visualization settings
interface VisualizationSettings {
  terrainQuality: 'low' | 'medium' | 'high' | 'ultra';
  showWireframe: boolean;
  showShadows: boolean;
  terrainExaggeration: number;
  useLOD: boolean;
  showPerformance: boolean;
  ambientIntensity: number;
  sunIntensity: number;
  fogDensity: number;
  showContours: boolean;
  terrainStyle: 'realistic' | 'topographic' | 'satellite';
}

interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

// Multi-point gradient for realistic terrain coloring
const terrainGradient = [
    { stop: 0.0, color: new THREE.Color(0x0D3F0D) },   // Deep green for lowlands
    { stop: 0.2, color: new THREE.Color(0x3A7A3A) },   // Lighter green
    { stop: 0.4, color: new THREE.Color(0x5C8B2A) },   // Grassy green
    { stop: 0.55, color: new THREE.Color(0x8B7355) }, // Earthy brown
    { stop: 0.7, color: new THREE.Color(0xA0826D) },  // Rocky brown
    { stop: 0.85, color: new THREE.Color(0xC4A57B) }, // Light rock
    { stop: 0.95, color: new THREE.Color(0xE8DCC6) }, // High altitude rock
    { stop: 1.0, color: new THREE.Color(0xFAFAFA) }    // Snow caps
];

function getGradientColor(value: number): THREE.Color {
    // Find the two stops the value is between
    for (let i = 0; i < terrainGradient.length - 1; i++) {
        const lower = terrainGradient[i];
        const upper = terrainGradient[i + 1];
        if (value >= lower.stop && value <= upper.stop) {
            // Normalize the value within this segment
            const t = (value - lower.stop) / (upper.stop - lower.stop);
            return lower.color.clone().lerp(upper.color, t);
        }
    }
    // Handle edge cases
    return value < 0.5 ? terrainGradient[0].color : terrainGradient[terrainGradient.length - 1].color;
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
  const sceneRef = useRef<THREE.Scene | null>(null);
  const selectableMeshesRef = useRef<THREE.Mesh[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  
  const [compassRotation, setCompassRotation] = useState(0);
  const [cameraElevation, setCameraElevation] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);
  const [elevationStats, setElevationStats] = useState({ min: 0, max: 0, range: 0 });
  const [cursorElevation, setCursorElevation] = useState<number | undefined>();
  const [performanceStats, setPerformanceStats] = useState({ fps: 60, triangles: 0, drawCalls: 0 });
  const [settings, setSettings] = useState<VisualizationSettings>({
    terrainQuality: 'high',
    showWireframe: false,
    showShadows: true,
    terrainExaggeration: 1.2,
    useLOD: true,
    showPerformance: false,
    ambientIntensity: 0.4,
    sunIntensity: 1.8,
    fogDensity: 0.0003,
    showContours: false,
    terrainStyle: 'realistic'
  });

  // Local projection utility
  const geoUtils = useMemo(() => {
    const center = getPolygonCenter(boundary.path);
    const R = 6371000;
    const cosLat = Math.cos(center.lat * Math.PI / 180);

    return {
      center: center,
      toLocal: (lat: number, lng: number): THREE.Vector3 => {
        const dLat = (lat - center.lat) * Math.PI / 180;
        const dLng = (lng - center.lng) * Math.PI / 180;
        return new THREE.Vector3(dLng * R * cosLat, dLat * R, 0);
      },
      fromLocal: (x: number, y: number): LatLng => {
        const dLat = y / R;
        const dLng = x / (R * cosLat);
        return {
          lat: center.lat + dLat * 180 / Math.PI,
          lng: center.lng + dLng * 180 / Math.PI,
        };
      },
    };
  }, [boundary]);

  // Keyboard controls
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAsset) {
      onDeleteAsset(selectedAsset.shape.id);
      setSelectedAsset(null);
    } else if (event.key === 'w') {
      setSettings(prev => ({ ...prev, showWireframe: !prev.showWireframe }));
    } else if (event.key === 'p') {
      setSettings(prev => ({ ...prev, showPerformance: !prev.showPerformance }));
    } else if (event.key === 'c') {
      setSettings(prev => ({ ...prev, showContours: !prev.showContours }));
    }
  }, [selectedAsset, onDeleteAsset]);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Main enhanced scene setup
  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;
    let animationFrameId: number;

    // Enhanced scene with better atmosphere
    const scene = new THREE.Scene();
    const skyGradient = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0xB0E0E6), 0.5);
    scene.background = skyGradient;
    scene.fog = new THREE.FogExp2(skyGradient, settings.fogDensity);
    sceneRef.current = scene;

    // High-quality renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      logarithmicDepthBuffer: true,
      precision: 'highp'
    });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = settings.showShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    mountNode.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // Enhanced environment mapping
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const renderTarget = pmremGenerator.fromScene(scene);
    scene.environment = renderTarget.texture;

    const camera = new THREE.PerspectiveCamera(
      55,
      mountNode.clientWidth / mountNode.clientHeight,
      0.1,
      50000
    );
    cameraRef.current = camera;
    
    // Enhanced lighting system for better depth and shadows
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, settings.ambientIntensity);
    scene.add(ambientLight);

    // Primary sun light with realistic color temperature
    const sunLight = new THREE.DirectionalLight(0xFFF5E6, settings.sunIntensity);
    sunLight.position.set(300, 600, 200);
    sunLight.castShadow = settings.showShadows;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 3000;
    sunLight.shadow.camera.left = -800;
    sunLight.shadow.camera.right = 800;
    sunLight.shadow.camera.top = 800;
    sunLight.shadow.camera.bottom = -800;
    sunLight.shadow.mapSize.width = 8192;
    sunLight.shadow.mapSize.height = 8192;
    sunLight.shadow.bias = -0.00005;
    sunLight.shadow.normalBias = 0.01;
    sunLight.shadow.radius = 4;
    sunLight.shadow.blurSamples = 25;
    scene.add(sunLight);

    // Sky-ground hemisphere light for natural ambient
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3B5323, 0.5);
    scene.add(hemiLight);

    // Multiple fill lights for eliminating harsh shadows
    const fillLight1 = new THREE.DirectionalLight(0xFFE4E1, 0.3);
    fillLight1.position.set(-200, 300, -150);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xE6E6FA, 0.25);
    fillLight2.position.set(150, 250, -300);
    scene.add(fillLight2);

    // Rim light for edge definition
    const rimLight = new THREE.DirectionalLight(0xFFFFFF, 0.2);
    rimLight.position.set(0, 100, -400);
    scene.add(rimLight);

    // Enhanced orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.rotateSpeed = 0.6;
    orbitControls.zoomSpeed = 1.0;
    orbitControls.panSpeed = 0.8;
    orbitControls.screenSpacePanning = true;
    orbitControls.minDistance = 5;
    orbitControls.maxDistance = 5000;
    orbitControls.maxPolarAngle = Math.PI * 0.495;
    orbitControls.enablePan = true;
    orbitControls.autoRotate = false;
    orbitControls.autoRotateSpeed = 0.5;

    const updateCameraInfo = () => {
      const vector = new THREE.Vector3();
      camera.getWorldDirection(vector);
      const angle = Math.atan2(vector.x, vector.z);
      setCompassRotation(angle);
      
      const elevation = Math.atan2(vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z));
      setCameraElevation(elevation * 180 / Math.PI);
    };
    orbitControls.addEventListener('change', updateCameraInfo);
    updateCameraInfo();

    // Enhanced raycasting
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line!.threshold = 3;
    const mouse = new THREE.Vector2();
    let terrainMesh: THREE.Mesh | null = null;

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      if (terrainMesh) {
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
          const point = intersects[0].point;
          setCursorElevation(point.z / settings.terrainExaggeration);
        } else {
          setCursorElevation(undefined);
        }
      }
    };

    const onMouseClick = (event: MouseEvent) => {
      if (!renderer.domElement.parentElement?.contains(event.target as Node)) {
        return;
      }
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(selectableMeshesRef.current);

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

    mountNode.addEventListener('mousemove', onMouseMove);
    mountNode.addEventListener('click', onMouseClick);

    const geoGroup = new THREE.Group();
    geoGroup.rotation.x = -Math.PI / 2;
    scene.add(geoGroup);

    // Process elevation data
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;

    let minElev = Infinity, maxElev = -Infinity;
    for (let i = 0; i < grid.length; i++) {
      if (isFinite(grid[i])) {
        minElev = Math.min(minElev, grid[i]);
        maxElev = Math.max(maxElev, grid[i]);
      }
    }
    const elevRange = maxElev - minElev;
    setElevationStats({ min: minElev, max: maxElev, range: elevRange });

    const exaggeration = settings.terrainExaggeration;

    // Enhanced elevation interpolation with smoothing
    const getElevationAt = (x: number, y: number): number => {
      if (!grid || nx < 2 || ny < 2) return minElev * exaggeration;
      
      const u = ((x - minX) / (maxX - minX)) * (nx - 1);
      const v = ((y - minY) / (maxY - minY)) * (ny - 1);
      
      const i = Math.floor(u);
      const j = Math.floor(v);

      if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) {
        const clampedI = Math.max(0, Math.min(nx - 1, Math.round(u)));
        const clampedJ = Math.max(0, Math.min(ny - 1, Math.round(v)));
        return (grid[clampedJ * nx + clampedI] || minElev) * exaggeration;
      }

      // Bilinear interpolation for speed/simplicity. Can be upgraded to bicubic.
      const s = u - i;
      const t = v - j;
      const z00 = (grid[j * nx + i] || minElev) * exaggeration;
      const z10 = (grid[j * nx + (i + 1)] || minElev) * exaggeration;
      const z01 = (grid[(j + 1) * nx + i] || minElev) * exaggeration;
      const z11 = (grid[(j + 1) * nx + (i + 1)] || minElev) * exaggeration;
      const z1 = z00 + s * (z10 - z00);
      const z2 = z01 + s * (z11 - z01);
      return z1 + t * (z2 - z1);
    };

    const boundaryPoints = boundary.path.map(p => {
      const local = geoUtils.toLocal(p.lat, p.lng);
      return { x: local.x, y: local.y };
    });

    if (boundaryPoints.length < 3) {
      console.error("Boundary has fewer than 3 points and cannot be rendered.");
      mountNode.innerHTML = `<div style="color: white; display: flex; align-items: center; justify-content: center; height: 100%;">Invalid boundary data provided.</div>`;
      return; 
    }

    let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
    boundaryPoints.forEach(p => {
      bMinX = Math.min(bMinX, p.x);
      bMaxX = Math.max(bMaxX, p.x);
      bMinY = Math.min(bMinY, p.y);
      bMaxY = Math.max(bMaxY, p.y);
    });

    const boundaryWidth = bMaxX - bMinX;
    const boundaryHeight = bMaxY - bMinY;
    const terrainPadding = Math.max(boundaryWidth, boundaryHeight) * 0.15;
    const renderRadius = (Math.sqrt(boundaryWidth * boundaryWidth + boundaryHeight * boundaryHeight) / 2 + terrainPadding) * 1.25;


    // Enhanced terrain quality settings
    let gridResolution: number;
    
    if (settings.terrainQuality === 'ultra') {
      gridResolution = 256;
    } else if (settings.terrainQuality === 'high') {
      gridResolution = 192;
    } else if (settings.terrainQuality === 'medium') {
      gridResolution = 128;
    } else {
      gridResolution = 64;
    }
    
    const segments = Math.max(20, Math.min(gridResolution, Math.floor(renderRadius * 2 / 5)));

    // Create high-quality LOD terrain
    const lod = new THREE.LOD();
    const lodLevels = settings.useLOD ? [
        { distance: 0, segments: segments },
        { distance: 300, segments: Math.max(20, Math.floor(segments * 0.6)) },
        { distance: 600, segments: Math.max(15, Math.floor(segments * 0.4)) },
        { distance: 1200, segments: Math.max(10, Math.floor(segments * 0.2)) }
    ] : [{ distance: 0, segments: segments }];

    lodLevels.forEach((level, levelIndex) => {
      if (level.segments < 1) return;
      
      const geom = new THREE.PlaneGeometry(
        renderRadius * 2, 
        renderRadius * 2, 
        level.segments, 
        level.segments
      );
      
      const positions = geom.attributes.position;
      
      // Apply elevation
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + (bMinX + bMaxX) / 2;
        const y = positions.getY(i) + (bMinY + bMaxY) / 2;
        const z = getElevationAt(x, y);
        positions.setZ(i, z);
      }
      
      geom.computeVertexNormals();
      geom.attributes.position.needsUpdate = true;
      
      // Create rich terrain colors
      const colors = new Float32Array(positions.count * 3);
      
      for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i);
        const normalizedHeight = (z / exaggeration - minElev) / (elevRange || 1);
        
        let color: THREE.Color;
        
        if (settings.terrainStyle === 'realistic') {
          color = new THREE.Color(0xcccccc); // Monotone base
          // Add subtle random variation for texture
          const variation = (Math.sin(i * 0.1) * 0.5 + 0.5) * 0.1;
          color.r = Math.min(1, color.r * (1 + variation));
          color.g = Math.min(1, color.g * (1 + variation));
          color.b = Math.min(1, color.b * (1 + variation));

        } else if (settings.terrainStyle === 'topographic') {
          color = new THREE.Color(0xFFFFFF);
        } else { // satellite
          color = new THREE.Color(0x3A7A3A);
        }

        color.toArray(colors, i * 3);
      }
      
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Terrain material with better physical properties
      const terrainMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: false,
        wireframe: settings.showWireframe,
        side: THREE.FrontSide,
        dithering: true,
        envMapIntensity: 0.1
      });
      
      const mesh = new THREE.Mesh(geom, terrainMaterial);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      
      if (levelIndex === 0) {
        terrainMesh = mesh;
      }
      
      lod.addLevel(mesh, level.distance);
    });

    geoGroup.add(lod);
    
    // Add contour lines if enabled
    if (settings.showContours && terrainMesh) {
      const contourMaterial = new LineMaterial({
        color: 0x000000,
        linewidth: 1.5,
        resolution: new THREE.Vector2(mountNode.clientWidth, mountNode.clientHeight),
        dashed: false,
        opacity: 0.3
      });
      const numContours = 20;
      const contourInterval = elevRange / numContours;

      for (let i = 1; i < numContours; i++) {
        const contourElev = (minElev + i * contourInterval) * exaggeration;
        const lineGeom = new THREE.BufferGeometry();
        const points: THREE.Vector3[] = [];
        
        const positions = (terrainMesh.geometry as THREE.BufferGeometry).attributes.position;
        for (let j = 0; j < positions.count - 1; j++) {
           if ((positions.getZ(j) > contourElev && positions.getZ(j+1) < contourElev) ||
               (positions.getZ(j) < contourElev && positions.getZ(j+1) > contourElev)) {
                 points.push(new THREE.Vector3(positions.getX(j), positions.getY(j), contourElev + 0.2));
                 points.push(new THREE.Vector3(positions.getX(j+1), positions.getY(j+1), contourElev + 0.2));
           }
        }
        lineGeom.setFromPoints(points);
        
        const fatLineGeom = new WireframeGeometry2(lineGeom);
        const contourLine = new Wireframe(fatLineGeom, contourMaterial);
        geoGroup.add(contourLine);
      }
    }
    
    // Create boundary line
    const boundaryLinePoints = boundary.path.map(p => {
        const local = geoUtils.toLocal(p.lat, p.lng);
        const elev = getElevationAt(local.x, local.y);
        return new THREE.Vector3(local.x, local.y, elev + 0.5); // Slightly elevated
    });
    
    const boundaryLineGeom = new THREE.BufferGeometry().setFromPoints([...boundaryLinePoints, boundaryLinePoints[0]]);
    const boundaryLineMat = new LineMaterial({ 
        color: 0xffeb3b, 
        linewidth: 4, 
        resolution: new THREE.Vector2(mountNode.clientWidth, mountNode.clientHeight),
        dashed: false,
        opacity: 1
    });
    const fatBoundaryGeom = new WireframeGeometry2(boundaryLineGeom);
    const boundaryLine = new Wireframe(fatBoundaryGeom, boundaryLineMat);
    geoGroup.add(boundaryLine);


    // Create zones
    zones.forEach(zone => {
      const zonePoints = zone.path.map(p => {
          const local = geoUtils.toLocal(p.lat, p.lng);
          const elev = getElevationAt(local.x, local.y);
          return new THREE.Vector3(local.x, local.y, elev + 0.4);
      });
      
      const zoneLineGeom = new THREE.BufferGeometry().setFromPoints([...zonePoints, zonePoints[0]]);
      const zoneLineMat = new LineMaterial({ 
        color: 0xff9800,
        linewidth: 2,
        dashed: true,
        dashSize: 5,
        gapSize: 3,
        resolution: new THREE.Vector2(mountNode.clientWidth, mountNode.clientHeight)
      });
      const fatZoneGeom = new WireframeGeometry2(zoneLineGeom);
      const zoneLine = new Wireframe(fatZoneGeom, zoneLineMat);
      geoGroup.add(zoneLine);
    });
    
    // Create assets
    selectableMeshesRef.current = [];
    const assetMaterial = new THREE.MeshStandardMaterial({
      color: 0x009688,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x111111,
    });
    const selectedMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc107,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0xffaa00,
      emissiveIntensity: 0.7
    });

    assets.forEach(asset => {
      const assetShapePoints = asset.path.map(p => {
        const local = geoUtils.toLocal(p.lat, p.lng);
        return new THREE.Vector2(local.x, local.y);
      });
      const assetShape = new THREE.Shape(assetShapePoints);
      const extrudeSettings = { depth: 5, bevelEnabled: false };
      const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
      
      const localCenter = getPolygonCenter(asset.path);
      const localPos = geoUtils.toLocal(localCenter.lat, localCenter.lng);
      const baseElevation = getElevationAt(localPos.x, localPos.y);
      
      const assetMesh = new THREE.Mesh(geometry, assetMaterial);
      assetMesh.position.z = baseElevation;
      assetMesh.castShadow = true;
      assetMesh.receiveShadow = true;
      assetMesh.userData = { shape: asset };
      geoGroup.add(assetMesh);
      selectableMeshesRef.current.push(assetMesh);
    });

    // Handle selection highlighting
    if (selectedAsset) {
      const selectedMesh = selectableMeshesRef.current.find(m => m.userData.shape.id === selectedAsset.shape.id);
      if (selectedMesh) {
        selectedMesh.material = selectedMaterial;
      }
    }
    
    // Set camera position
    const center = new THREE.Vector3((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2, (minElev + elevRange / 4) * exaggeration);
    camera.position.set(center.x, center.y - boundaryHeight * 1.5, center.z + boundaryHeight * 1.2);
    camera.lookAt(center);
    orbitControls.target.copy(center);

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', onResize);
    
    // Animation loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      orbitControls.update();
      lod.update(camera);
      
      // Performance monitoring
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      if (delta >= 1000) {
        const fps = frameCountRef.current;
        setPerformanceStats({
          fps: fps,
          triangles: renderer.info.render.triangles,
          drawCalls: renderer.info.render.calls
        });
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      mountNode.removeEventListener('mousemove', onMouseMove);
      mountNode.removeEventListener('click', onMouseClick);
      
      // Dispose Three.js objects
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material: THREE.Material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      pmremGenerator.dispose();
      
      if (mountNode && renderer.domElement && mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [boundary, elevationGrid, assets, zones, geoUtils, settings, selectedAsset, onKeyDown, onDeleteAsset]);
  
  return (
    <div className="w-full h-full relative" ref={mountRef}>
      <Compass rotation={compassRotation} elevation={cameraElevation} />
      <ElevationStats {...elevationStats} currentElev={cursorElevation} />
      {settings.showPerformance && <PerformanceMonitor {...performanceStats} />}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="absolute top-4 left-4 bg-background/80 backdrop-blur-md">
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 ml-4 space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Visualization Settings</h4>
            <p className="text-sm text-muted-foreground">Adjust the look and performance.</p>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="perf-mode">Show Performance</Label>
              <Switch id="perf-mode" checked={settings.showPerformance} onCheckedChange={c => setSettings(s => ({...s, showPerformance: c}))} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wireframe-mode">Show Wireframe</Label>
              <Switch id="wireframe-mode" checked={settings.showWireframe} onCheckedChange={c => setSettings(s => ({...s, showWireframe: c}))} />
            </div>
             <div className="flex items-center justify-between">
              <Label htmlFor="contours-mode">Show Contours</Label>
              <Switch id="contours-mode" checked={settings.showContours} onCheckedChange={c => setSettings(s => ({...s, showContours: c}))} />
            </div>
            <div className="space-y-2">
              <Label>Terrain Exaggeration: {settings.terrainExaggeration.toFixed(1)}x</Label>
              <Slider 
                defaultValue={[1.2]} 
                value={[settings.terrainExaggeration]}
                min={0.1} max={5} step={0.1} 
                onValueChange={([v]) => setSettings(s => ({...s, terrainExaggeration: v}))}
              />
            </div>
             <div className="space-y-2">
              <Label>Sun Intensity: {settings.sunIntensity.toFixed(1)}</Label>
              <Slider 
                defaultValue={[1.8]} 
                value={[settings.sunIntensity]}
                min={0} max={5} step={0.1} 
                onValueChange={([v]) => setSettings(s => ({...s, sunIntensity: v}))}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedAsset && (
        <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-primary/50">
           <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-primary" />
            <span className="font-bold text-base">Selected Asset</span>
          </div>
          <p className="text-sm text-muted-foreground">ID: {selectedAsset.shape.id}</p>
          <Button 
            variant="destructive" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => {
              onDeleteAsset(selectedAsset.shape.id);
              setSelectedAsset(null);
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
