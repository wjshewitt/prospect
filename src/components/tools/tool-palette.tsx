
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
import { MousePointer2, Square, Pen, PenTool, Shapes, Combine, Diff, WholeWord, Building, HelpCircle, Bot, Settings, Eye } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { applyUnion, applyDifference } from '@/services/turf-operations';

type ToolPaletteProps = {
  selectedTool: Tool;
  setSelectedTool: (tool: Tool) => void;
  selectedShapeIds: string[];
  shapes: Shape[];
  setShapes: (shapes: Shape[]) => void;
  setSelectedShapeIds: (ids: string[]) => void;
  onTutorialStart: () => void;
  is3DView: boolean;
};

const panTool: { id: Tool; label: string; icon: React.ReactNode } = {
  id: 'pan',
  label: 'Pan & Select',
  icon: <MousePointer2 />,
};

const drawingTools: { id: Tool; label:string; icon: React.ReactNode }[] = [
    { id: 'rectangle', label: 'Boundary', icon: <Square /> },
    { id: 'polygon', label: 'Polygon Boundary', icon: <Pen /> },
    { id: 'freehand', label: 'Freehand Boundary', icon: <PenTool /> },
];

const designTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'zone', label: 'Draw Zone', icon: <WholeWord /> },
    { id: 'asset', label: 'Place Building', icon: <Building /> },
];

const threeDTools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'pan', label: 'Select & Navigate', icon: <MousePointer2 /> },
];


const advancedTools: { id: string; label: string; tooltip: string; icon: React.ReactNode; action: 'union' | 'difference' }[] = [
    { id: 'union', label: 'Union (Merge)', tooltip: 'Combine two selected shapes into one.', icon: <Combine />, action: 'union' },
    { id: 'difference', label: 'Difference (Subtract)', tooltip: 'Subtract one shape from another.', icon: <Diff />, action: 'difference' },
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
}: ToolPaletteProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const activeDrawingTool = useMemo(() => 
    drawingTools.find(t => t.id === selectedTool),
    [selectedTool]
  );
  
  const { toast } = useToast();
  const hasBoundary = useMemo(() => shapes.some(s => !s.zoneMeta && !s.assetMeta && !s.bufferMeta), [shapes]);


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
                  'w-full h-14 justify-center',
                  selectedTool === panTool.id && 'bg-accent text-accent-foreground'
                )}
                onClick={() => setSelectedTool(panTool.id)}
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
                      'w-full h-14 justify-center',
                      !!activeDrawingTool && 'bg-accent text-accent-foreground'
                      )}
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
            {drawingTools.map(tool => (
              <DropdownMenuItem key={tool.id} onClick={() => setSelectedTool(tool.id)} disabled={hasBoundary}>
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
          {designTools.map(tool => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                      <div className="w-full px-2 group/button">
                          <Button
                              variant="ghost"
                              className={cn(
                                  'w-full h-14 justify-center',
                                  selectedTool === tool.id && 'bg-accent text-accent-foreground'
                              )}
                              onClick={() => setSelectedTool(tool.id)}
                              disabled={!hasBoundary}
                          >
                              {tool.icon}
                          </Button>
                      </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:block hidden">
                      <p>{tool.label}</p>
                      {!hasBoundary && <p className="text-muted-foreground text-xs">Draw a site boundary first</p>}
                  </TooltipContent>
                </Tooltip>
          ))}
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
                              className="w-full h-14 justify-center"
                              disabled={selectedShapeIds.length !== 2}
                              onClick={() => handleAdvancedTool(tool.action)}
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

  const ThreeDTools = () => (
    <div className="flex flex-col items-center gap-1">
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="w-full px-2 group/button">
                    <Button
                        variant="ghost"
                        className='w-full h-14 justify-center bg-accent text-accent-foreground'
                        onClick={() => setSelectedTool('pan')}
                    >
                        <MousePointer2 />
                    </Button>
                </div>
            </TooltipTrigger>
            <TooltipContent side="right">
                <p>Select & Navigate</p>
            </TooltipContent>
        </Tooltip>
    </div>
);


  return (
    <aside
      id="tool-palette"
      className="w-16 border-r bg-background/80 backdrop-blur-sm flex flex-col items-center py-4 z-10"
      data-tutorial="step-0"
    >
      <TooltipProvider>
        {is3DView ? <ThreeDTools /> : <TwoDTools />}
        
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
                        >
                            <Settings className={cn(isPopoverOpen && 'animate-spin')} />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" className="md:block hidden">
                    <p>Help & AI Tools</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent side="right" align="center" className="w-auto p-1">
                  <div className="flex flex-col gap-1">
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <div className="w-full">
                                  <BuildingPlacementDialog />
                              </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="md:block hidden">
                              <p>AI Building Placement</p>
                          </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                           <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="w-full h-14 justify-center"
                                    onClick={() => {
                                        onTutorialStart();
                                        setIsPopoverOpen(false);
                                    }}
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
