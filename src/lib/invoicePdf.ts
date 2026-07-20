import jsPDF from 'jspdf';
import { getPizzaSizePrice, getNonPizzaPrice } from '@/lib/pricing';
import type { Order } from '@/types/order';
import type { CompanyInfo } from '@/hooks/useCompanyInfo';

const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];
// TVA restauration à emporter / livraison en France = 10%
const TVA_RATE = 0.10;

export interface InvoiceRecipient {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface InvoiceMeta {
  number: string;
  date: Date;
}

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

function orderTypeLabel(t: string) {
  if (t === 'livraison') return 'Livraison';
  if (t === 'emporter') return 'À emporter';
  if (t === 'sur_place') return 'Sur place';
  return t;
}

export function buildInvoiceNumber(order: Pick<Order, 'id' | 'created_at'>): string {
  const d = new Date(order.created_at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `F-${y}${m}${day}-${order.id.slice(0, 6).toUpperCase()}`;
}

export function generateInvoicePdf(
  order: Order,
  company: CompanyInfo | null,
  recipient: InvoiceRecipient,
  meta: InvoiceMeta,
  logoDataUrl?: string | null,
): { blob: Blob; totalTTC: number; totalHT: number; tva: number } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 15;

  // ---------- HEADER ----------
  const headerTop = 15;
  const logoSize = 22;
  let companyX = marginX;

  if (logoDataUrl) {
    try {
      const fmt = logoDataUrl.includes('image/png') ? 'PNG'
        : logoDataUrl.includes('image/jpeg') || logoDataUrl.includes('image/jpg') ? 'JPEG'
        : logoDataUrl.includes('image/webp') ? 'WEBP'
        : 'PNG';
      doc.addImage(logoDataUrl, fmt, marginX, headerTop, logoSize, logoSize);
      companyX = marginX + logoSize + 6;
    } catch {
      // ignore malformed logo
    }
  }

  // Company info — kept to the right of the logo so text never overlaps it
  const companyMaxWidth = (pageWidth - marginX) - companyX - 70; // leave room for invoice title on the right
  let cy = headerTop + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(249, 115, 22);
  doc.text(company?.name || 'DÉCLIC PIZZA', companyX, cy);
  cy += 5;
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (company?.address) {
    const lines = doc.splitTextToSize(company.address, companyMaxWidth) as string[];
    doc.text(lines, companyX, cy);
    cy += lines.length * 4;
  }
  if (company?.phone) { doc.text(`Tél : ${company.phone}`, companyX, cy); cy += 4; }
  if (company?.email) { doc.text(`Email : ${company.email}`, companyX, cy); cy += 4; }
  if (company?.siret) { doc.text(`SIRET : ${company.siret}`, companyX, cy); cy += 4; }

  // Invoice title (top-right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text('FACTURE', pageWidth - marginX, headerTop + 6, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`N° ${meta.number}`, pageWidth - marginX, headerTop + 13, { align: 'right' });
  doc.text(
    `Date : ${meta.date.toLocaleDateString('fr-FR')}`,
    pageWidth - marginX, headerTop + 18, { align: 'right' },
  );
  doc.text(
    `Commande : #${order.id.slice(0, 8)}`,
    pageWidth - marginX, headerTop + 23, { align: 'right' },
  );

  // Separator below header (always past both logo & company text)
  let y = Math.max(cy, headerTop + logoSize, headerTop + 26) + 6;
  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 8;

  // ---------- CUSTOMER / ORDER INFO ----------
  const addr = order.order_type === 'livraison' ? order.delivery_address?.address : null;
  const when = order.order_type === 'livraison'
    ? (order.delivery_estimate || order.pickup_time)
    : order.pickup_time;

  // Two independent columns with strict widths — no overlap possible
  const colGap = 6;
  const colWidth = (pageWidth - 2 * marginX - colGap) / 2;
  const leftX = marginX;
  const rightX = marginX + colWidth + colGap;

  // Left column — Facturé à
  const leftLines: string[] = [];
  if (recipient.name) leftLines.push(recipient.name);
  if (recipient.email) leftLines.push(recipient.email);
  if (recipient.phone) leftLines.push(recipient.phone);
  if (addr) {
    const wrapped = doc.splitTextToSize(addr, colWidth - 6) as string[];
    leftLines.push(...wrapped);
  }

  // Right column — Détails commande
  const rightLines: string[] = [orderTypeLabel(order.order_type)];
  if (when) rightLines.push(`Horaire : ${when}`);

  const bodyLineCount = Math.max(leftLines.length, rightLines.length, 1);
  const boxH = 10 + bodyLineCount * 4.5 + 4;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(230, 230, 230);
  doc.rect(leftX, y, colWidth, boxH, 'FD');
  doc.rect(rightX, y, colWidth, boxH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Facturé à', leftX + 3, y + 6);
  doc.text('Commande', rightX + 3, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  leftLines.forEach((line, i) => doc.text(line, leftX + 3, y + 11 + i * 4.5));
  rightLines.forEach((line, i) => doc.text(line, rightX + 3, y + 11 + i * 4.5));

  y += boxH + 8;

  // Items table
  const orderDate = new Date(order.created_at);
  const items = Array.isArray(order.items) ? order.items : [];
  const rows = items.map((item: any) => {
    const qty = item?.quantity ?? 1;
    const name = item?.pizza?.name ?? 'Produit';
    const sizeName = item?.size?.name;
    const supplements = Array.isArray(item?.supplements) ? item.supplements : [];
    const isPizza = item?.pizza?.category && PIZZA_CATEGORIES.includes(item.pizza.category);
    const unitBase = isPizza
      ? getPizzaSizePrice(item.size.id, item.pizza.category, orderDate)
      : getNonPizzaPrice(item.pizza, item.size);
    const supTotal = supplements.reduce((s: number, sup: any) => s + (sup?.price ?? 0), 0);
    const unit = unitBase + supTotal;
    const sub = unit * qty;
    const suppLabel = supplements.map((s: any) => s.name).join(', ');
    const label = [
      sizeName ? `${name} (${sizeName})` : name,
      suppLabel ? `+ ${suppLabel}` : '',
    ].filter(Boolean).join(' — ');
    return { qty, label, unit, sub };
  });

  // Table header
  const colX = {
    desc: marginX,
    qty: pageWidth - marginX - 70,
    pu: pageWidth - marginX - 50,
    total: pageWidth - marginX,
  };
  doc.setFillColor(249, 115, 22);
  doc.rect(marginX, y, pageWidth - 2 * marginX, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Désignation', colX.desc + 2, y + 5.5);
  doc.text('Qté', colX.qty, y + 5.5, { align: 'right' });
  doc.text('P.U.', colX.pu, y + 5.5, { align: 'right' });
  doc.text('Total TTC', colX.total, y + 5.5, { align: 'right' });
  y += 8;

  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  rows.forEach((r, i) => {
    const lines = doc.splitTextToSize(r.label, pageWidth - marginX - 75) as string[];
    const rowH = Math.max(6, lines.length * 4.5 + 2);
    if (y + rowH > 260) { doc.addPage(); y = 20; }
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(marginX, y, pageWidth - 2 * marginX, rowH, 'F');
    }
    doc.text(lines, colX.desc + 2, y + 4.5);
    doc.text(String(r.qty), colX.qty, y + 4.5, { align: 'right' });
    doc.text(fmt(r.unit), colX.pu, y + 4.5, { align: 'right' });
    doc.text(fmt(r.sub), colX.total, y + 4.5, { align: 'right' });
    y += rowH;
  });

  y += 4;
  const totalTTC = Number(order.total_price) || rows.reduce((s, r) => s + r.sub, 0);
  const totalHT = totalTTC / (1 + TVA_RATE);
  const tva = totalTTC - totalHT;

  // Totals block right-aligned
  const totalsX = pageWidth - marginX - 60;
  doc.setFontSize(10);
  doc.text('Total HT', totalsX, y); doc.text(fmt(totalHT), colX.total, y, { align: 'right' }); y += 5;
  doc.text(`TVA (${(TVA_RATE * 100).toFixed(0)}%)`, totalsX, y);
  doc.text(fmt(tva), colX.total, y, { align: 'right' }); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setDrawColor(249, 115, 22);
  doc.line(totalsX, y, colX.total, y);
  y += 5;
  doc.text('TOTAL TTC', totalsX, y);
  doc.text(fmt(totalTTC), colX.total, y, { align: 'right' });
  y += 10;

  // Payment / legal notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const paymentLabel = 'Facture acquittée — paiement à la commande.';
  doc.text(paymentLabel, marginX, y); y += 5;
  doc.text(
    'Pas d’escompte pour paiement anticipé. Pénalités de retard : 3 fois le taux d’intérêt légal.',
    marginX, y,
  );
  y += 4;
  doc.text(
    'Indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).',
    marginX, y,
  );
  y += 8;

  // Footer
  const footer = [
    company?.name || 'Déclic Pizza',
    company?.address,
    company?.siret ? `SIRET ${company.siret}` : null,
    company?.phone ? `Tél ${company.phone}` : null,
    company?.email,
  ].filter(Boolean).join(' • ');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(footer, pageWidth / 2, 288, { align: 'center', maxWidth: pageWidth - 20 });

  const blob = doc.output('blob');
  return { blob, totalTTC, totalHT, tva };
}
