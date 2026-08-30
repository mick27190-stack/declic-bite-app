import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/** Validate the caller's JWT (verify_jwt=false on these functions) and return the user id. */
export async function requireUser(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('Authentification requise');
  const token = auth.slice(7);
  const sb = serviceClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw new Error('Session invalide');
  return data.user.id;
}

/** Require an admin that can manage the given site (reuses has_role logic). */
export async function requireAdminForSite(req: Request, site: 'conches' | 'beaumont'): Promise<string> {
  const userId = await requireUser(req);
  const sb = serviceClient();

  const { data: roles } = await sb
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const allowed = new Set([
    'super_admin',
    'secondary_super_admin',
    `site_admin_${site}`,
    `secondary_admin_${site}`,
  ]);
  if ((roles ?? []).some((r) => allowed.has(r.role as string))) return userId;
  throw new Error('Droits administrateur requis pour ce site');
}
