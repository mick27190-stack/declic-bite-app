import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
const MAX_INPUT_LENGTH = 200;

async function gatewayFetch(
  path: string,
  options: RequestInit,
  lovableApiKey: string,
  connectionKeys: string[],
) {
  let lastErrorBody = '';

  for (const connectionKey of connectionKeys) {
    const response = await fetch(`${GATEWAY_URL}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': connectionKey,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      lastErrorBody = body;
      console.error(`Places gateway request failed [${response.status}]: ${body}`);
      if (response.status === 403 && body.includes('API_KEY_HTTP_REFERRER_BLOCKED')) {
        lastErrorBody =
          "La clé Google Maps utilisée côté serveur est restreinte par référent HTTP. " +
          "Dans Google Cloud Console, réglez les restrictions d'application de la clé serveur sur « Aucune » ou « Adresses IP ».";
      }
      continue;
    }

    try {
      return body ? JSON.parse(body) : null;
    } catch (_error) {
      return body;
    }
  }

  throw new Error(lastErrorBody || 'Google Maps gateway request failed');

}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, input, placeId, sessionToken } = await req.json();

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const connectionKeys = [Deno.env.get('GOOGLE_MAPS_API_KEY_1'), Deno.env.get('GOOGLE_MAPS_API_KEY')]
      .filter((key): key is string => Boolean(key));

    if (!lovableApiKey || connectionKeys.length === 0) {
      console.error('Google Maps connector credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Service de cartographie non configuré' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'autocomplete') {
      if (!input || typeof input !== 'string') {
        return new Response(
          JSON.stringify({ error: 'input is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const trimmed = input.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) {
        return new Response(
          JSON.stringify({ suggestions: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await gatewayFetch(
        '/places/v1/places:autocomplete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: trimmed,
            includedRegionCodes: ['fr'],
            languageCode: 'fr',
            sessionToken: sessionToken || undefined,
          }),
        },
        lovableApiKey,
        connectionKeys,
      );

      const suggestions = (data?.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          text: s.placePrediction.text?.text ?? '',
          mainText: s.placePrediction.structuredFormat?.mainText?.text ?? '',
          secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
        }));

      return new Response(
        JSON.stringify({ suggestions }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'details') {
      if (!placeId || typeof placeId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'placeId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await gatewayFetch(
        `/places/v1/places/${encodeURIComponent(placeId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-FieldMask': 'id,formattedAddress,location',
            ...(sessionToken ? { 'X-Goog-Session-Token': sessionToken } : {}),
          },
        },
        lovableApiKey,
        connectionKeys,
      );

      return new Response(
        JSON.stringify({
          address: data?.formattedAddress ?? '',
          coordinates: data?.location
            ? { lat: data.location.latitude, lng: data.location.longitude }
            : null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('places-autocomplete error:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur lors de la recherche d\'adresse' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
