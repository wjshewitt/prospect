
'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Shape } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LandPlot, Building, Calendar, ArrowRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface Project {
    id: string;
    siteName: string;
    shapes: Shape[];
    lastModified: Date;
}

interface ProjectCardProps {
    project: Project;
}

const SQ_METERS_TO_ACRES = 0.000247105;

const calculateStats = (shapes: Shape[]) => {
    const projectBoundary = shapes.find(s => !s.bufferMeta && !s.zoneMeta && !s.assetMeta);
    const totalAreaAcres = projectBoundary ? (projectBoundary.area || 0) * SQ_METERS_TO_ACRES : 0;
    const buildingCount = shapes.filter(s => s.assetMeta?.assetType === 'building').length;

    return { totalAreaAcres, buildingCount };
};

export function ProjectCard({ project }: ProjectCardProps) {
    const { totalAreaAcres, buildingCount } = calculateStats(project.shapes);

    return (
        <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
            <CardHeader>
                <CardTitle className="truncate">{project.siteName}</CardTitle>
                <CardDescription>
                    <Link href={`/vision?project=${project.id}`} className="hover:underline">
                        ID: {project.id}
                    </Link>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                    <Image
                        src="https://picsum.photos/600/400"
                        alt={`Map of ${project.siteName}`}
                        width={600}
                        height={400}
                        className="h-full w-full object-cover"
                        data-ai-hint="map aerial"
                    />
                </div>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <LandPlot className="h-4 w-4" />
                        <span>Area</span>
                    </div>
                    <span className="text-right font-semibold">{totalAreaAcres.toFixed(2)} acres</span>

                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>Buildings</span>
                    </div>
                    <span className="text-right font-semibold">{buildingCount}</span>
                </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/50 p-3">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                    <Link href={`/vision?project=${project.id}`}>
                        Open Project
                        <ArrowRight className="ml-auto h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

ProjectCard.Skeleton = function ProjectCardSkeleton() {
    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <Skeleton className="aspect-video w-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
            </CardContent>
            <CardFooter className="border-t bg-muted/50 p-3">
                <Skeleton className="h-8 w-full" />
            </CardFooter>
        </Card>
    )
}
