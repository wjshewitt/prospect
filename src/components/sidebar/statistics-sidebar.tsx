'use client';

import type { Shape } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { BarChart3, TrendingUp, LandPlot, Waves } from 'lucide-react';

type StatisticsSidebarProps = {
  shapes: Shape[];
};

const SQ_METERS_TO_ACRES = 0.000247105;

export default function StatisticsSidebar({ shapes }: StatisticsSidebarProps) {
  const totalAreaMeters = shapes.reduce((acc, shape) => acc + (shape.area || 0), 0);
  const totalAreaAcres = totalAreaMeters * SQ_METERS_TO_ACRES;

  return (
    <aside id="stats-sidebar" className="w-80 border-l bg-background/80 backdrop-blur-sm hidden md:flex flex-col">
      <div className="p-4">
        <h2 className="text-xl font-semibold font-headline flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary"/>
            Statistics
        </h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Total Area
                <LandPlot className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalAreaAcres.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">acres</p>
              <Separator className="my-2" />
              <p className="text-lg font-semibold">{totalAreaMeters.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">square meters</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Elevation Analysis
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Elevation data not available.</p>
                <p>Draw a shape to analyze elevation changes.</p>
              </div>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Water Features
                <Waves className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>No water features detected.</p>
              </div>
            </CardContent>
          </Card>

        </div>
      </ScrollArea>
    </aside>
  );
}
