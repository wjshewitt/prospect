"use client";

import Link from "next/link";
import type { Shape } from "@/lib/types";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LandPlot,
  Building,
  ArrowRight,
  MapPin,
  Edit,
  Check,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface Project {
  id: string;
  siteName: string;
  location?: string;
  shapes: Shape[];
  lastModified: string; // ISO string
}

interface ProjectCardProps {
  project: Project;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const SQ_METERS_TO_ACRES = 0.000247105;

const calculateStats = (shapes: Shape[]) => {
  const projectBoundary = shapes.find(
    (s) => !s.bufferMeta && !s.zoneMeta && !s.assetMeta
  );
  const totalAreaAcres = projectBoundary
    ? (projectBoundary.area || 0) * SQ_METERS_TO_ACRES
    : 0;
  const buildingCount = shapes.filter(
    (s) => s.assetMeta?.assetType === "building"
  ).length;

  return { totalAreaAcres, buildingCount };
};

function computeBBox(shapes: Shape[]) {
  let minLat = Infinity,
    minLng = Infinity,
    maxLat = -Infinity,
    maxLng = -Infinity;
  shapes.forEach((s) => {
    (s.path || []).forEach((p) => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });
  });
  if (
    !isFinite(minLat) ||
    !isFinite(minLng) ||
    !isFinite(maxLat) ||
    !isFinite(maxLng)
  ) {
    // Default bbox around 0,0 to avoid NaN
    minLat = -0.001;
    minLng = -0.001;
    maxLat = 0.001;
    maxLng = 0.001;
  }
  return { minLat, minLng, maxLat, maxLng };
}

function colorForZone(kind?: string) {
  switch (kind) {
    case "residential":
      return "#10B981";
    case "commercial":
      return "#3B82F6";
    case "amenity":
      return "#F59E0B";
    case "green_space":
      return "#22C55E";
    case "solar":
      return "#F97316";
    default:
      return "#6B7280";
  }
}

function generatePreviewSVG(shapes: Shape[], title: string) {
  const width = 600,
    height = 340; // 16:9ish
  const pad = 8;
  const { minLat, minLng, maxLat, maxLng } = computeBBox(shapes);
  const spanLat = Math.max(1e-6, maxLat - minLat);
  const spanLng = Math.max(1e-6, maxLng - minLng);

  const projectBoundary = shapes.find(
    (s) => !s.bufferMeta && !s.zoneMeta && !s.assetMeta
  );

  const projectHue =
    Math.abs(title.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  const bg = `hsl(${projectHue} 30% 96%)`;
  const strokeBase = `hsl(${projectHue} 40% 40%)`;

  const toXY = (lat: number, lng: number) => {
    const x = pad + ((lng - minLng) / spanLng) * (width - 2 * pad);
    const y = pad + (1 - (lat - minLat) / spanLat) * (height - 2 * pad);
    return [x.toFixed(1), y.toFixed(1)];
  };

  const polys: string[] = [];
  shapes.forEach((s) => {
    if (!s.path || s.path.length === 0) return;
    const pts = s.path.map((p) => toXY(p.lat, p.lng).join(",")).join(" ");
    if (s.zoneMeta) {
      polys.push(
        `<polygon points="${pts}" fill="${colorForZone(
          s.zoneMeta.kind
        )}" fill-opacity="0.35" stroke="${colorForZone(
          s.zoneMeta.kind
        )}" stroke-opacity="0.9" stroke-width="1.5" />`
      );
    } else if (s.assetMeta) {
      polys.push(
        `<polygon points="${pts}" fill="#A9927D" stroke="#5E503F" stroke-width="1" />`
      );
    } else {
      polys.push(
        `<polygon points="${pts}" fill="none" stroke="#FF6B35" stroke-width="2.5" />`
      );
    }
  });

  // If we have a boundary, draw subtle hatch background inside bbox
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
  <defs>
    <pattern id='grid' width='12' height='12' patternUnits='userSpaceOnUse'>
      <path d='M 12 0 L 0 0 0 12' fill='none' stroke='${strokeBase}' stroke-opacity='0.08' stroke-width='1'/>
    </pattern>
  </defs>
  <rect x='0' y='0' width='${width}' height='${height}' fill='${bg}' />
  <rect x='${pad}' y='${pad}' width='${width - 2 * pad}' height='${
    height - 2 * pad
  }' fill='url(#grid)' />
  ${polys.join("\n  ")}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function ProjectCard({
  project,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: ProjectCardProps) {
  const { totalAreaAcres, buildingCount } = calculateStats(project.shapes);

  const lastModifiedDate = project.lastModified
    ? new Date(project.lastModified)
    : null;
  const timeAgo = lastModifiedDate
    ? formatDistanceToNow(lastModifiedDate, { addSuffix: true })
    : "never";

  const previewUrl = useMemo(
    () => generatePreviewSVG(project.shapes, project.siteName || "Project"),
    [project.shapes, project.siteName]
  );

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 bg-card">
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, hsl(160 60% 45%), hsl(30 95% 55%))`,
        }}
      />
      <CardHeader className="pb-3">
        <CardTitle className="truncate text-xl">{project.siteName}</CardTitle>
        <CardDescription>Last modified {timeAgo}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted">
          {/* Inline SVG preview as data URL to avoid slow external image loads */}
          <img
            src={previewUrl}
            alt={`Preview of ${project.siteName}`}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <LandPlot className="h-4 w-4" />
            <span>Area</span>
          </div>
          <span className="text-right font-semibold">
            {totalAreaAcres.toFixed(2)} acres
          </span>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Buildings</span>
          </div>
          <span className="text-right font-semibold">{buildingCount}</span>

          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>Location</span>
          </div>
          <span className="text-right font-semibold">
            {project.location || "N/A"}
          </span>
        </div>
      </CardContent>
      <CardFooter className="border-t bg-muted/50 p-3">
        {isSelectionMode ? (
          <Button
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="w-full justify-center"
            onClick={onToggleSelect}
          >
            {isSelected ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Selected
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Select to Edit
              </>
            )}
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <Link href={`/vision?projectId=${project.id}`}>
              Open Project
              <ArrowRight className="ml-auto h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

ProjectCard.Skeleton = function ProjectCardSkeleton() {
  return (
    <Card className="flex flex-col overflow-hidden bg-card">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-orange-500" />
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
  );
};
