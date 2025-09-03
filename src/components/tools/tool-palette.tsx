
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
  { id: 'polygon', label: 'Polygon Tool', icon: <Pen /> },
];

const disabledTools: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'circle', label: 'Circle Tool', icon: <Circle /> },
    { id: 'text', label: 'Text Tool', icon: <Type /> },
    { id: 'boundary', label: 'Boundary Tool', icon: <Spline /> },
];


export default function ToolPalette({ selectedTool, setSelectedTool }: ToolPaletteProps) {
  return (
    <aside 
      id="tool-palette" 
      className="group/palette w-16 hover:w-48 transition-all duration-300 ease-in-out border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 data-[state=collapsed]:items-start"
    >
      <TooltipProvider>
        {tools.map(tool => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                    'w-full flex justify-start items-center gap-2 px-4',
                    selectedTool === tool.id && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setSelectedTool(tool.id)}
                >
                    {tool.icon}
                    <span className="opacity-0 group-hover/palette:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
                        {tool.label}
                    </span>
                </Button>
            </TooltipTrigger>
             <TooltipContent side="right" className="group-hover/palette:hidden">
              <p>{tool.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator className="my-4 w-10/12 mx-auto" />

        {disabledTools.map(tool => (
             <Tooltip key={tool.id}>
             <TooltipTrigger asChild>
                <Button
                 variant="ghost"
                 className='w-full flex justify-start items-center gap-2 px-4'
                 disabled
               >
                 {tool.icon}
                 <span className="opacity-0 group-hover/palette:opacity-100 transition-opacity duration-200 delay-100 whitespace-nowrap">
                    {tool.label}
                 </span>
               </Button>
             </TooltipTrigger>
             <TooltipContent side="right" className="group-hover/palette:hidden">
               <p>{tool.label} (coming soon)</p>
             </TooltipContent>
           </Tooltip>
        ))}

        <div className="flex-grow" />
        
        <div className="w-full px-2">
            <BuildingPlacementDialog />
        </div>

      </TooltipProvider>
    </aside>
  );
}
