import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Loader2 } from 'lucide-react';

// Restaurant coordinates
const RESTAURANT_COORDS = {
  conches: { lat: 48.9612, lng: 0.9419 },
  beaumont: { lat: 49.0789, lng: 0.7825 },
};

interface DeliveryZoneMapProps {
  restaurantId: 'conches' | 'beaumont';
  customerCoordinates?: { lat: number; lng: number } | null;
  className?: string;
}

let apiKeySet = false;

export function DeliveryZoneMap({ 
  restaurantId, 
  customerCoordinates,
  className = ''
}: DeliveryZoneMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const restaurantMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const customerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const restaurantCoords = RESTAURANT_COORDS[restaurantId];
  const DELIVERY_RADIUS_METERS = 12000; // 12 km

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        // Fetch API key from edge function
        const { data, error: fetchError } = await supabase.functions.invoke('get-maps-api-key');
        
        if (fetchError || !data?.apiKey) {
          throw new Error('Impossible de charger la carte');
        }

        // Set API key only once
        if (!apiKeySet) {
          setOptions({
            key: data.apiKey,
            v: 'weekly',
          });
          apiKeySet = true;
        }

        // Import required libraries
        const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

        if (!isMounted || !mapRef.current) return;

        // Create the map
        googleMapRef.current = new Map(mapRef.current, {
          center: restaurantCoords,
          zoom: 11,
          mapId: 'DELIVERY_ZONE_MAP',
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Add delivery zone circle
        circleRef.current = new google.maps.Circle({
          map: googleMapRef.current,
          center: restaurantCoords,
          radius: DELIVERY_RADIUS_METERS,
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          strokeColor: '#22c55e',
          strokeOpacity: 0.8,
          strokeWeight: 2,
        });

        // Create restaurant marker element
        const restaurantPinElement = document.createElement('div');
        restaurantPinElement.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #ea580c, #dc2626);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
            border: 3px solid white;
            font-size: 18px;
          ">🍕</div>
        `;

        // Add restaurant marker
        restaurantMarkerRef.current = new AdvancedMarkerElement({
          map: googleMapRef.current,
          position: restaurantCoords,
          title: restaurantId === 'conches' ? 'Déclic Pizza Conches' : 'Déclic Pizza Beaumont',
          content: restaurantPinElement,
        });

        setMapLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading map:', err);
        if (isMounted) {
          setError('Erreur lors du chargement de la carte');
          setIsLoading(false);
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [restaurantId]);

  // Update customer marker when coordinates change
  useEffect(() => {
    if (!googleMapRef.current || !mapLoaded) return;

    const updateCustomerMarker = async () => {
      // Remove existing customer marker
      if (customerMarkerRef.current) {
        customerMarkerRef.current.map = null;
        customerMarkerRef.current = null;
      }

      if (customerCoordinates) {
        const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

        // Create customer marker element
        const customerPinElement = document.createElement('div');
        customerPinElement.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            border: 3px solid white;
            font-size: 14px;
          ">📍</div>
        `;

        // Add new customer marker
        customerMarkerRef.current = new AdvancedMarkerElement({
          map: googleMapRef.current,
          position: customerCoordinates,
          title: 'Votre adresse',
          content: customerPinElement,
        });

        // Fit bounds to show both markers
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(restaurantCoords);
        bounds.extend(customerCoordinates);
        googleMapRef.current.fitBounds(bounds, 50);
      } else {
        // Reset to restaurant view
        googleMapRef.current.setCenter(restaurantCoords);
        googleMapRef.current.setZoom(11);
      }
    };

    updateCustomerMarker();
  }, [customerCoordinates, restaurantCoords, mapLoaded]);

  // Update circle when restaurant changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setCenter(restaurantCoords);
    }
    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.position = restaurantCoords;
      restaurantMarkerRef.current.title = restaurantId === 'conches' ? 'Déclic Pizza Conches' : 'Déclic Pizza Beaumont';
    }
    if (googleMapRef.current && !customerCoordinates) {
      googleMapRef.current.setCenter(restaurantCoords);
    }
  }, [restaurantId, restaurantCoords, customerCoordinates]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 rounded-lg ${className}`}>
        <div className="text-center text-muted-foreground p-4">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Chargement de la carte...</p>
          </div>
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ minHeight: '300px' }}
      />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-background/95 backdrop-blur-sm rounded-lg p-3 shadow-lg text-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-red-600 border-2 border-white shadow flex items-center justify-center text-xs">🍕</div>
          <span>Restaurant</span>
        </div>
        {customerCoordinates && (
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white shadow flex items-center justify-center text-xs">📍</div>
            <span>Votre adresse</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-500/30 border-2 border-green-500" />
          <span>Zone de livraison (12 km)</span>
        </div>
      </div>
    </div>
  );
}
