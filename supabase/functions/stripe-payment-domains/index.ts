import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  listPaymentMethodDomains,
  registerPaymentMethodDomain,
  validatePaymentMethodDomain,
  type StripeSite,
} from '../_shared/stripe.ts';
import { requireUser, serviceClient } from '../_shared/orderAccess.ts';

const SITES: StripeSite[] = ['conches', 'beaumont'];

const DEFAULT_DOMAINS = [
  'declicpizza.fr',
  'www.declicpizza.fr',
  'declic-pizza-app.lovable.app',
];

async function requireSuperAdmin(req: Request): Promise<void> {
  const userId = await requireUser(req);
  const sb = serviceClient();
  const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', userId);
  const ok = (roles ?? []).some((r) =>
    ['super_admin', 'secondary_super_admin'].includes(r.role as string),
  );
  if (!ok) throw new Error('Droits Super Admin requis');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await requireSuperAdmin(req);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const domains: string[] = Array.isArray(body.domains) && body.domains.length
      ? body.domains.map((d: unknown) => String(d))
      : DEFAULT_DOMAINS;
    const dryRun = body.dry_run === true;

    const report: Record<string, unknown> = {};

    for (const site of SITES) {
      const siteReport: Record<string, unknown>[] = [];
      let existing: Record<string, unknown>[] = [];
      try {
        const list = await listPaymentMethodDomains(site);
        existing = (list.data as Record<string, unknown>[]) ?? [];
      } catch (e) {
        report[site] = { error: (e as Error).message };
        continue;
      }

      for (const domain of domains) {
        try {
          let entry = existing.find((d) => d.domain_name === domain);
          if (!entry && !dryRun) {
            entry = await registerPaymentMethodDomain(site, domain);
          }
          if (entry && !dryRun) {
            entry = await validatePaymentMethodDomain(site, entry.id as string);
          }
          siteReport.push({
            domain,
            registered: Boolean(entry),
            apple_pay: (entry?.apple_pay as Record<string, unknown>)?.status ?? null,
            google_pay: (entry?.google_pay as Record<string, unknown>)?.status ?? null,
          });
        } catch (e) {
          siteReport.push({ domain, error: (e as Error).message });
        }
      }
      report[site] = siteReport;
    }

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
