
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Map, Trash2, Pencil } from 'lucide-react';
import { SiteAssessmentDialog } from '../assessment/site-assessment-dialog';
import Link from 'next/link';
import { Separator } from '../ui/separator';

type HeaderProps = {
  siteName: string;
  onSiteNameClick: () => void;
  onClear: () => void;
  hasShapes: boolean;
  shapes: Shape[];
  elevationGrid: ElevationGrid | null;
  children?: React.ReactNode;
};

export default function Header({ siteName, onSiteNameClick, onClear, hasShapes, shapes, elevationGrid, children }: HeaderProps) {
  
  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b shrink-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Map className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold font-headline tracking-tight text-gray-800">
            LandVision
          </h1>
        </Link>
        {siteName && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <button onClick={onSiteNameClick} className="flex items-center gap-2 text-xl font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <span>{siteName}</span>
                <Pencil className="h-4 w-4" />
              </button>
            </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="outline" size="sm" onClick={onClear} disabled={!hasShapes} aria-label="Clear all drawings">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
        </Button>
        <SiteAssessmentDialog shapes={shapes} elevationGrid={elevationGrid} />
      </div>
    </header>
  );
}
