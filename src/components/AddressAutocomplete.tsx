import { useEffect, useRef, useState, useCallback } from 'react';

import { MapPin, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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

interface Suggestion {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
}

function createSessionToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Entrez votre adresse",
  disabled = false,
  className = "",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<string>(createSessionToken());
  const requestIdRef = useRef(0);
  const selectedValueRef = useRef('');
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setError(null);
    setSuggestions([]);
    setIsOpen(false);
    setRetryCount((c) => c + 1);
  }, []);

  useEffect(() => {
    if (disabled) return;

    const searchText = value.trim();

    if (searchText === selectedValueRef.current) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (searchText.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsFetchingSuggestions(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsFetchingSuggestions(true);

      try {
        const { data, error: fnError } = await supabase.functions.invoke('places-autocomplete', {
          body: {
            action: 'autocomplete',
            input: searchText,
            sessionToken: sessionTokenRef.current,
          },
        });

        if (fnError) throw fnError;

        if (requestId === requestIdRef.current) {
          setSuggestions(data?.suggestions ?? []);
          setIsOpen((data?.suggestions ?? []).length > 0);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
        if (requestId === requestIdRef.current) {
          setSuggestions([]);
          setIsOpen(false);
          setError('Impossible de récupérer les suggestions d\'adresse');
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsFetchingSuggestions(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [disabled, value, retryCount]);

  const handleInputChange = (nextValue: string) => {
    if (nextValue !== selectedValueRef.current) {
      selectedValueRef.current = '';
    }
    onChange(nextValue);
  };

  const handleSuggestionSelect = async (suggestion: Suggestion) => {
    setIsFetchingSuggestions(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('places-autocomplete', {
        body: {
          action: 'details',
          placeId: suggestion.placeId,
          sessionToken: sessionTokenRef.current,
        },
      });

      if (fnError) throw fnError;

      const address = data?.address || suggestion.text;
      const coordinates = data?.coordinates;

      selectedValueRef.current = address;
      onChange(address);
      setSuggestions([]);
      setIsOpen(false);
      setError(null);
      sessionTokenRef.current = createSessionToken();

      if (coordinates) {
        onPlaceSelect?.({ address, coordinates });
      }
    } catch (err) {
      console.error('Error selecting address suggestion:', err);
      setError('Impossible de sélectionner cette adresse');
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
          className="pl-10 pr-10"
          disabled={disabled}
          autoComplete="off"
        />
        {isFetchingSuggestions && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}
        {!isFetchingSuggestions && (
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

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSuggestionSelect(suggestion)}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-popover-foreground">
                  {suggestion.mainText || suggestion.text}
                </span>
                {suggestion.secondaryText && (
                  <span className="block text-xs text-muted-foreground">
                    {suggestion.secondaryText}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
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
