import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ADDRESS_LENGTH = 200;
const VALID_RESTAURANT_IDS = ['conches', 'beaumont'];
const DELIVERY_RADIUS_KM = 12;

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';

interface RestaurantCoordinates {
  conches: { lat: number; lng: number };
  beaumont: { lat: number; lng: number };
}

// Adresses de référence:
// Conches: 1 place Carnot, 27190 Conches-en-Ouche
// Beaumont: 66 rue Saint Nicolas, 27170 Beaumont-le-Roger
const RESTAURANT_COORDS: RestaurantCoordinates = {
  conches: { lat: 48.9592, lng: 0.9416 },
  beaumont: { lat: 49.0825, lng: 0.7769 },
};

// Format distance (meters) to a readable French string
function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`.replace('.', ',');
}

// Format duration (seconds string like "275s") to a readable French string
function formatDuration(duration: string): string {
  const seconds = parseInt(String(duration).replace('s', ''), 10);
  if (isNaN(seconds)) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require a valid authenticated session to prevent paid-API abuse.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { address, restaurantId } = await req.json();

    // Validate inputs
    if (!address || typeof address !== 'string' || !restaurantId || typeof restaurantId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Address and restaurantId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length === 0 || trimmedAddress.length > MAX_ADDRESS_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Invalid address length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_RESTAURANT_IDS.includes(restaurantId)) {
      console.error(`Invalid restaurant ID: ${restaurantId}`);
      return new Response(
        JSON.stringify({ error: 'Invalid restaurant ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!lovableApiKey || !connectionKey) {
      console.error('Google Maps connector credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Service de cartographie non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gatewayHeaders = {
      'Authorization': `Bearer ${lovableApiKey}`,
      'X-Connection-Api-Key': connectionKey,
    };

    const restaurantCoords = RESTAURANT_COORDS[restaurantId as keyof RestaurantCoordinates];

    console.log(`Checking delivery zone for restaurant: ${restaurantId}`);

    // Step 1: Geocode the customer address via the gateway
    const geocodeUrl = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(trimmedAddress)}&region=fr`;
    const geocodeResponse = await fetch(geocodeUrl, { headers: gatewayHeaders });

    if (!geocodeResponse.ok) {
      console.error(`Geocoding gateway error: ${geocodeResponse.status} ${await geocodeResponse.text()}`);
      return new Response(
        JSON.stringify({ isInZone: false, error: 'Service de cartographie indisponible', distanceKm: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geocodeData = await geocodeResponse.json();
    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      console.error(`Geocoding failed: ${geocodeData.status}`);
      return new Response(
        JSON.stringify({ isInZone: false, error: 'Adresse non trouvée', distanceKm: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const addressLocation = geocodeData.results[0].geometry.location;
    console.log(`Address coordinates: ${addressLocation.lat}, ${addressLocation.lng}`);

    // Step 2: Compute driving distance via Routes API (computeRouteMatrix)
    const matrixResponse = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        ...gatewayHeaders,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
      },
      body: JSON.stringify({
        origins: [{
          waypoint: { location: { latLng: { latitude: restaurantCoords.lat, longitude: restaurantCoords.lng } } },
        }],
        destinations: [{
          waypoint: { location: { latLng: { latitude: addressLocation.lat, longitude: addressLocation.lng } } },
        }],
        travelMode: 'DRIVE',
      }),
    });

    if (!matrixResponse.ok) {
      console.error(`Routes gateway error: ${matrixResponse.status} ${await matrixResponse.text()}`);
      return new Response(
        JSON.stringify({ isInZone: false, error: 'Impossible de calculer la distance', distanceKm: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const matrixData = await matrixResponse.json();
    const element = Array.isArray(matrixData) ? matrixData[0] : matrixData;

    if (!element || element.condition !== 'ROUTE_EXISTS' || typeof element.distanceMeters !== 'number') {
      console.error(`No route found: ${JSON.stringify(element)}`);
      return new Response(
        JSON.stringify({ isInZone: false, error: 'Itinéraire non trouvé', distanceKm: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const distanceMeters = element.distanceMeters;
    const distanceKm = distanceMeters / 1000;
    const isInZone = distanceKm <= DELIVERY_RADIUS_KM;

    console.log(`Distance: ${distanceKm.toFixed(2)}km, In zone: ${isInZone}`);

    // Extract postal code from geocode result
    const postalCodeComponent = geocodeData.results[0].address_components?.find(
      (c: any) => c.types?.includes('postal_code')
    );
    const postalCode = postalCodeComponent?.long_name || null;

    return new Response(
      JSON.stringify({
        isInZone,
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceText: formatDistance(distanceMeters),
        durationText: formatDuration(element.duration),
        addressFormatted: geocodeData.results[0].formatted_address,
        coordinates: addressLocation,
        postalCode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking delivery zone:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
