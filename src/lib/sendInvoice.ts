import { supabase } from '@/integrations/supabase/client';
import { generateInvoicePdf, buildInvoiceNumber } from '@/lib/invoicePdf';
import { resolveCompanyForRestaurant, type CompanyInfo } from '@/hooks/useCompanyInfo';
import { blobToCompressedDataUrl } from '@/lib/imageResize';
import type { Order } from '@/types/order';

export interface SendInvoiceResult {
  invoiceNumber: string;
  email: string;
  totalTTC: number;
  /** true = vraie facture numérotée, false = simple récapitulatif de commande */
  isInvoice: boolean;
}


/**
 * Génère la facture PDF d'une commande, la stocke dans le bucket privé
 * `invoices`, l'envoie par e-mail au client et l'enregistre dans la table
 * `invoices` (section « Factures » de l'admin).
 *
 * Utilisé côté admin (envoi manuel) et côté client (demande de facture).
 */
export async function generateAndSendInvoice(
  order: Order,
  companyData: Record<string, CompanyInfo | null>,
): Promise<SendInvoiceResult> {
  if (!order.user_id) throw new Error('Cette commande n’est associée à aucun compte client.');

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, phone')
    .eq('user_id', order.user_id)
    .maybeSingle();
  if (profileErr) throw profileErr;

  const email = profile?.email?.trim();
  if (!email) throw new Error('Aucune adresse e-mail enregistrée dans le profil du client.');

  const fullName =
    `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() ||
    (order as any).customer_name ||
    'Client';

  const company = resolveCompanyForRestaurant(companyData, order.restaurant);
  // Le numéro séquentiel est attribué côté serveur à la capture du paiement.
  // Sans numéro, le document est un simple récapitulatif de commande.
  const invoiceNumber = ((order as any).invoice_number as string | null) ?? null;
  const isCancelled =
    order.status === 'cancelled' ||
    (order as any).order_status === 'cancelled' ||
    (order as any).capture_status === 'cancelled';
  const isInvoice = Boolean(invoiceNumber) && (order as any).capture_status === 'captured' && !isCancelled;
  const reference = isInvoice ? (invoiceNumber as string) : buildInvoiceNumber(order);
  const meta = { number: isInvoice ? (invoiceNumber as string) : null, date: new Date(order.created_at) };

  // Logo (facultatif) intégré au PDF
  let logoDataUrl: string | null = null;
  if (company?.logo_url) {
    try {
      const { data: signed } = await supabase.storage
        .from('company-logos')
        .createSignedUrl(company.logo_url, 60);
      if (signed?.signedUrl) {
        const res = await fetch(signed.signedUrl);
        const b = await res.blob();
        // Le logo n'est affiché qu'à 22 mm dans le PDF : on le redimensionne
        // à 200 px et on le compresse en JPEG (qualité 0.8) pour limiter la
        // taille du PDF et celle du bucket `invoices`.
        logoDataUrl = await blobToCompressedDataUrl(b, 200, 0.8);
      }
    } catch (err) {
      console.warn('Logo fetch failed, continuing without it:', err);
    }
  }

  const { blob, totalTTC } = await generateInvoicePdf(
    order,
    company,
    {
      name: fullName,
      email,
      phone: profile?.phone ?? (order as any).customer_phone ?? null,
      address:
        order.order_type === 'livraison' ? order.delivery_address?.address ?? null : null,
    },
    meta,
    logoDataUrl,
  );

  const siteValue = order.restaurant?.toLowerCase().includes('beaumont')
    ? 'beaumont'
    : 'conches';
  const path = `${siteValue}/${order.user_id}/${reference}.pdf`;

  const { error: upErr } = await supabase.storage
    .from('invoices')
    .upload(path, blob, { contentType: 'application/pdf', upsert: true });

  const { data: signed, error: signErr } = await supabase.storage
    .from('invoices')
    .createSignedUrl(path, 60 * 60 * 24 * 30);

  // Un client n'a pas le droit de remplacer un fichier existant : si le PDF
  // était déjà en place (nouvelle tentative), on réutilise simplement celui-ci.
  if (upErr && !signed?.signedUrl) throw upErr;
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error('URL indisponible');


  const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'invoice',
      recipientEmail: email,
      idempotencyKey: `invoice-${order.id}-${reference}`,
      templateData: {
        customerName: fullName,
        invoiceNumber: reference,
        orderDate: meta.date.toLocaleDateString('fr-FR'),
        totalTTC: totalTTC.toFixed(2).replace('.', ',') + '€',
        downloadUrl: signed.signedUrl,
        companyName: company?.name || 'Déclic Pizza',
      },
    },
  });
  if (mailErr) throw mailErr;

  const { error: recErr } = await supabase.from('invoices').upsert(
    {
      order_id: order.id,
      user_id: order.user_id,
      invoice_number: reference,
      storage_path: path,
      total_ttc: Number(totalTTC.toFixed(2)),
      recipient_email: email,
      customer_name: fullName,
      customer_phone: profile?.phone ?? (order as any).customer_phone ?? null,
      restaurant: order.restaurant,
      site: siteValue,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'invoice_number' },
  );
  if (recErr) console.warn('Failed to record invoice:', recErr);

  return { invoiceNumber: reference, email, totalTTC, isInvoice };
}
