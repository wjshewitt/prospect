
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressSearchBoxProps {
    onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
}

export function AddressSearchBox({ onPlaceSelect }: AddressSearchBoxProps) {
    const map = useMap();
    const inputRef = useRef<HTMLInputElement>(null);
    const [autoComplete, setAutoComplete] = useState<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        if (!map || !inputRef.current) return;

        const ac = new google.maps.places.Autocomplete(inputRef.current, {
            fields: ['geometry.location', 'name', 'formatted_address'],
        });

        ac.bindTo('bounds', map);
        setAutoComplete(ac);

        return () => {
            google.maps.event.clearInstanceListeners(ac);
        };
    }, [map]);

    useEffect(() => {
        if (!autoComplete) return;

        const listener = autoComplete.addListener('place_changed', () => {
            onPlaceSelect(autoComplete.getPlace());
        });

        return () => {
            google.maps.event.removeListener(listener);
        };
    }, [autoComplete, onPlaceSelect]);

    return (
        <div className="group relative">
            {/* Collapsed Tab */}
            <div className={cn(
                "flex items-center justify-center cursor-pointer",
                "h-8 w-28 rounded-b-lg border-x border-b border-border bg-background shadow-sm",
                "transition-opacity duration-300 ease-in-out",
                "group-hover:opacity-0"
            )}>
                <span className="text-xs font-medium text-muted-foreground">Search Location</span>
            </div>
            
            {/* Expanded Input */}
            <div className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2",
                "w-96",
                "transition-opacity duration-300 ease-in-out",
                "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
            )}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    placeholder="Search for a location..."
                    className="w-full pl-10 pr-4 py-2 shadow-md"
                />
            </div>
        </div>
    );
}
