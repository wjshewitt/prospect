'use client';

import type { Tool } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { BuildingPlacementDialog } from '@/components/ai/building-placement-dialog';
import { MousePointer2, Square, Circle, Type, Pen, Spline } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolPaletteProps = {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
};

const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'pan', label: 'Pan & Select', icon: <MousePointer2 /> },
  { id: 'rectangle', label: 'Rectangle Tool', icon: <Square /> },
];

const disabledTools: { id: Tool | string; label: string; icon: React.ReactNode }[] = [
    { id: 'pen', label: 'Pen Tool', icon: <Pen /> },
    { id: 'circle', label: 'Circle Tool', icon: <Circle /> },
    { id: 'text', label: 'Text Tool', icon: <Type /> },
    { id: 'boundary', label: 'Boundary Tool', icon: <Spline /> },
];


export default function ToolPalette({ selectedTool, setSelectedTool }: ToolPaletteProps) {
  return (
    <aside id="tool-palette" className="w-16 border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 space-y-2">
      <TooltipProvider>
        {tools.map(tool => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-10 w-10',
                  selectedTool === tool.id && 'bg-accent text-accent-foreground'
                )}
                onClick={() => setSelectedTool(tool.id)}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator className="my-4" />

        {disabledTools.map(tool => (
             <Tooltip key={tool.id}>
             <TooltipTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 className='h-10 w-10'
                 disabled
               >
                 {tool.icon}
               </Button>
             </TooltipTrigger>
             <TooltipContent side="right">
               <p>{tool.label} (coming soon)</p>
             </TooltipContent>
           </Tooltip>
        ))}

        <div className="flex-grow" />
        
        <BuildingPlacementDialog />

      </TooltipProvider>
    </aside>
  );
}
