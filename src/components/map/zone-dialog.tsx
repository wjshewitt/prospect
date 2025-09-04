
'use client';

import { useState, useEffect } from 'react';
import type { Shape } from '@/lib/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export interface ZoneDialogState {
    isOpen: boolean;
    path: { lat: number; lng: number }[] | null;
    area: number | null;
}

interface ZoneDialogProps {
  state: ZoneDialogState;
  onOpenChange: (isOpen: boolean) => void;
  onCreateZone: (name: string, kind: Shape['zoneMeta']['kind']) => void;
}

const zoneKinds: { value: Shape['zoneMeta']['kind']; label: string }[] = [
    { value: 'residential', label: 'Residential' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'green_space', label: 'Green Space' },
    { value: 'amenity', label: 'Amenity' },
    { value: 'solar', label: 'Solar' },
];

export function ZoneDialog({ state, onOpenChange, onCreateZone }: ZoneDialogProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Shape['zoneMeta']['kind']>('residential');
  const [error, setError] = useState('');

  useEffect(() => {
    // Reset on open
    if (state.isOpen) {
      setName('');
      setKind('residential');
      setError('');
    }
  }, [state.isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Please enter a name for the zone.');
      return;
    }
    onCreateZone(name, kind);
    onOpenChange(false);
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Define New Zone</DialogTitle>
          <DialogDescription>
            Enter the details for the zone you've drawn.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g. Phase 1 Housing"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="kind" className="text-right">
              Kind
            </Label>
            <Select onValueChange={(value: Shape['zoneMeta']['kind']) => setKind(value)} defaultValue={kind}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a zone kind" />
                </SelectTrigger>
                <SelectContent>
                    {zoneKinds.map(k => (
                        <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive col-span-4 text-center">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Zone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
