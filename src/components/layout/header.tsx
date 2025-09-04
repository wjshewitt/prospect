
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Map, Trash2 } from 'lucide-react';
import { SiteAssessmentDialog } from '../assessment/site-assessment-dialog';
import Link from 'next/link';

type HeaderProps = {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  elevationGrid: ElevationGrid | null;
  setSelectedShapeIds: (ids: string[]) => void;
  setElevationGrid: (grid: ElevationGrid | null) => void;
  children?: React.ReactNode;
};

export default function Header({ shapes, setShapes, elevationGrid, setSelectedShapeIds, setElevationGrid, children }: HeaderProps) {
  
  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all drawings? This cannot be undone.')) {
        setShapes([]);
        setSelectedShapeIds([]);
        setElevationGrid(null);
    }
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b shrink-0 z-10 bg-background/80 backdrop-blur-sm">
      <Link href="/" className="flex items-center gap-2">
        <Map className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold font-headline tracking-tight text-gray-800">
          LandVision
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="outline" size="sm" onClick={handleClear} disabled={shapes.length === 0} aria-label="Clear all drawings">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
        </Button>
        <SiteAssessmentDialog shapes={shapes} elevationGrid={elevationGrid} />
      </div>
    </header>
  );
}
