'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Pencil } from 'lucide-react';

interface ShapeContextMenuProps {
  position: { x: number; y: number };
  shapeId: string;
  onDelete: (shapeId: string) => void;
  onClose: () => void;
}

export function ShapeContextMenu({ position, shapeId, onDelete }: ShapeContextMenuProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(shapeId);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Edit functionality to be implemented
    alert('Edit feature coming soon!');
  };

  return (
    <div
      className="absolute z-20 flex flex-col gap-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(5px, 5px)', // Offset to appear below and to the right of the cursor
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="justify-start px-2 py-1 h-auto"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        <span>Delete</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEdit}
        className="justify-start px-2 py-1 h-auto"
        disabled
      >
        <Pencil className="mr-2 h-4 w-4" />
        <span>Edit</span>
      </Button>
    </div>
  );
}
