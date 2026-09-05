import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CODE: Record<string, string> = { conches: 'CONC', beaumont: 'BEAU' };

/**
 * Attribue un numéro de facture séquentiel (par établissement et par année)
 * au moment de la capture du paiement Stripe. Ne régénère jamais un numéro
 * déjà attribué : dans ce cas, retourne null (rien à mettre à jour).
 */
export async function assignInvoiceNumber(
  sb: SupabaseClient,
  site: string,
  existing?: string | null,
): Promise<string | null> {
  if (existing) return null;
  const year = new Date().getFullYear();
  const { data, error } = await sb.rpc('next_invoice_number', {
    p_establishment_id: site,
    p_year: year,
  });
  if (error || data == null) {
    console.error('next_invoice_number failed:', error?.message);
    return null;
  }
  const seq = String(Number(data)).padStart(6, '0');
  return `F-${year}-${CODE[site] ?? 'CONC'}-${seq}`;
}
