import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const BodySchema = z.object({
  version_document: z.string().min(1).max(50).optional(),
  entries: z
    .array(
      z.object({
        type_consentement: z.enum(['cgv_politique', 'sms_marketing']),
        accepte: z.boolean(),
      }),
    )
    .min(1)
    .max(10),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Non authentifié' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // L'identité vient UNIQUEMENT du jeton, jamais du corps de la requête.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: 'Non authentifié' }, 401);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: 'Requête invalide' }, 400);
  }
  if (!parsed.success) {
    return json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0].trim() || null;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { error } = await admin.from('consentements').insert(
    parsed.data.entries.map((entry) => ({
      client_id: userId,
      type_consentement: entry.type_consentement,
      accepte: entry.accepte,
      version_document: parsed.data.version_document ?? null,
      adresse_ip: ip,
    })),
  );

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});
