
'use client';

import type { Shape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sun, LayoutGrid } from 'lucide-react';
import { useMemo, useState } from 'react';

type SolarAnalysisProps = {
  selectedShapeIds: string[];
  shapes: Shape[];
  onGenerateSolarLayout: (zoneId: string, density: 'low' | 'medium' | 'high') => void;
};

type Density = 'low' | 'medium' | 'high';

export function SolarAnalysis({ selectedShapeIds, shapes, onGenerateSolarLayout }: SolarAnalysisProps) {
  const [density, setDensity] = useState<Density>('medium');

  const selectedSolarZone = useMemo(() => {
    if (selectedShapeIds.length !== 1) return null;
    const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);
    if (selectedShape?.zoneMeta?.kind === 'solar') {
      return selectedShape;
    }
    return null;
  }, [selectedShapeIds, shapes]);

  if (!selectedSolarZone) {
    return null; // Don't render the card if a solar zone isn't selected
  }

  const handleGenerate = () => {
    if (selectedSolarZone) {
      onGenerateSolarLayout(selectedSolarZone.id, density);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Solar Panel Analysis</span>
          <Sun className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Generate a solar panel layout for the selected roof area.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="density">Panel Density</Label>
            <Select onValueChange={(value: Density) => setDensity(value)} defaultValue={density}>
                <SelectTrigger id="density" className="w-full">
                    <SelectValue placeholder="Select density" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="low">Low (~35%)</SelectItem>
                    <SelectItem value="medium">Medium (~55%)</SelectItem>
                    <SelectItem value="high">High (~75%)</SelectItem>
                </SelectContent>
            </Select>
        </div>

        <Button onClick={handleGenerate} className="w-full">
          <LayoutGrid className="mr-2 h-4 w-4" />
          Generate Layout
        </Button>
        <CardDescription className="text-xs mt-2 text-center">
            This will replace any existing solar panels in this zone.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
