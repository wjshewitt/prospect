
'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Shape, LatLng, ElevationGrid } from '@/lib/types';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';


interface ThreeDVisualizationProps {
  assets: Shape[];
  zones: Shape[];
  boundary: Shape;
  elevationGrid: ElevationGrid;
}

// Helper to calculate the center of a polygon - MUST be inside useEffect
const getPolygonCenter = (path: LatLng[]): LatLng => {
    if (!window.google || !window.google.maps) {
      // Return a default if google maps is not loaded
      return path[0] || { lat: 0, lng: 0};
    }
    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    return bounds.getCenter().toJSON();
};

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
        
        updateCompass();

        const controls = (camera as any).__orbitControls;
        if(controls) {
            controls.addEventListener('change', updateCompass);
            return () => controls.removeEventListener('change', updateCompass);
        }

    }, [camera]);


    return (
        <div className="absolute bottom-4 right-4 w-16 h-16 bg-background/50 rounded-full flex items-center justify-center text-foreground backdrop-blur-sm shadow-lg">
            <div 
                className="relative w-full h-full"
                style={{ transform: `rotate(${-rotation}rad)` }}
            >
                <div className="absolute top-1 left-1/2 -translate-x-1/2 font-bold text-lg">N</div>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm">S</div>
                <div className="absolute left-1 top-1/2 -translate-y-1/2 text-sm">W</div>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 text-sm">E</div>
            </div>
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <ArrowUp className="w-6 h-6 text-red-500" />
            </div>
        </div>
    )
}

export function ThreeDVisualizationModal({ assets, zones, boundary, elevationGrid }: ThreeDVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    if (!mountRef.current || !boundary || !elevationGrid || !elevationGrid.pointGrid) return;

    const mountNode = mountRef.current;
    
    // --- Scene Setup ---
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(60, mountNode.clientWidth / mountNode.clientHeight, 1, 20000);
    setCamera(camera);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    // --- Rendering Quality Improvements ---
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // More realistic lighting
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    const canvasElement = renderer.domElement;
    mountNode.appendChild(canvasElement);

    // --- Skybox Background ---
    const loader = new THREE.CubeTextureLoader();
    // IMPORTANT: Replace these with paths to your actual skybox images
    const skyboxTexture = loader.load([
        'https://threejs.org/examples/textures/cube/Bridge2/px.jpg', // right
        'https://threejs.org/examples/textures/cube/Bridge2/nx.jpg', // left
        'https://threejs.org/examples/textures/cube/Bridge2/py.jpg', // top
        'https://threejs.org/examples/textures/cube/Bridge2/ny.jpg', // bottom
        'https://threejs.org/examples/textures/cube/Bridge2/pz.jpg', // front
        'https://threejs.org/examples/textures/cube/Bridge2/nz.jpg'  // back
    ], () => {
        scene.background = skyboxTexture;
    }, undefined, () => {
        // Fallback if textures fail to load
        scene.background = new THREE.Color(0x1a2638);
    });


    // --- Lighting ---
    // Use HemisphereLight for more natural ambient light
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1.2);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(-250, 300, 200);
    directionalLight.castShadow = true;
    // Configure shadow properties for better quality
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    scene.add(directionalLight);
    
    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    (camera as any).__orbitControls = controls;
    
    // --- Coordinate System & Projections ---
    const siteCenter = getPolygonCenter(boundary.path);
    const proj = {
        toLocal: (p: LatLng) => {
            const R = 6371e3;
            const φ1 = siteCenter.lat * Math.PI/180;
            const dLat = (p.lat-siteCenter.lat) * Math.PI/180;
            const dLng = (p.lng-siteCenter.lng) * Math.PI/180;
            const x = dLng * R * Math.cos(φ1);
            const y = dLat * R;
            return { x, y: -y };
        },
    };

    // --- Elevation Data Interpolation ---
    const { grid, nx, ny } = elevationGrid.pointGrid!;
    const { minX, maxX, minY, maxY } = elevationGrid.xyBounds!;
    
    const getElevationAt = (x: number, y: number): number => {
        if (!grid || nx < 2 || ny < 2) return 0;
        const u = ((x - minX) / (maxX - minX)) * (nx - 1);
        const v = ((y - minY) / (maxY - minY)) * (ny - 1);
        const i = Math.floor(u);
        const j = Math.floor(v);
        if (i < 0 || i >= nx - 1 || j < 0 || j >= ny - 1) return 0;
        const s = u - i;
        const t = v - j;
        const z00 = grid[j * nx + i];
        const z10 = grid[j * nx + i + 1];
        const z01 = grid[(j + 1) * nx + i];
        const z11 = grid[(j + 1) * nx + i + 1];
        if (!isFinite(z00) || !isFinite(z10) || !isFinite(z01) || !isFinite(z11)) return 0;
        const z0 = z00 * (1 - s) + z10 * s;
        const z1 = z01 * (1 - s) + z11 * s;
        return z0 * (1 - t) + z1 * t;
    };
    
    // --- Create Topographic Terrain Mesh ---
    const terrainDivisions = 200;
    const terrainGeometry = new THREE.PlaneGeometry(
        maxX - minX, maxY - minY, terrainDivisions, terrainDivisions
    );
    terrainGeometry.rotateX(-Math.PI / 2);
    const positions = terrainGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) + minX + (maxX-minX)/2;
        const z = positions.getZ(i) - minY - (maxY-minY)/2;
        const y = getElevationAt(x, -z);
        positions.setY(i, y);
    }
    terrainGeometry.computeVertexNormals();

    // --- Create Terrain Texture with Grass and Zones ---
    const textureLoader = new THREE.TextureLoader();
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x556B2F, // Fallback color
        side: THREE.DoubleSide 
    });

    const grassTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        const textureCanvas = document.createElement('canvas');
        const textureSize = 2048;
        textureCanvas.width = textureSize;
        textureCanvas.height = textureSize;
        const textureContext = textureCanvas.getContext('2d')!;
        
        const pattern = textureContext.createPattern(texture.image, 'repeat');
        textureContext.fillStyle = pattern!;
        textureContext.fillRect(0, 0, textureSize, textureSize);

        const worldToTexture = (x: number, y: number) => {
            const u = (x - minX) / (maxX - minX);
            const v = 1 - ((y - minY) / (maxY - minY));
            return { u: u * textureSize, v: v * textureSize };
        };

        zones.forEach(zone => {
            const kind = zone.zoneMeta?.kind;
            let color = 'rgba(255, 255, 255, 0.4)';
            if (kind === 'residential') color = 'rgba(134, 239, 172, 0.4)';
            if (kind === 'commercial') color = 'rgba(147, 197, 253, 0.4)';
            if (kind === 'amenity') color = 'rgba(252, 211, 77, 0.4)';
            
            textureContext.fillStyle = color;
            textureContext.beginPath();
            zone.path.forEach((p, index) => {
                const local = proj.toLocal(p);
                const texCoords = worldToTexture(local.x, local.y);
                if (index === 0) textureContext.moveTo(texCoords.u, texCoords.v);
                else textureContext.lineTo(texCoords.u, texCoords.v);
            });
            textureContext.closePath();
            textureContext.fill();
        });

        const finalTexture = new THREE.CanvasTexture(textureCanvas);
        groundMaterial.map = finalTexture;
        groundMaterial.needsUpdate = true;
    });

    const terrainMesh = new THREE.Mesh(terrainGeometry, groundMaterial);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // --- Camera and Shadow Frustum Adjustment ---
    const terrainBbox = new THREE.Box3().setFromObject(terrainMesh);
    const terrainCenter = terrainBbox.getCenter(new THREE.Vector3());
    const terrainSize = terrainBbox.getSize(new THREE.Vector3());
    const cameraDistance = Math.max(terrainSize.x, terrainSize.z) * 1.5;
    
    camera.position.copy(terrainCenter);
    camera.position.y += cameraDistance / 1.5;
    camera.position.z += cameraDistance;
    camera.lookAt(terrainCenter);
    controls.target.copy(terrainCenter);

    const shadowCamSize = Math.max(terrainSize.x, terrainSize.z);
    directionalLight.shadow.camera.left = -shadowCamSize / 2;
    directionalLight.shadow.camera.right = shadowCamSize / 2;
    directionalLight.shadow.camera.top = shadowCamSize / 2;
    directionalLight.shadow.camera.bottom = -shadowCamSize / 2;
    directionalLight.shadow.camera.updateProjectionMatrix();

    // --- Render Assets on the terrain ---
    assets.forEach(asset => {
        if (!asset.assetMeta) return;

        const assetCenter = getPolygonCenter(asset.path);
        const localPos = proj.toLocal(assetCenter);
        const elevation = getElevationAt(localPos.x, localPos.y);

        const assetVertices = asset.path.map(p => {
            const local = proj.toLocal(p);
            return new THREE.Vector2(local.x - localPos.x, local.y - localPos.y);
        });
        const assetShape = new THREE.Shape(assetVertices);

        const floors = asset.assetMeta.floors ?? 1;
        const height = floors * 3.5;
        const extrudeSettings = { depth: height, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 };
        const geometry = new THREE.ExtrudeGeometry(assetShape, extrudeSettings);
        
        const material = new THREE.MeshStandardMaterial({
            color: asset.assetMeta.key?.includes('house') ? 0x8B4513 : 0xB0B0B0,
            metalness: 0.1,
            roughness: 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // --- ROTATION FIX ---
        // 1. Orient the extruded geometry to stand up (it's created in XY plane, we want it on XZ)
        mesh.rotation.x = -Math.PI / 2;
        
        // 2. Use a group to handle world position and rotation correctly
        const group = new THREE.Object3D();
        group.add(mesh);
        
        // 3. Position the group at the asset's location
        group.position.set(localPos.x, elevation, localPos.y);
        
        // 4. Apply the 'yaw' rotation around the world Y-axis to the group
        const rotationDegrees = asset.assetMeta.rotation ?? 0;
        group.rotation.y = -rotationDegrees * (Math.PI / 180);

        scene.add(group);
    });

    // --- Animation Loop ---
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize Listener ---
    const handleResize = () => {
      if (!mountNode) return;
      camera.aspect = mountNode.clientWidth / mountNode.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountNode.clientWidth, mountNode.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      
      if (scene.background) scene.background.dispose();
      grassTexture.dispose();
      
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    if (material.map) material.map.dispose();
                    material.dispose();
                });
            } else if (object.material) {
                const material = object.material as THREE.Material & { map?: THREE.Texture };
                if (material.map) material.map.dispose();
                material.dispose();
            }
        }
      });
      
      if (mountNode && mountNode.contains(canvasElement)) {
        mountNode.removeChild(canvasElement);
      }
      renderer.dispose();
      setCamera(null);
    };
  }, [assets, zones, boundary, elevationGrid]);

  return (
    <div className="relative w-full h-full bg-black">
        <div ref={mountRef} className="w-full h-full" />
        <Compass camera={camera} />
    </div>
  );
}

    