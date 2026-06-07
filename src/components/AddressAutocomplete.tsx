/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setIsReady(false);
    setRetryCount((c) => c + 1);
  }, []);

  const initAutocomplete = useCallback(async () => {
    if (!inputRef.current) return;

    try {
      const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

      if (!apiKey) {
        throw new Error('Clé Google Maps non configurée');
      }

      // Set API key only once
      if (!apiKeySet) {
        setOptions({
          key: apiKey,
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
      setError(null);
    } catch (err) {
      console.error('Error initializing autocomplete:', err);
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de l\'autocomplétion');
    }
  }, [onChange, onPlaceSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete, retryCount]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
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
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
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

      {/* Loading message */}
      {isLoading && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/60" />
          </span>
          Chargement de l&apos;autocomplétion d&apos;adresse…
        </p>
      )}

      {/* Error state with retry */}
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 animate-in fade-in slide-in-from-top-1">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-destructive">Autocomplétion indisponible</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            className="h-7 px-2 gap-1 text-xs shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}

