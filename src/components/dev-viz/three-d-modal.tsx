
'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Layers, MousePointer, Settings, Mountain, Grid3x3, ChevronsUpDown, Shadows, Sigma } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';


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
  <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm rounded-lg shadow-lg p-2 pointer-events-none z-50">
    <div className="w-16 h-16 relative">
      <div
        className="relative w-full h-full transition-transform duration-200"
        style={{ transform: `rotate(${-rotation}rad)` }}
      >
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 font-bold text-sm text-red-500">N</div>
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">S</div>
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">W</div>
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">E</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <ArrowUp className="w-6 h-6 text-red-500" />
      </div>
    </div>
    <div className="text-xs text-center mt-1 text-muted-foreground">
      {Math.abs(elevation).toFixed(0)}°
    </div>
  </div>
);

// Enhanced elevation stats with gradient visualization
const ElevationStats = ({ min, max, range, currentElev }: { 
  min: number; 
  max: number; 
  range: number;
  currentElev?: number;
}) => (
  <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm p-3 rounded-lg shadow-lg">
    <div className="flex items-center gap-2 mb-2">
      <Mountain className="w-4 h-4" />
      <span className="font-semibold text-sm">Elevation</span>
    </div>
    <div className="space-y-1 text-xs">
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Min:</span>
        <span className="font-mono">{min.toFixed(1)}m</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Max:</span>
        <span className="font-mono">{max.toFixed(1)}m</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Range:</span>
        <span className="font-mono">{range.toFixed(1)}m</span>
      </div>
      {currentElev !== undefined && (
        <div className="flex justify-between gap-4 pt-1 border-t">
          <span className="text-muted-foreground">Cursor:</span>
          <span className="font-mono text-primary">{currentElev.toFixed(1)}m</span>
        </div>
      )}
    </div>
    <div className="mt-2 h-2 bg-gradient-to-r from-green-600 via-yellow-600 to-orange-600 rounded-full" />
  </div>
);

// Performance monitor component
const PerformanceMonitor = ({ fps, triangles, drawCalls }: {
  fps: number;
  triangles: number;
  drawCalls: number;
}) => (
  <div className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm p-2 rounded-lg shadow-lg text-xs space-y-1">
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">FPS:</span>
      <span className={cn("font-mono", fps < 30 ? "text-red-500" : fps < 50 ? "text-yellow-500" : "text-green-500")}>
        {fps.toFixed(0)}
      </span>
    </div>
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Triangles:</span>
      <span className="font-mono">{(triangles / 1000).toFixed(1)}k</span>
    </div>
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Draw Calls:</span>
      <span className="font-mono">{drawCalls}</span>
    </div>
  </div>
);

// Enhanced visualization settings
interface VisualizationSettings {
  terrainQuality: 'low' | 'medium' | 'high' | 'adaptive';
  showWireframe: boolean;
  showShadows: boolean;
  terrainExaggeration: number;
  useLOD: boolean;
  showPerformance: boolean;
}

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
    terrainQuality: 'adaptive',
    showWireframe: false,
    showShadows: true,
    terrainExaggeration: 1.0,
    useLOD: true,
    showPerformance: false,
  });

  // Local projection utility for this component
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
    }
  }, [selectedAsset, onDeleteAsset]);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Main scene setup
  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;
    let animationFrameId: number;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0005);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = settings.showShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    if (mountNode.childNodes.length === 0) {
        mountNode.appendChild(renderer.domElement);
    }
    rendererRef.current = renderer;
    
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountNode.clientWidth / mountNode.clientHeight,
      0.1,
      50000
    );
    cameraRef.current = camera;
    
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF8DC, 1.5);
    sunLight.position.set(200, 400, 150);
    sunLight.castShadow = settings.showShadows;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 2000;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x4F7F14, 0.4);
    scene.add(hemiLight);

    const fillLight1 = new THREE.DirectionalLight(0xFFFFFF, 0.2);
    fillLight1.position.set(-150, 200, -100);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xFFE4B5, 0.15);
    fillLight2.position.set(100, 150, -200);
    scene.add(fillLight2);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.08;
    orbitControls.rotateSpeed = 0.5;
    orbitControls.zoomSpeed = 1.2;
    orbitControls.panSpeed = 0.8;
    orbitControls.screenSpacePanning = true;
    orbitControls.minDistance = 5;
    orbitControls.maxDistance = 5000;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.enablePan = true;

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

    const raycaster = new THREE.Raycaster();
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
          setCursorElevation(point.z);
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

    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;

    let minElev = Infinity, maxElev = -Infinity;
    const validElevations: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (isFinite(grid[i])) {
        minElev = Math.min(minElev, grid[i]);
        maxElev = Math.max(maxElev, grid[i]);
        validElevations.push(grid[i]);
      }
    }
    const elevRange = maxElev - minElev;
    setElevationStats({ min: minElev, max: maxElev, range: elevRange });

    const exaggeration = settings.terrainExaggeration;

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

      const s = u - i;
      const t = v - j;

      const p00 = (grid[j * nx + i] || minElev) * exaggeration;
      const p10 = (grid[j * nx + (i + 1)] || minElev) * exaggeration;
      const p01 = (grid[(j + 1) * nx + i] || minElev) * exaggeration;
      const p11 = (grid[(j + 1) * nx + (i + 1)] || minElev) * exaggeration;
      
      return p00 * (1 - s) * (1 - t) + p10 * s * (1 - t) + p01 * (1 - s) * t + p11 * s * t;
    };

    const boundaryPoints = boundary.path.map(p => {
      const local = geoUtils.toLocal(p.lat, p.lng);
      return { x: local.x, y: local.y };
    });

    let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
    boundaryPoints.forEach(p => {
      bMinX = Math.min(bMinX, p.x);
      bMaxX = Math.max(bMaxX, p.x);
      bMinY = Math.min(bMinY, p.y);
      bMaxY = Math.max(bMaxY, p.y);
    });

    const areaSize = (bMaxX - bMinX) * (bMaxY - bMinY);
    let gridResolution: number;
    
    if (settings.terrainQuality === 'adaptive') {
      if (areaSize < 10000) gridResolution = 150;
      else if (areaSize < 100000) gridResolution = 100;
      else if (areaSize < 1000000) gridResolution = 75;
      else gridResolution = 50;
    } else {
      gridResolution = settings.terrainQuality === 'high' ? 150 : 
                      settings.terrainQuality === 'medium' ? 75 : 30;
    }

    const gridWidth = Math.ceil((bMaxX - bMinX) / 2) * 2;
    const gridHeight = Math.ceil((bMaxY - bMinY) / 2) * 2;
    const segmentsX = Math.max(10, Math.min(gridResolution, gridWidth));
    const segmentsY = Math.max(10, Math.min(gridResolution, gridHeight));

    const lod = new THREE.LOD();
    const lodLevels = [
        { distance: 0, segments: { x: segmentsX, y: segmentsY } },
        { distance: 500, segments: { x: Math.floor(segmentsX / 2), y: Math.floor(segmentsY / 2) } },
        { distance: 1000, segments: { x: Math.floor(segmentsX / 4), y: Math.floor(segmentsY / 4) } },
        { distance: 2000, segments: { x: Math.max(10, Math.floor(segmentsX / 8)), y: Math.max(10, Math.floor(segmentsY / 8)) } }
    ];

    lodLevels.forEach(level => {
      if (level.segments.x < 1 || level.segments.y < 1) return;
      const geom = new THREE.PlaneGeometry(gridWidth, gridHeight, level.segments.x, level.segments.y);
      
      const positions = geom.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + (bMinX + bMaxX) / 2;
        const y = positions.getY(i) + (bMinY + bMaxY) / 2;
        const z = getElevationAt(x, y);
        positions.setZ(i, z);
      }
      geom.computeVertexNormals();
      
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.0,
        wireframe: settings.showWireframe
      });
      
      const colors = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i);
        const normalizedHeight = (z / exaggeration - minElev) / (elevRange || 1);
        
        let color: THREE.Color;
        if (normalizedHeight < 0.2) {
          color = new THREE.Color(0x2D5016).lerp(new THREE.Color(0x4A6F28), normalizedHeight * 5);
        } else if (normalizedHeight < 0.5) {
          color = new THREE.Color(0x4A6F28).lerp(new THREE.Color(0x8B7355), (normalizedHeight - 0.2) * 3.33);
        } else if (normalizedHeight < 0.8) {
          color = new THREE.Color(0x8B7355).lerp(new THREE.Color(0xC4A57B), (normalizedHeight - 0.5) * 3.33);
        } else {
          color = new THREE.Color(0xC4A57B).lerp(new THREE.Color(0xE8DCC6), (normalizedHeight - 0.8) * 5);
        }
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = level.distance === 0;
      mesh.receiveShadow = true;
      mesh.position.set((bMinX + bMaxX) / 2, (bMinY + bMaxY) / 2, 0);
      
      lod.addLevel(mesh, level.distance);
    });
    
    geoGroup.add(lod);
    terrainMesh = lod.children[0] as THREE.Mesh;


    // Draw zones
    zones.forEach(zone => {
      const zoneShape = new THREE.Shape();
      const zonePoints = zone.path.map(p => {
        const local = geoUtils.toLocal(p.lat, p.lng);
        return new THREE.Vector2(local.x, local.y);
      });
      zoneShape.moveTo(zonePoints[0].x, zonePoints[0].y);
      for (let i = 1; i < zonePoints.length; i++) {
        zoneShape.lineTo(zonePoints[i].x, zonePoints[i].y);
      }
      const zoneGeometry = new THREE.ShapeGeometry(zoneShape);
      
      // Drape zone on terrain
      const positions = zoneGeometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        positions.setZ(i, getElevationAt(x, y) + 0.1); // slight offset
      }
      
      const zoneMaterial = new THREE.MeshBasicMaterial({
        color: zone.zoneMeta?.kind === 'residential' ? 0x4ade80 : 0x60a5fa,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
      geoGroup.add(zoneMesh);
    });

    // Draw assets
    const newSelectableMeshes: THREE.Mesh[] = [];
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        const assetCenter = getPolygonCenter(asset.path);
        const localCenter = geoUtils.toLocal(assetCenter.lat, assetCenter.lng);
        const elevation = getElevationAt(localCenter.x, localCenter.y);
        
        let buildingWidth = 8, buildingDepth = 10;
        if(asset.path.length === 4) {
          const p0_ll = geoUtils.toLocal(asset.path[0].lat, asset.path[0].lng);
          const p1_ll = geoUtils.toLocal(asset.path[1].lat, asset.path[1].lng);
          const p3_ll = geoUtils.toLocal(asset.path[3].lat, asset.path[3].lng);
          const p0 = new THREE.Vector2(p0_ll.x, p0_ll.y);
          const p1 = new THREE.Vector2(p1_ll.x, p1_ll.y);
          const p3 = new THREE.Vector2(p3_ll.x, p3_ll.y);
          buildingWidth = p0.distanceTo(p3);
          buildingDepth = p0.distanceTo(p1);
        }

        const height = (asset.assetMeta.floors || 1) * 3; // 3m per floor
        
        const geometry = new THREE.BoxGeometry(buildingWidth, buildingDepth, height);
        const material = new THREE.MeshStandardMaterial({
            color: asset.assetMeta.assetType === 'solar_panel' ? 0x0f172a : 0x78716c,
            roughness: 0.7,
            metalness: 0.1,
        });

        const assetMesh = new THREE.Mesh(geometry, material);
        assetMesh.position.set(localCenter.x, localCenter.y, elevation + height / 2);
        assetMesh.rotation.z = - (asset.assetMeta.rotation || 0) * Math.PI / 180;

        assetMesh.castShadow = true;
        assetMesh.receiveShadow = true;
        assetMesh.userData = { shape: asset };
        newSelectableMeshes.push(assetMesh);
        geoGroup.add(assetMesh);
    });
    selectableMeshesRef.current = newSelectableMeshes;


    // Center camera
    const centerVec = geoUtils.toLocal(geoUtils.center.lat, geoUtils.center.lng);
    const boundingBox = new THREE.Box3().setFromObject(geoGroup);
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    camera.position.set(centerVec.x, centerVec.y - maxDim * 1.2, maxElev + maxDim * 0.8);
    orbitControls.target.set(centerVec.x, centerVec.y, maxElev / 2);
    orbitControls.update();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      orbitControls.update();
      renderer.render(scene, camera);

      // Performance monitoring
      frameCountRef.current++;
      const currentTime = performance.now();
      if (currentTime - lastTimeRef.current >= 1000) {
        setPerformanceStats({
          fps: frameCountRef.current,
          triangles: renderer.info.render.triangles,
          drawCalls: renderer.info.render.calls,
        });
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }
    };
    animate();

    const handleResize = () => {
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      mountNode.removeEventListener('mousemove', onMouseMove);
      mountNode.removeEventListener('click', onMouseClick);
      orbitControls.dispose();
      if (renderer.domElement && mountNode.contains(renderer.domElement)) {
          mountNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      // Clear scene children
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
      });
      while(scene.children.length > 0){ 
        scene.remove(scene.children[0]);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, assets, zones, elevationGrid, geoUtils, settings]);


  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xffea00, side: THREE.BackSide });
  const normalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.7,
      metalness: 0.1,
  }), []);

  useEffect(() => {
    // Reset all to normal material
    selectableMeshesRef.current.forEach(mesh => {
        if (mesh.material !== normalMaterial) mesh.material = normalMaterial;
    });

    if(selectedAsset) {
        const outlineMesh = selectedAsset.mesh.clone();
        outlineMesh.material = outlineMaterial;
        outlineMesh.scale.set(1.05, 1.05, 1.05);
        selectedAsset.mesh.add(outlineMesh);
        
        return () => {
            selectedAsset.mesh.remove(outlineMesh);
        }
    }
  }, [selectedAsset, outlineMaterial, normalMaterial]);


  return (
    <div className="relative w-full h-full bg-blue-200">
      <div ref={mountRef} className="w-full h-full" />
      <Compass rotation={compassRotation} elevation={cameraElevation} />
      <ElevationStats 
        min={elevationStats.min} 
        max={elevationStats.max} 
        range={elevationStats.range}
        currentElev={cursorElevation} 
      />
      
      {/* Visualization Settings Popover */}
      <div className="absolute bottom-4 right-4 z-50">
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full h-12 w-12 shadow-lg">
                    <Settings className="h-6 w-6" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4 space-y-4" side="top" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Viz Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Adjust visual parameters of the 3D model.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wireframe-switch" className="flex items-center gap-2"><Grid3x3 className="h-4 w-4" /> Wireframe</Label>
                    <Switch
                        id="wireframe-switch"
                        checked={settings.showWireframe}
                        onCheckedChange={(checked) => setSettings(s => ({...s, showWireframe: checked}))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="shadow-switch" className="flex items-center gap-2"><Shadows className="h-4 w-4" /> Shadows</Label>
                    <Switch
                        id="shadow-switch"
                        checked={settings.showShadows}
                        onCheckedChange={(checked) => setSettings(s => ({...s, showShadows: checked}))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exaggeration-slider" className="flex items-center gap-2"><ChevronsUpDown className="h-4 w-4" /> Exaggeration</Label>
                    <Slider
                      id="exaggeration-slider"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={[settings.terrainExaggeration]}
                      onValueChange={([val]) => setSettings(s => ({...s, terrainExaggeration: val}))}
                    />
                  </div>
                   <div className="flex items-center justify-between">
                    <Label htmlFor="perf-switch" className="flex items-center gap-2"><Sigma className="h-4 w-4" /> Performance</Label>
                    <Switch
                        id="perf-switch"
                        checked={settings.showPerformance}
                        onCheckedChange={(checked) => setSettings(s => ({...s, showPerformance: checked}))}
                    />
                  </div>
                </div>
            </PopoverContent>
        </Popover>
      </div>

      {settings.showPerformance && (
        <PerformanceMonitor {...performanceStats} />
      )}
       {selectedAsset && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 px-4 rounded-lg shadow-lg text-sm font-semibold">
           Selected: {selectedAsset.shape.assetMeta?.key || 'Building'}
         </div>
       )}
    </div>
  );
}
