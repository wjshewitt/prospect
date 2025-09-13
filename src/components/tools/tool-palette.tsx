"use client";

import type { Tool, Shape, MeasurementConfig } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Square,
  Pen,
  PenTool,
  Shapes,
  Combine,
  Diff,
  WholeWord,
  Building,
  HelpCircle,
  Bot,
  Settings,
  Eye,
  View,
  Grid3x3,
  AppWindow,
  Ruler,
  Type,
  Layers,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { applyUnion, applyDifference } from "@/services/turf-operations";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LayerControl } from "@/components/map/layer-control";
import { MAP_PROVIDERS } from "@/lib/map-providers";
import type { LayerOverlay } from "@/lib/types";

type ToolPaletteProps = {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  selectedShapeIds: string[];
  shapes: Shape[];
  setShapes: (shapes: Shape[]) => void;
  setSelectedShapeIds: (ids: string[]) => void;
  onTutorialStart: () => void;
  is3DView: boolean;
  measurementConfig: MeasurementConfig;
  setMeasurementConfig: (config: MeasurementConfig) => void;
  mapProvider: string;
  setMapProvider: (provider: string) => void;
  layerVisibility: { [key: string]: boolean };
  setLayerVisibility: (
    visibility:
      | { [key: string]: boolean }
      | ((prev: { [key: string]: boolean }) => { [key: string]: boolean })
  ) => void;
};

const panTool: { id: Tool; label: string; icon: React.ReactNode } = {
  id: "pan",
  label: "Pan & Select",
  icon: <MousePointer2 />,
};

const drawingTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "rectangle", label: "Boundary", icon: <Square /> },
  { id: "polygon", label: "Polygon Boundary", icon: <Pen /> },
  { id: "freehand", label: "Freehand Boundary", icon: <PenTool /> },
];

const measurementTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "measure", label: "Measure", icon: <Ruler /> },
];

const annotationTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "annotate", label: "Annotate", icon: <Type /> },
];

const designTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "zone", label: "Draw Zone", icon: <WholeWord /> },
  { id: "asset", label: "Place Building", icon: <Building /> },
];

const threeDTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "pan", label: "Select & Navigate", icon: <MousePointer2 /> },
  { id: "asset", label: "Place Building", icon: <Building /> },
  { id: "multi-select", label: "Multi-Select", icon: <AppWindow /> },
];

const advancedTools: {
  id: string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  action: "union" | "difference";
}[] = [
  {
    id: "union",
    label: "Union (Merge)",
    tooltip: "Combine two selected shapes into one.",
    icon: <Combine />,
    action: "union",
  },
  {
    id: "difference",
    label: "Difference (Subtract)",
    tooltip: "Subtract one shape from another.",
    icon: <Diff />,
    action: "difference",
  },
];

export default function ToolPalette({
  selectedTool,
  setSelectedTool,
  selectedShapeIds,
  shapes,
  setShapes,
  setSelectedShapeIds,
  onTutorialStart,
  is3DView,
  measurementConfig,
  setMeasurementConfig,
  mapProvider,
  setMapProvider,
  layerVisibility,
  setLayerVisibility,
}: ToolPaletteProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isMapSelectionOpen, setIsMapSelectionOpen] = useState(false);
  const [popupPosition, setPopupPosition] = useState<"top" | "bottom">(
    "bottom"
  );

  const activeDrawingTool = useMemo(
    () => drawingTools.find((t) => t.id === selectedTool),
    [selectedTool]
  );

  const { toast } = useToast();
  const hasBoundary = useMemo(
    () => shapes.some((s) => !s.zoneMeta && !s.assetMeta && !s.bufferMeta),
    [shapes]
  );

  const handleAdvancedTool = (action: "union" | "difference") => {
    if (selectedShapeIds.length !== 2) {
      toast({
        variant: "destructive",
        title: "Invalid Selection",
        description: "Please select exactly two shapes to use this tool.",
      });
      return;
    }
    const [shape1, shape2] = selectedShapeIds.map(
      (id) => shapes.find((s) => s.id === id)!
    );

    try {
      let newShape: Shape | null;
      if (action === "union") {
        newShape = applyUnion(shape1, shape2);
      } else {
        // difference
        // Assume larger shape is the one to subtract from
        const [minuend, subtrahend] =
          shape1.area! > shape2.area! ? [shape1, shape2] : [shape2, shape1];
        newShape = applyDifference(minuend, subtrahend);
      }

      if (newShape) {
        // Remove old shapes
        const remainingShapes = shapes.filter(
          (s) => !selectedShapeIds.includes(s.id)
        );
        // Add new shape
        setShapes([...remainingShapes, newShape]);
        // Select the new shape
        setSelectedShapeIds([newShape.id]);
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: e.message || "Could not perform the operation.",
      });
    }
  };

  const TwoDTools = () => (
    <>
      <div className="flex flex-col items-center gap-1">
        {/* Pan Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full px-2 group/button">
              <Button
                variant="ghost"
                className={cn(
                  "w-full h-14 justify-center",
                  selectedTool === panTool.id &&
                    "bg-accent text-accent-foreground"
                )}
                onClick={() => setSelectedTool(panTool.id)}
                aria-label={panTool.label}
              >
                {panTool.icon}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="md:block hidden">
            <p>{panTool.label} (Ctrl+Click to multi-select)</p>
          </TooltipContent>
        </Tooltip>

        {/* Drawing Tools Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full h-14 justify-center",
                      !!activeDrawingTool && "bg-accent text-accent-foreground"
                    )}
                    aria-label={activeDrawingTool?.label ?? "Boundary Tools"}
                  >
                    {activeDrawingTool?.icon ?? <Shapes />}
                  </Button>
                </DropdownMenuTrigger>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>Boundary Tools</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right">
            {drawingTools.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                disabled={hasBoundary}
                aria-label={tool.label}
              >
                <div className="flex items-center gap-2">
                  {tool.icon}
                  <span>{tool.label}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="my-4 w-10/12 mx-auto" />

      {/* Design Tools */}
      <div className="flex flex-col items-center gap-1">
        {designTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-14 justify-center",
                    selectedTool === tool.id &&
                      "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setSelectedTool(tool.id)}
                  disabled={!hasBoundary}
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>{tool.label}</p>
              {!hasBoundary && (
                <p className="text-muted-foreground text-xs">
                  Draw a site boundary first
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator className="my-4 w-10/12 mx-auto" />

      {/* Measurement Tools */}
      <div className="flex flex-col items-center gap-1">
        {measurementTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-14 justify-center",
                    selectedTool === tool.id &&
                      "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setSelectedTool(tool.id)}
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator className="my-4 w-10/12 mx-auto" />

      {/* Annotation Tools */}
      <div className="flex flex-col items-center gap-1">
        {annotationTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full h-14 justify-center",
                    selectedTool === tool.id &&
                      "bg-accent text-accent-foreground"
                  )}
                  onClick={() => setSelectedTool(tool.id)}
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator className="my-4 w-10/12 mx-auto" />

      {/* Map Selection Popup */}
      <div className="flex flex-col items-center gap-1">
        <Popover open={isMapSelectionOpen} onOpenChange={setIsMapSelectionOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full h-14 justify-center",
                      isMapSelectionOpen && "bg-accent text-accent-foreground"
                    )}
                    aria-label="Map Selection"
                  >
                    <Layers />
                  </Button>
                </PopoverTrigger>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>Map Selection</p>
              <p className="text-muted-foreground text-xs">
                Control map layers and overlays
              </p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            side="right"
            align="start"
            className="w-80 p-0 ml-2 max-h-[60vh] overflow-y-auto will-change-transform"
            sideOffset={8}
            avoidCollisions={true}
            collisionPadding={{ top: 20, bottom: 20, left: 16, right: 16 }}
            sticky="always"
            onEscapeKeyDown={() => setIsMapSelectionOpen(false)}
            onOpenAutoFocus={(e) => {
              // Prevent focus issues during zoom
              e.preventDefault();
            }}
            style={{
              transform: "translateZ(0)", // Force hardware acceleration
              backfaceVisibility: "hidden",
              minHeight: "200px", // Ensure minimum height
            }}
          >
            <LayerControl
              activeProvider={mapProvider}
              onProviderChange={setMapProvider}
              overlays={[
                {
                  id: "annotations",
                  name: "Annotations",
                  visible: layerVisibility["annotations"] ?? true,
                  opacity: 1,
                  type: "annotations",
                },
              ]}
              onOverlayToggle={(overlayId, visible) =>
                setLayerVisibility((prev: { [key: string]: boolean }) => ({
                  ...prev,
                  [overlayId]: visible,
                }))
              }
              onOpacityChange={(overlayId, opacity) => {
                // Opacity change handler to be implemented
              }}
              onClose={() => setIsMapSelectionOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Separator className="my-4 w-10/12 mx-auto" />

      {/* Advanced Tools */}
      <div className="flex flex-col items-center gap-1">
        {advancedTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <Button
                  variant="ghost"
                  className="w-full h-14 justify-center"
                  disabled={selectedShapeIds.length !== 2}
                  onClick={() => handleAdvancedTool(tool.action)}
                  aria-label={tool.label}
                >
                  {tool.icon}
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p className="font-semibold">{tool.label}</p>
              <p className="text-muted-foreground">{tool.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </>
  );

  const ThreeDToolsComponent = () => (
    <div className="flex flex-col items-center gap-1">
      {threeDTools.map((tool) => (
        <Tooltip key={tool.id}>
          <TooltipTrigger asChild>
            <div className="w-full px-2 group/button">
              <Button
                variant="ghost"
                className={cn(
                  "w-full h-14 justify-center",
                  selectedTool === tool.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => setSelectedTool(tool.id)}
                aria-label={tool.label}
              >
                {tool.icon}
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{tool.label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );

  return (
    <aside
      id="tool-palette"
      className="w-16 border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 z-10"
      data-tutorial="step-0"
      style={{ "--tool-palette-width": "4rem" } as React.CSSProperties}
    >
      <TooltipProvider>
        {is3DView ? <ThreeDToolsComponent /> : <TwoDTools />}

        <div className="flex-grow" />

        <div className="w-full px-2 group/button">
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full h-14 justify-center"
                    aria-label="Settings & Help"
                  >
                    <Settings className={cn(isPopoverOpen && "animate-spin")} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="md:block hidden">
                <p>Settings & Help</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="right" align="center" className="w-auto p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold">Measurement Units</h3>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="unit-toggle">Metric</Label>
                    <Switch
                      id="unit-toggle"
                      checked={measurementConfig.units === "metric"}
                      onCheckedChange={(checked) =>
                        setMeasurementConfig({
                          ...measurementConfig,
                          units: checked ? "metric" : "imperial",
                        })
                      }
                    />
                    <Label htmlFor="unit-toggle">Imperial</Label>
                  </div>
                </div>
                <Separator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full h-14 justify-center"
                      onClick={() => {
                        onTutorialStart();
                        setIsPopoverOpen(false);
                      }}
                      aria-label="Start Tutorial"
                    >
                      <HelpCircle />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:block hidden">
                    <p>Start Tutorial</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TooltipProvider>
    </aside>
  );
}
