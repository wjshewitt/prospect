
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { LayoutGrid, Loader2 } from 'lucide-react';

export type PlannerSettings = {
  density: 'low' | 'medium' | 'high' | 'very-high';
  layout: 'grid' | 'cul-de-sac' | 'radial' | 'organic' | 'linear' | 'cluster' | 'mixed';
  roadStyle: 'connect-neighbors' | 'trunk-branch';
  greenSpaceType: 'none' | 'distributed' | 'central' | 'perimeter';
  seed: string;
  roadSetback: number;
  siteSetback: number;
  minBuildingSize: number;
  maxBuildingSize: number;
  spacing: number;
  buildingShape: 'rectangle' | 'l-shape' | 't-shape' | 'mixed';
};

interface ProceduralPlannerPanelProps {
  onGenerate: (settings: PlannerSettings) => void;
  isGenerating: boolean;
  isReady: boolean;
}

export function ProceduralPlannerPanel({ onGenerate, isGenerating, isReady }: ProceduralPlannerPanelProps) {
  const [settings, setSettings] = useState<PlannerSettings>({
    density: 'medium',
    layout: 'organic',
    roadStyle: 'trunk-branch',
    greenSpaceType: 'central',
    seed: '',
    roadSetback: 6,
    siteSetback: 5,
    minBuildingSize: 100,
    maxBuildingSize: 500,
    spacing: 10,
    buildingShape: 'mixed',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [id]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleSelectChange = (id: keyof PlannerSettings) => (value: string) => {
    setSettings(prev => ({ ...prev, [id]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Procedural Planner</span>
          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Generate a complete site layout including roads, parcels, and buildings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isReady && (
          <CardDescription className="text-center text-xs pt-2">
            Please draw a project boundary on the map to enable the planner.
          </CardDescription>
        )}
        {isReady && (
          <>
            <div className="space-y-2">
              <Label htmlFor="density">Density Level</Label>
              <Select onValueChange={handleSelectChange('density')} defaultValue={settings.density}>
                <SelectTrigger id="density"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="very-high">Very High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout">Layout Pattern</Label>
              <Select onValueChange={handleSelectChange('layout')} defaultValue={settings.layout}>
                <SelectTrigger id="layout"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="organic">Organic</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                   <SelectItem value="cul-de-sac">Cul-de-sac</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="greenSpaceType">Green Space</Label>
              <Select onValueChange={handleSelectChange('greenSpaceType')} defaultValue={settings.greenSpaceType}>
                <SelectTrigger id="greenSpaceType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="central">Central Park</SelectItem>
                  <SelectItem value="distributed">Distributed Pockets</SelectItem>
                   <SelectItem value="perimeter">Perimeter Greenbelt</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
                <Label htmlFor="seed">Seed (Optional)</Label>
                <Input
                    id="seed"
                    value={settings.seed}
                    onChange={handleInputChange}
                    placeholder="e.g., 12345"
                />
            </div>
            <Button className="w-full" onClick={() => onGenerate(settings)} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LayoutGrid className="mr-2 h-4 w-4" />}
              Generate Full Layout
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
