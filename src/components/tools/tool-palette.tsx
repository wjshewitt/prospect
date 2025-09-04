
'use client';

import type { Tool, Shape } from '@/lib/types';
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
import { MousePointer2, Square, Pen, Circle, Type, Spline, Shapes, PenTool, Combine, Diff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { applyUnion, applyDifference } from '@/services/turf-operations';
import { uuid } from '../map/map-canvas';

type ToolPaletteProps = {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  selectedShapeIds: string[];
  shapes: Shape[];
  setShapes: (shapes: Shape[]) => void;
  setSelectedShapeIds: (ids: string[]) => void;
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

const advancedTools: { id: string; label: string; icon: React.ReactNode; action: 'union' | 'difference' }[] = [
    { id: 'union', label: 'Union (Merge)', icon: <Combine />, action: 'union' },
    { id: 'difference', label: 'Difference (Subtract)', icon: <Diff />, action: 'difference' },
];

export default function ToolPalette({ 
    selectedTool, 
    setSelectedTool, 
    selectedShapeIds,
    shapes,
    setShapes,
    setSelectedShapeIds 
}: ToolPaletteProps) {

  const activeDrawingTool = useMemo(() => 
    drawingTools.find(t => t.id === selectedTool),
    [selectedTool]
  );
  
  const { toast } = useToast();

  const handleAdvancedTool = (action: 'union' | 'difference') => {
    if (selectedShapeIds.length !== 2) {
      toast({
        variant: 'destructive',
        title: 'Invalid Selection',
        description: 'Please select exactly two shapes to use this tool.',
      });
      return;
    }
    const [shape1, shape2] = selectedShapeIds.map(id => shapes.find(s => s.id === id)!);
    
    try {
      let newShape: Shape | null;
      if (action === 'union') {
        newShape = applyUnion(shape1, shape2);
      } else { // difference
        // Assume larger shape is the one to subtract from
        const [minuend, subtrahend] = shape1.area! > shape2.area! ? [shape1, shape2] : [shape2, shape1];
        newShape = applyDifference(minuend, subtrahend);
      }

      if (newShape) {
        // Remove old shapes
        const remainingShapes = shapes.filter(s => !selectedShapeIds.includes(s.id));
        // Add new shape
        setShapes([...remainingShapes, newShape]);
        // Select the new shape
        setSelectedShapeIds([newShape.id]);
      }
    } catch(e: any) {
        toast({
            variant: 'destructive',
            title: 'Operation Failed',
            description: e.message || 'Could not perform the operation.',
        });
    }
  }

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

        {/* Advanced Tools */}
        <div className="flex flex-col items-center gap-1">
            {advancedTools.map(tool => (
                 <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                        <div className="w-full px-2 group/button">
                            <Button
                                variant="ghost"
                                className="w-full justify-center group-hover/button:justify-start group-hover/button:px-4 gap-2 px-0 h-14"
                                disabled={selectedShapeIds.length !== 2}
                                onClick={() => handleAdvancedTool(tool.action)}
                            >
                                {tool.icon}
                                <span className="opacity-0 w-0 group-hover/button:w-auto group-hover/button:opacity-100 transition-all duration-200 delay-100 whitespace-nowrap">
                                    {tool.label}
                                </span>
                            </Button>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="md:block hidden">
                        <p>{tool.label} (requires 2 shapes)</p>
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
