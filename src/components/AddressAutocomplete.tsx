import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: {
    address: string;
    coordinates: { lat: number; lng: number };
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

let apiKeySet = false;

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Entrez votre adresse",
  disabled = false,
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const initAutocomplete = useCallback(async () => {
    if (!inputRef.current) return;

    try {
      // Fetch API key from edge function
      const { data, error: fetchError } = await supabase.functions.invoke('get-maps-api-key');
      
      if (fetchError || !data?.apiKey) {
        console.error('Failed to get API key');
        setIsLoading(false);
        return;
      }

      // Set API key only once
      if (!apiKeySet) {
        setOptions({
          key: data.apiKey,
          v: 'weekly',
        });
        apiKeySet = true;
      }

      // Import places library
      const { Autocomplete } = await importLibrary('places') as google.maps.PlacesLibrary;

      if (!inputRef.current) return;

      // Create autocomplete instance
      autocompleteRef.current = new Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'fr' },
        fields: ['formatted_address', 'geometry', 'address_components'],
        types: ['address'],
      });

      // Handle place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        
        if (place?.formatted_address && place?.geometry?.location) {
          const address = place.formatted_address;
          const coordinates = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };

          onChange(address);
          onPlaceSelect?.({ address, coordinates });
        }
      });

      setIsReady(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing autocomplete:', err);
      setIsLoading(false);
    }
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  return (
    <div className={`relative ${className}`}>
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
      <Input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        disabled={disabled}
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
      )}
      {isReady && !isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg 
            className="w-4 h-4 text-muted-foreground" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
      )}
    </div>
  );
}
