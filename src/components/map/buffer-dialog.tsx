
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BufferState {
    isOpen: boolean;
    shapeId: string | null;
}

interface BufferDialogProps {
  state: BufferState;
  onOpenChange: (isOpen: boolean) => void;
  onCreateBuffer: (distance: number) => void;
}

export function BufferDialog({ state, onOpenChange, onCreateBuffer }: BufferDialogProps) {
  const [distance, setDistance] = useState('10');
  const [error, setError] = useState('');

  useEffect(() => {
    // Reset on open
    if (state.isOpen) {
      setDistance('10');
      setError('');
    }
  }, [state.isOpen]);

  const handleSubmit = () => {
    const numDistance = parseFloat(distance);
    if (isNaN(numDistance) || numDistance <= 0) {
      setError('Please enter a valid positive number for the distance.');
      return;
    }
    onCreateBuffer(numDistance);
    onOpenChange(false);
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Internal Buffer</DialogTitle>
          <DialogDescription>
            Create an inner boundary from the selected shape. The distance is in meters.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="distance" className="text-right">
              Distance (m)
            </Label>
            <Input
              id="distance"
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="col-span-3"
              min="0"
            />
          </div>
          {error && <p className="text-sm text-destructive col-span-4 text-center">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Buffer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
