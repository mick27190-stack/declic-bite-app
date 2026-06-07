import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

import { MapPin, Loader2, AlertTriangle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const DELIVERY_RADIUS_METERS = 12000; // 12 km

// Haversine distance in meters
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  const [retryCount, setRetryCount] = useState(0);

  const restaurantCoords = RESTAURANT_COORDS[restaurantId];

  // Compute in/out of zone status for the badge
  const customerDistance = customerCoordinates
    ? distanceMeters(restaurantCoords, customerCoordinates)
    : null;
  const isInZone =
    customerDistance !== null ? customerDistance <= DELIVERY_RADIUS_METERS : null;

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setMapLoaded(false);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;

        if (!apiKey) {
          throw new Error('Impossible de charger la carte');
        }

        // Set API key only once
        if (!apiKeySet) {
          setOptions({
            key: apiKey,
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

        // Add highlighted delivery zone circle
        circleRef.current = new google.maps.Circle({
          map: googleMapRef.current,
          center: restaurantCoords,
          radius: DELIVERY_RADIUS_METERS,
          fillColor: '#22c55e',
          fillOpacity: 0.18,
          strokeColor: '#16a34a',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          clickable: false,
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
  }, [restaurantId, retryCount]);

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
      <div className={`flex items-center justify-center bg-muted/50 rounded-lg ${className}`} style={{ minHeight: '300px' }}>
        <div className="text-center text-muted-foreground p-6 max-w-xs">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Carte indisponible</p>
          <p className="text-xs mb-4">{error}</p>
          <Button size="sm" variant="outline" onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/60 backdrop-blur-sm rounded-lg z-10 animate-in fade-in">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-3">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">Chargement de la carte…</p>
            <p className="text-xs text-muted-foreground mt-0.5">Préparation de la zone de livraison</p>
          </div>
        </div>
      )}

      {/* In/out of delivery zone status badge */}
      {mapLoaded && customerCoordinates && isInZone !== null && (
        <div
          className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 ${
            isInZone
              ? 'bg-green-500/90 text-white'
              : 'bg-destructive/90 text-destructive-foreground'
          }`}
        >
          {isInZone ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Dans la zone de livraison
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Hors zone ({(customerDistance! / 1000).toFixed(1)} km)
            </>
          )}
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
          <div className="w-5 h-5 rounded-full bg-green-500/30 border-2 border-green-600" />
          <span>Zone de livraison (12 km)</span>
        </div>
      </div>
    </div>
  );
}
