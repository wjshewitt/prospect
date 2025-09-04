
'use client';

import type { Shape, ElevationGrid } from '@/lib/types';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Map, Trash2, ChevronDown, LandPlot, Waves, Save, FolderOpen } from 'lucide-react';
import { SiteAssessmentDialog } from '../assessment/site-assessment-dialog';
import Link from 'next/link';
import { Separator } from '../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

type HeaderProps = {
  siteName: string;
  onSiteNameClick: () => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  hasShapes: boolean;
  shapes: Shape[];
  elevationGrid: ElevationGrid | null;
  children?: React.ReactNode;
};

export default function Header({ siteName, onSiteNameClick, onClear, onSave, onLoad, hasShapes, shapes, elevationGrid, children }: HeaderProps) {
  const projectBoundary = shapes.find(s => s.type !== 'buffer' && !s.zoneMeta && !s.assetMeta);
  const zones = shapes.filter(s => !!s.zoneMeta);

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors" data-tutorial="step-2">
                    <span>{siteName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Project Layers</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projectBoundary && (
                     <DropdownMenuItem onSelect={onSiteNameClick}>
                        <LandPlot className="mr-2 h-4 w-4" />
                        <span>Edit Site Name</span>
                      </DropdownMenuItem>
                  )}
                  {zones.map(zone => (
                    <DropdownMenuItem key={zone.id} disabled>
                       <Waves className={cn("mr-2 h-4 w-4", 
                          zone.zoneMeta?.kind === 'residential' && 'text-green-500',
                          zone.zoneMeta?.kind === 'commercial' && 'text-blue-500',
                          zone.zoneMeta?.kind === 'amenity' && 'text-amber-500',
                          zone.zoneMeta?.kind === 'green_space' && 'text-emerald-500',
                       )} />
                      <span>{zone.zoneMeta?.name}</span>
                    </DropdownMenuItem>
                  ))}
                   {zones.length === 0 && (
                    <DropdownMenuItem disabled>
                      <span className="text-xs text-muted-foreground italic px-2">No zones defined yet.</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button variant="outline" size="sm" onClick={onLoad}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Load
        </Button>
        <Button variant="outline" size="sm" onClick={onSave} disabled={!hasShapes}>
            <Save className="h-4 w-4 mr-2" />
            Save
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} disabled={!hasShapes} aria-label="Clear all drawings">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
        </Button>
        <SiteAssessmentDialog shapes={shapes} elevationGrid={elevationGrid} />
      </div>
    </header>
  );
}
