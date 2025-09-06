
'use client';

import React from 'react';
import type { Shape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Building, Trash2, Pencil, Bot, Layers, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SQ_METERS_TO_SQ_FEET = 10.7639;

interface ThreeDEditorPanelProps {
    shapes: Shape[];
    setShapes: (shapes: Shape[] | ((prev: Shape[]) => Shape[])) => void;
    selectedAssetId: string | null;
    setSelectedAssetId: (id: string | null) => void;
    onDeleteAsset: (assetId: string) => void;
}

export function ThreeDEditorPanel({ 
    shapes, 
    setShapes,
    selectedAssetId, 
    setSelectedAssetId, 
    onDeleteAsset 
}: ThreeDEditorPanelProps) {
    
    const { toast } = useToast();
    const selectedAsset = shapes.find(s => s.id === selectedAssetId);
    const buildings = shapes.filter(s => s.assetMeta?.assetType === 'building');

    const handleFloorsChange = (newFloors: number) => {
        if (!selectedAssetId || newFloors < 1) return;
        setShapes(prev => prev.map(s => {
            if (s.id === selectedAssetId && s.assetMeta) {
                return {
                    ...s,
                    assetMeta: { ...s.assetMeta, floors: newFloors }
                };
            }
            return s;
        }));
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

                {selectedAsset && selectedAsset.assetMeta && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Selected Building</CardTitle>
                            <CardDescription className="text-xs break-all">ID: {selectedAsset.id}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Area */}
                            <div className="flex items-center justify-between text-sm">
                                <Label>Footprint</Label>
                                <span className="font-mono">{(selectedAsset.area || 0).toFixed(1)} m²</span>
                            </div>

                            {/* Floors */}
                            <div className="space-y-2">
                                <Label htmlFor="floors">Floors</Label>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleFloorsChange(selectedAsset.assetMeta!.floors - 1)}>
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
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleFloorsChange(selectedAsset.assetMeta!.floors + 1)}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                           
                            {/* Delete Action */}
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
