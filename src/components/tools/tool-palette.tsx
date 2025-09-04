
'use client';

import type { Tool } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { BuildingPlacementDialog } from '@/components/ai/building-placement-dialog';
import { MousePointer2, Square, Pen, Circle, Type, Spline, Shapes, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

type ToolPaletteProps = {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
};

const panTool: { id: Tool; label: string; icon: React.ReactNode } = {
  id: 'pan',
  label: 'Pan & Select',
  icon: <MousePointer2 />,
};

const drawingTools: { id: Tool; label:string; icon: React.ReactNode }[] = [
    { id: 'rectangle', label: 'Rectangle', icon: <Square /> },
    { id: 'polygon', label: 'Polygon (Click to Plot)', icon: <Pen /> },
    { id: 'freehand', label: 'Freehand (Drag to Draw)', icon: <PenTool /> },
];

const disabledTools: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'circle', label: 'Circle Tool', icon: <Circle /> },
  { id: 'text', label: 'Text Tool', icon: <Type /> },
  { id: 'boundary', label: 'Boundary Tool', icon: <Spline /> },
];

export default function ToolPalette({ selectedTool, setSelectedTool }: ToolPaletteProps) {

  const activeDrawingTool = useMemo(() => 
    drawingTools.find(t => t.id === selectedTool),
    [selectedTool]
  );

  return (
    <aside
      id="tool-palette"
      className="w-16 border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 z-10"
    >
      <TooltipProvider>
        <div className="flex flex-col items-center gap-1">
          {/* Pan Tool */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full px-2 group/button">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-center group-hover/button:justify-start group-hover/button:px-4 gap-2 px-0 h-14',
                    selectedTool === panTool.id && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => setSelectedTool(panTool.id)}
                >
                  {panTool.icon}
                  <span className="opacity-0 w-0 group-hover/button:w-auto group-hover/button:opacity-100 transition-all duration-200 delay-100 whitespace-nowrap">
                    {panTool.label}
                  </span>
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:block hidden">
              <p>{panTool.label}</p>
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
                        'w-full justify-center group-hover/button:justify-start group-hover/button:px-4 gap-2 px-0 h-14',
                        !!activeDrawingTool && 'bg-accent text-accent-foreground'
                        )}
                    >
                        {activeDrawingTool?.icon ?? <Shapes />}
                         <span className="opacity-0 w-0 group-hover/button:w-auto group-hover/button:opacity-100 transition-all duration-200 delay-100 whitespace-nowrap">
                            Draw Tools
                        </span>
                    </Button>
                  </DropdownMenuTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="md:block hidden">
                <p>Drawing Tools</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right">
              {drawingTools.map(tool => (
                <DropdownMenuItem key={tool.id} onClick={() => setSelectedTool(tool.id)}>
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

        <div className="flex flex-col items-center gap-1">
          {disabledTools.map(tool => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                 <div className="w-full px-2 group/button">
                    <Button variant="ghost" className="w-full justify-center group-hover/button:justify-start group-hover/button:px-4 gap-2 px-0 h-14" disabled>
                        {tool.icon}
                        <span className="opacity-0 w-0 group-hover/button:w-auto group-hover/button:opacity-100 transition-all duration-200 delay-100 whitespace-nowrap">
                            {tool.label}
                        </span>
                    </Button>
                 </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="md:block hidden">
                <p>{tool.label} (coming soon)</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="flex-grow" />

        <div className="w-full px-2 group/button">
          <BuildingPlacementDialog />
        </div>
      </TooltipProvider>
    </aside>
  );
}
