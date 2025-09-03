
'use client';

import type { Shape } from '@/lib/types';
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Map, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type HeaderProps = {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
};

export default function Header({ setShapes }: HeaderProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
      try {
        const canvas = await html2canvas(captureArea, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            onclone: (document) => {
              // Hide tool palettes during capture
              document.getElementById('tool-palette')?.style.setProperty('visibility', 'hidden');
              document.getElementById('stats-sidebar')?.style.setProperty('visibility', 'hidden');
            }
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('landvision-export.pdf');
      } catch (error) {
        console.error('Failed to export PDF:', error);
        alert('Could not export to PDF. Please try again.');
      }
    }
    setIsExporting(false);
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all drawings? This cannot be undone.')) {
        setShapes([]);
    }
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b shrink-0 z-10 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Map className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold font-headline tracking-tight text-gray-800">
          LandVision
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleClear} aria-label="Clear all drawings">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
        </Button>
        <Button onClick={handleExport} disabled={isExporting} size="sm" variant="default">
          <FileDown className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </div>
    </header>
  );
}
