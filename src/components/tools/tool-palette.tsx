
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
      className="w-16 border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 z-10"
    >
      <TooltipProvider>
        {tools.map(tool => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    className={cn(
                      'w-14 group/button flex justify-center items-center gap-2 px-0 hover:w-40 hover:justify-start hover:px-4 transition-all duration-300',
                      selectedTool === tool.id && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => setSelectedTool(tool.id)}
                >
                    {tool.icon}
                    <span className="opacity-0 w-0 group-hover/button:w-auto group-hover/button:opacity-100 transition-all duration-200 delay-100 whitespace-nowrap">
                        {tool.label}
                    </span>
                </Button>
            </TooltipTrigger>
             <TooltipContent side="right" className="md:hidden">
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
                  className='w-14 group/button flex justify-center items-center gap-2 px-0 hover:w-40 hover:justify-start hover:px-4 transition-all duration-300'
                  disabled
                >
                  {tool.icon}
                  <span className="opacity-0 w-0 group-hover/button:opacity-100 group-hover/button:w-auto transition-all duration-200 delay-100 whitespace-nowrap">
                      {tool.label}
                  </span>
                </Button>
             </TooltipTrigger>
             <TooltipContent side="right" className="md:hidden">
               <p>{tool.label} (coming soon)</p>
             </TooltipContent>
           </Tooltip>
        ))}

        <div className="flex-grow" />
        
        <div className="w-full px-2 group/button hover:w-40 transition-all duration-300">
            <BuildingPlacementDialog />
        </div>

      </TooltipProvider>
    </aside>
  );
}
