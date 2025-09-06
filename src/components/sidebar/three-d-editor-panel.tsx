
'use client';

import React, { useState } from 'react';
import type { Shape, Tool } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Building, Trash2, Bot, Layers, Plus, Minus, Grid3x3, Palette, Satellite, Fence } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uuid } from '@/components/map/map-canvas';
import * as turf from '@turf/turf';
import { cn } from '@/lib/utils';


interface ThreeDEditorPanelProps {
    shapes: Shape[];
    setShapes: (shapes: Shape[] | ((prev: Shape[]) => Shape[])) => void;
    selectedAssetId: string | null;
    setSelectedAssetId: (id: string | null) => void;
    onDeleteAsset: (assetId: string) => void;
    setSelectedTool: (tool: Tool) => void;
    setAutofillTemplate: (asset: Shape | null) => void;
    groundStyle: 'satellite' | 'color' | 'texture';
    setGroundStyle: (style: 'satellite' | 'color' | 'texture') => void;
    groundColor: [number, number, number];
    setGroundColor: (color: [number, number, number]) => void;
}

const groundColors = {
    'Sand': [228, 215, 189] as [number, number, number],
    'Grass': [134, 172, 126] as [number, number, number],
    'Earth': [147, 122, 102] as [number, number, number],
    'Concrete': [189, 189, 189] as [number, number, number],
};

export function ThreeDEditorPanel({ 
    shapes, 
    setShapes,
    selectedAssetId, 
    setSelectedAssetId, 
    onDeleteAsset,
    setSelectedTool,
    setAutofillTemplate,
    groundStyle,
    setGroundStyle,
    groundColor,
    setGroundColor
}: ThreeDEditorPanelProps) {
    
    const { toast } = useToast();
    const selectedAsset = shapes.find(s => s.id === selectedAssetId);
    const buildings = shapes.filter(s => s.assetMeta?.assetType === 'building');

    const updateAsset = (id: string, updates: Partial<Shape['assetMeta']>) => {
        setShapes(prev => prev.map(s => {
            if (s.id === id && s.assetMeta) {
                const newMeta = { ...s.assetMeta, ...updates };

                if (updates.width || updates.depth || updates.rotation !== undefined) {
                    const center = turf.center(turf.polygon([s.path.map(p => [p.lng, p.lat])])).geometry.coordinates;
                    const width = (newMeta.width || s.assetMeta.width || 10);
                    const depth = (newMeta.depth || s.assetMeta.depth || 8);
                    const rotation = newMeta.rotation === undefined ? s.assetMeta.rotation : newMeta.rotation;
                    
                    const horizontalDistance = width / (111.32 * Math.cos(center[1] * (Math.PI / 180)));
                    const verticalDistance = depth / 111.32;
                    
                    const xmin = center[0] - horizontalDistance/2000;
                    const xmax = center[0] + horizontalDistance/2000;
                    const ymin = center[1] - verticalDistance/2000;
                    const ymax = center[1] + verticalDistance/2000;

                    const newPoly = turf.transformRotate(turf.bboxPolygon([xmin, ymin, xmax, ymax]), rotation, { pivot: center });

                    const newPath = newPoly.geometry.coordinates[0].map((c: number[]) => ({lat: c[1], lng: c[0]}));
                    
                    return { ...s, path: newPath, assetMeta: newMeta };
                }
                
                return { ...s, assetMeta: newMeta };
            }
            return s;
        }));
    };
    
    const handleStartAutofill = () => {
        if (!selectedAsset) return;
        setAutofillTemplate(selectedAsset);
        setSelectedTool('autofill');
        toast({
            title: 'Start Drawing Autofill Area',
            description: 'Click points on the map to define an area. Double-click to finish.',
        });
    };

    const handleFloorsChange = (newFloors: number) => {
        if (!selectedAssetId || newFloors < 1) return;
        updateAsset(selectedAssetId, { floors: newFloors });
    };

    const handleRotationChange = (newRotation: number[]) => {
        if (!selectedAssetId) return;
        updateAsset(selectedAssetId, { rotation: newRotation[0] });
    };
    
    const handleDimensionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedAssetId) return;
        const { id, value } = e.target;
        updateAsset(selectedAssetId, { [id]: parseFloat(value) || 0 });
    };
    
    const handleAiAssist = () => {
        if (!selectedAsset || !selectedAsset.assetMeta) return;

        const { rotation = 0, width = 10, depth = 10, floors } = selectedAsset.assetMeta;
        
        const edgeMidpoint = turf.midpoint(
            turf.point(selectedAsset.path[1].lng, selectedAsset.path[1].lat),
            turf.point(selectedAsset.path[2].lng, selectedAsset.path[2].lat)
        );

        const distance = Math.max(width, depth) + 5;
        const newCenter = turf.destination(edgeMidpoint, distance / 1000, rotation + 90);
       
        const centerCoords = newCenter.geometry.coordinates;

        const horizontalDistance = width / (111.32 * Math.cos(centerCoords[1] * (Math.PI / 180)));
        const verticalDistance = depth / 111.32;
        
        const xmin = centerCoords[0] - horizontalDistance/2000;
        const xmax = centerCoords[0] + horizontalDistance/2000;
        const ymin = centerCoords[1] - verticalDistance/2000;
        const ymax = centerCoords[1] + verticalDistance/2000;

        const newPoly = turf.transformRotate(turf.bboxPolygon([xmin, ymin, xmax, ymax]), rotation, { pivot: centerCoords });
        const newPath = newPoly.geometry.coordinates[0].map((c: number[]) => ({lat: c[1], lng: c[0]}));
        
        const newBuilding: Shape = {
          id: uuid(),
          type: 'rectangle',
          path: newPath,
          area: width * depth,
          assetMeta: { assetType: 'building', key: 'default_building', floors, rotation, width, depth },
        };

        setShapes(prev => [...prev, newBuilding]);
        toast({
          title: 'AI Assist',
          description: 'Placed an adjacent building.',
        });
    };
    
    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                            <span>3D Editor</span>
                            <Building className="h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription>
                            Select a building to modify it, or use the tool palette to place new ones.
                        </CardDescription>
                    </CardHeader>
                    {buildings.length > 0 && (
                         <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Site contains {buildings.length} building{buildings.length > 1 ? 's' : ''}.
                            </p>
                        </CardContent>
                    )}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                           <span>Ground Style</span>
                           <Palette className="h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription>
                           Customize the appearance of the terrain.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                             <Button variant={groundStyle === 'satellite' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setGroundStyle('satellite')}>
                                <Satellite className="mr-2 h-4 w-4" />
                                Satellite
                             </Button>
                             <Button variant={groundStyle === 'color' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setGroundStyle('color')}>
                                <Palette className="mr-2 h-4 w-4" />
                                Color
                             </Button>
                             <Button variant={groundStyle === 'texture' ? 'default' : 'outline'} size="sm" className="flex-1" onClick={() => setGroundStyle('texture')}>
                                <Fence className="mr-2 h-4 w-4" />
                                Texture
                             </Button>
                        </div>
                        {groundStyle === 'color' && (
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                {Object.entries(groundColors).map(([name, color]) => (
                                    <Button key={name} variant="outline" size="sm" onClick={() => setGroundColor(color)} className={cn(
                                        "justify-start",
                                        groundColor[0] === color[0] && groundColor[1] === color[1] && "border-primary ring-2 ring-primary"
                                    )}>
                                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: `rgb(${color.join(',')})` }} />
                                        {name}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                           <span>Autofill Area</span>
                           <Grid3x3 className="h-5 w-5 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription>
                            Select a building, then draw an area to fill it with copies.
                         </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button 
                            className="w-full"
                            onClick={handleStartAutofill}
                            disabled={!selectedAsset}
                        >
                            <Layers className="mr-2 h-4 w-4" />
                            Start Autofill Area
                        </Button>
                    </CardContent>
                </Card>

                {selectedAsset && selectedAsset.assetMeta && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Selected Building</CardTitle>
                            <CardDescription className="text-xs break-all">ID: {selectedAsset.id}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="width">Width (m)</Label>
                                    <Input 
                                        id="width" 
                                        type="number" 
                                        value={selectedAsset.assetMeta.width || ''} 
                                        onChange={handleDimensionChange} 
                                        className="h-8"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="depth">Depth (m)</Label>
                                    <Input 
                                        id="depth" 
                                        type="number" 
                                        value={selectedAsset.assetMeta.depth || ''} 
                                        onChange={handleDimensionChange} 
                                        className="h-8"
                                    />
                                </div>
                            </div>
                            
                             <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="rotation">Rotation</Label>
                                    <span className="text-xs font-mono">{selectedAsset.assetMeta.rotation}°</span>
                                </div>
                                <Slider 
                                    id="rotation"
                                    min={0} max={360} step={1} 
                                    value={[selectedAsset.assetMeta.rotation || 0]}
                                    onValueChange={handleRotationChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="floors">Floors</Label>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleFloorsChange((selectedAsset.assetMeta!.floors || 1) - 1)}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input 
                                        id="floors"
                                        type="number" 
                                        className="h-8 text-center"
                                        value={selectedAsset.assetMeta.floors}
                                        onChange={(e) => handleFloorsChange(parseInt(e.target.value, 10) || 1)}
                                        min={1}
                                    />
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleFloorsChange((selectedAsset.assetMeta!.floors || 1) + 1)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <Button variant="outline" className="w-full" onClick={handleAiAssist}>
                                <Bot className="h-4 w-4 mr-2" />
                                AI Assist: Place Adjacent
                            </Button>
                           
                            <Button 
                                variant="destructive"
                                className="w-full"
                                onClick={() => onDeleteAsset(selectedAsset.id)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Building
                            </Button>
                        </CardContent>
                     </Card>
                )}

            </div>
        </ScrollArea>
    );
}

