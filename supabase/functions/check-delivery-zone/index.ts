import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ADDRESS_LENGTH = 200;
const VALID_RESTAURANT_IDS = ['conches', 'beaumont'];

const DELIVERY_RADIUS_KM = 12;

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

    console.log(`Checking delivery zone for restaurant: ${restaurantId}`);

    const restaurantCoords = RESTAURANT_COORDS[restaurantId as keyof RestaurantCoordinates];

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, geocode the address
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    console.log(`Geocoding address: ${address}`);
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      console.error(`Geocoding failed: ${geocodeData.status}`);
      return new Response(
        JSON.stringify({ 
          isInZone: false, 
          error: 'Adresse non trouvée',
          distanceKm: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const addressLocation = geocodeData.results[0].geometry.location;
    console.log(`Address coordinates: ${addressLocation.lat}, ${addressLocation.lng}`);

    // Calculate distance using Distance Matrix API
    const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${restaurantCoords.lat},${restaurantCoords.lng}&destinations=${addressLocation.lat},${addressLocation.lng}&key=${apiKey}`;
    
    const distanceResponse = await fetch(distanceUrl);
    const distanceData = await distanceResponse.json();

    if (distanceData.status !== 'OK' || !distanceData.rows?.[0]?.elements?.[0]) {
      console.error(`Distance calculation failed: ${distanceData.status}`);
      return new Response(
        JSON.stringify({ 
          isInZone: false, 
          error: 'Impossible de calculer la distance',
          distanceKm: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const element = distanceData.rows[0].elements[0];
    if (element.status !== 'OK') {
      console.error(`Distance element status: ${element.status}`);
      return new Response(
        JSON.stringify({ 
          isInZone: false, 
          error: 'Route non trouvée',
          distanceKm: null 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const distanceKm = element.distance.value / 1000;
    const isInZone = distanceKm <= DELIVERY_RADIUS_KM;

    console.log(`Distance: ${distanceKm.toFixed(2)}km, In zone: ${isInZone}`);

    // Extract postal code from geocode result
    const postalCodeComponent = geocodeData.results[0].address_components?.find(
      (c: any) => c.types?.includes('postal_code')
    );
    const postalCode = postalCodeComponent?.long_name || null;
    console.log(`Postal code: ${postalCode}`);

    return new Response(
      JSON.stringify({ 
        isInZone, 
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceText: element.distance.text,
        durationText: element.duration.text,
        addressFormatted: geocodeData.results[0].formatted_address,
        coordinates: addressLocation,
        postalCode
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
