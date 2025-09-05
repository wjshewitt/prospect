
'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp, Layers, MousePointer, Settings, Mountain, Grid3x3 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  terrainQuality: 'low' | 'medium' | 'high';
  showWireframe: boolean;
  showGrid: boolean;
  showShadows: boolean;
  terrainExaggeration: number;
}

interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
  onDeleteAsset: (assetId: string) => void;
}

const getLocalXY = (p: LatLng, center: LatLng) => {
    const R = 6378137;
    const dx = (p.lng - center.lng) * (Math.PI / 180) * R * Math.cos(center.lat * Math.PI / 180);
    const dy = (p.lat - center.lat) * (Math.PI / 180) * R;
    return { x: dx, y: dy };
};

export function ThreeDVisualizationModal({
  assets,
  zones,
  boundary,
  elevationGrid,
  onDeleteAsset
}: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  
  const [compassRotation, setCompassRotation] = useState(0);
  const [cameraElevation, setCameraElevation] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<{mesh: THREE.Mesh, shape: Shape} | null>(null);
  const [elevationStats, setElevationStats] = useState({ min: 0, max: 0, range: 0 });
  const [cursorElevation, setCursorElevation] = useState<number | undefined>();
  const [performanceStats, setPerformanceStats] = useState({ fps: 60, triangles: 0, drawCalls: 0 });
  const [settings, setSettings] = useState<VisualizationSettings>({
    terrainQuality: 'medium',
    showWireframe: false,
    showGrid: false,
    showShadows: true,
    terrainExaggeration: 1.5,
  });

  const [showSettings, setShowSettings] = useState(false);
  const center = useMemo(() => getPolygonCenter(boundary.path), [boundary.path]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAsset) {
      onDeleteAsset(selectedAsset.shape.id);
      setSelectedAsset(null);
    }
  }, [selectedAsset, onDeleteAsset]);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);


  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;
    
    const mountNode = mountRef.current;
    let animationFrameId: number;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0005);
    
    const camera = new THREE.PerspectiveCamera(60, mountNode.clientWidth / mountNode.clientHeight, 0.1, 50000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, alpha: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = settings.showShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;
    mountNode.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(200, 400, 150);
    sunLight.castShadow = settings.showShadows;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 2000;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.1;
    const updateCameraInfo = () => {
      const vector = new THREE.Vector3();
      camera.getWorldDirection(vector);
      const angle = Math.atan2(vector.x, vector.z);
      setCompassRotation(angle);
      const elevation = Math.asin(vector.y);
      setCameraElevation(elevation * 180 / Math.PI);
    };
    orbitControls.addEventListener('change', updateCameraInfo);
    updateCameraInfo();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectableMeshes: THREE.Mesh[] = [];
    let terrainMesh: THREE.Mesh | null = null;
    
    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      if (terrainMesh) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
          setCursorElevation(intersects[0].point.z);
        } else {
          setCursorElevation(undefined);
        }
      }
    };
    const onMouseClick = (event: MouseEvent) => {
        if (!renderer.domElement.parentElement?.contains(event.target as Node)) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(selectableMeshes);
        if (intersects.length > 0 && intersects[0].object instanceof THREE.Mesh) {
            const shape = (intersects[0].object.userData as {shape: Shape}).shape;
            setSelectedAsset({mesh: intersects[0].object, shape});
        } else {
            setSelectedAsset(null);
        }
    };
    mountNode.addEventListener('mousemove', onMouseMove);
    mountNode.addEventListener('click', onMouseClick);
    
    const geoGroup = new THREE.Group();
    scene.add(geoGroup);

    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;
    let minElev = Infinity, maxElev = -Infinity;
    grid.forEach(e => {
        if (isFinite(e)) {
            minElev = Math.min(minElev, e);
            maxElev = Math.max(maxElev, e);
        }
    });
    const elevRange = maxElev - minElev;
    setElevationStats({ min: minElev, max: maxElev, range: elevRange });

    const getElevationAt = (x: number, y: number) => {
        if (!grid || nx < 2 || ny < 2) return minElev * settings.terrainExaggeration;
        const u = ((x - minX) / (maxX - minX)) * (nx - 1);
        const v = ((y - minY) / (maxY - minY)) * (ny - 1);
        const i = Math.floor(u);
        const j = Math.floor(v);
        if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) return minElev * settings.terrainExaggeration;
        const s = u - i;
        const t = v - j;
        const z00 = (grid[j * nx + i] || minElev);
        const z10 = (grid[j * nx + i + 1] || minElev);
        const z01 = (grid[(j + 1) * nx + i] || minElev);
        const z11 = (grid[(j + 1) * nx + i + 1] || minElev);
        const z_t = z00 * (1 - s) + z10 * s;
        const z_b = z01 * (1 - s) + z11 * s;
        return (z_t * (1 - t) + z_b * t) * settings.terrainExaggeration;
    };
    
    const gridResolution = settings.terrainQuality === 'high' ? 128 : settings.terrainQuality === 'medium' ? 64 : 32;
    const terrainGeometry = new THREE.PlaneGeometry(maxX - minX, maxY - minY, gridResolution, gridResolution);
    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + (minX + maxX) / 2;
        const y = positions.getY(i) + (minY + maxY) / 2;
        positions.setZ(i, getElevationAt(x, y));
    }
    terrainGeometry.computeVertexNormals();

    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
        const z = positions.getZ(i);
        const h = (z / settings.terrainExaggeration - minElev) / (elevRange || 1);
        const color = new THREE.Color();
        color.setHSL(0.3 - h * 0.2, 0.5, 0.4 + h * 0.2);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const terrainMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.1,
        wireframe: settings.showWireframe,
    });

    const mesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, 0);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    geoGroup.add(mesh);
    terrainMesh = mesh;

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.2 });
    assets.forEach(asset => {
        if (asset.assetMeta?.assetType !== 'building') return;
        const assetCenter = getPolygonCenter(asset.path);
        const { x, y } = getLocalXY(assetCenter, center);
        const elevation = getElevationAt(x, y);
        const footprint = asset.path.map(p => {
            const local = getLocalXY(p, assetCenter);
            return new THREE.Vector2(local.x, local.y);
        });
        const shape = new THREE.Shape(footprint);
        const extrudeSettings = { depth: 4 * (asset.assetMeta.floors || 1), bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const buildingMesh = new THREE.Mesh(geometry, buildingMaterial.clone());
        buildingMesh.position.set(x, y, elevation);
        buildingMesh.rotation.x = -Math.PI / 2;
        buildingMesh.rotation.z = (asset.assetMeta.rotation || 0) * Math.PI / 180;
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        buildingMesh.userData = { shape: asset };
        geoGroup.add(buildingMesh);
        selectableMeshes.push(buildingMesh);
    });

    zones.forEach(zone => {
      const zonePoints = zone.path.map(p => {
        const local = getLocalXY(p, center);
        return new THREE.Vector3(local.x, local.y, getElevationAt(local.x, local.y) + 0.5); // 0.5m offset
      });
      const zoneGeom = new THREE.BufferGeometry().setFromPoints(zonePoints);
      const zoneMaterial = new THREE.LineBasicMaterial({
        color: zone.zoneMeta?.kind === 'solar' ? 0xffa500 : 0x00ff00,
        linewidth: 2,
        transparent: true,
        opacity: 0.7
      });
      const zoneLine = new THREE.Line(zoneGeom, zoneMaterial);
      zoneLine.rotation.x = -Math.PI / 2;
      geoGroup.add(zoneLine);
    });

    camera.position.set(0, (maxX - minX) * 1.2, maxElev + 50);
    orbitControls.target.set(0, 0, (minElev + maxElev) / 2);

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        orbitControls.update();
        frameCountRef.current++;
        const now = performance.now();
        const delta = now - lastTimeRef.current;
        if (delta > 1000) {
            const fps = frameCountRef.current / (delta / 1000);
            const { triangles, calls } = renderer.info.render;
            setPerformanceStats({ fps, triangles, drawCalls: calls });
            lastTimeRef.current = now;
            renderer.info.reset();
        }
        renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountNode) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        mountNode.removeEventListener('mousemove', onMouseMove);
        mountNode.removeEventListener('click', onMouseClick);
        cancelAnimationFrame(animationFrameId);
        orbitControls.dispose();
        if (rendererRef.current) {
          if (mountNode.contains(rendererRef.current.domElement)) {
            mountNode.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        geoGroup.clear();
        scene.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary, elevationGrid, assets, zones, settings]);

  useEffect(() => {
    selectableMeshes.forEach(mesh => {
        if(mesh.id === selectedAsset?.mesh.id) {
             (mesh.material as THREE.MeshStandardMaterial).color.set(0xffa500); // Orange for selected
        } else {
            (mesh.material as THREE.MeshStandardMaterial).color.set(0xcccccc); // Gray
        }
    });

    const currentSelectedMesh = selectedAsset?.mesh;
    return () => {
        if(currentSelectedMesh) {
            (currentSelectedMesh.material as THREE.MeshStandardMaterial).color.set(0xcccccc);
        }
    }
}, [selectedAsset]);

  const selectableMeshes = useMemo(() => {
      const meshes: THREE.Mesh[] = [];
      const scene = mountRef.current?.getElementsByTagName('canvas')[0]?.parentElement; // Not ideal, but works for this
      if(scene) {
          scene.traverse(obj => {
              if(obj instanceof THREE.Mesh && obj.userData.shape) {
                  meshes.push(obj);
              }
          })
      }
      return meshes;
  }, [assets]); // Re-evaluate when assets change

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <Compass rotation={compassRotation} elevation={cameraElevation} />
      <ElevationStats {...elevationStats} currentElev={cursorElevation} />
      <Popover open={showSettings} onOpenChange={setShowSettings}>
        <PopoverTrigger asChild>
            <Button size="icon" variant="outline" className="absolute top-24 right-4"><Settings /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">3D View Settings</h4>
                    <p className="text-sm text-muted-foreground">Adjust visualization parameters.</p>
                </div>
                <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="wireframe">Wireframe</Label>
                        <Switch id="wireframe" checked={settings.showWireframe} onCheckedChange={(c) => setSettings(s => ({ ...s, showWireframe: c }))} />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="shadows">Shadows</Label>
                        <Switch id="shadows" checked={settings.showShadows} onCheckedChange={(c) => setSettings(s => ({ ...s, showShadows: c }))} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="exaggeration">Terrain Exaggeration: {settings.terrainExaggeration.toFixed(1)}x</Label>
                        <Slider id="exaggeration" min={0.1} max={5} step={0.1} value={[settings.terrainExaggeration]} onValueChange={([v]) => setSettings(s => ({...s, terrainExaggeration: v}))} />
                    </div>
                </div>
            </div>
        </PopoverContent>
      </Popover>
      {performanceStats.fps < 50 && (
          <PerformanceMonitor {...performanceStats} />
      )}
    </div>
  );
}

    