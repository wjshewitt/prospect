
'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-sm z-10">
            <div className="relative">
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

    