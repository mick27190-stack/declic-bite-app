import { forwardRef } from 'react';
import { getPizzaSizePrice, getNonPizzaPrice } from '@/lib/pricing';
const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

// TVA restauration à emporter / livraison en France = 10%
const TVA_RATE = 0.10;

const SEP = '--------------------------------';

export interface OrderTicketData {
  id: string;
  created_at: string;
  restaurant?: string;
  order_type: 'emporter' | 'livraison' | 'sur_place' | string;
  status?: string;
  total_price: number;
  pickup_time?: string | null;
  delivery_estimate?: string | null;
  delivery_address?: { address?: string } | null;
  notes?: string | null;
  items?: any[];
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  paid?: boolean;
}

export interface TicketCompanyInfo {
  name?: string | null;
  siret?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Props {
  order: OrderTicketData;
  /** When true, ticket is only visible during print. */
  printOnly?: boolean;
  company?: TicketCompanyInfo | null;
}

function fmt(n: number) {
  return n.toFixed(2) + '€';
}

function centerLine(text: string, width = 32): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}


function padLine(left: string, right: string, width = 32): string {
  const l = left.length > width - right.length - 1
    ? left.slice(0, width - right.length - 1)
    : left;
  const spaces = ' '.repeat(Math.max(1, width - l.length - right.length));
  return l + spaces + right;
}

function orderTypeLabel(t: string) {
  if (t === 'livraison') return 'Livraison';
  if (t === 'emporter') return 'À emporter';
  if (t === 'sur_place') return 'Sur place';
  return t;
}

const OrderTicket = forwardRef<HTMLDivElement, Props>(({ order, printOnly = true, company }, ref) => {
  const date = new Date(order.created_at);
  const items = Array.isArray(order.items) ? order.items : [];

  const lines = items.map((item: any) => {
    const qty = item?.quantity ?? 1;
    const name = item?.pizza?.name ?? 'Produit';
    const sizeName = item?.size?.name;
    const category = item?.pizza?.category;
    const supplements = Array.isArray(item?.supplements) ? item.supplements : [];
    const isPizza = category && PIZZA_CATEGORIES.includes(category);
    const unitBase = isPizza
      ? getPizzaSizePrice(item.size.id, category, date)
      : getNonPizzaPrice(item.pizza, item.size);
    const supTotal = supplements.reduce((s: number, sup: any) => s + (sup?.price ?? 0), 0);
    const unit = unitBase + supTotal;
    const sub = unit * qty;
    return {
      qty,
      name: category !== 'boissons' && sizeName ? `${name} (${sizeName})` : name,
      supplements: supplements.map((s: any) => s.name).join(', '),
      notes: item?.notes,
      unit,
      sub,
    };
  });

  const totalTTC = Number(order.total_price) || lines.reduce((s, l) => s + l.sub, 0);
  const totalHT = totalTTC / (1 + TVA_RATE);
  const tva = totalTTC - totalHT;

  const paymentLabel = order.paid
    ? 'Payé en ligne'
    : order.payment_method
      ? `À régler : ${order.payment_method}`
      : 'À payer sur place';

  const deliveryTime =
    order.order_type === 'livraison'
      ? (order.delivery_estimate || order.pickup_time)
      : order.pickup_time;

  const companyHeader = (() => {
    const parts: string[] = [];
    const title = company?.name || 'DÉCLIC PIZZA';
    parts.push(centerLine(title.toUpperCase()));
    if (!company?.name && order.restaurant) parts.push(centerLine(order.restaurant));
    if (company?.address) parts.push(centerLine(company.address));
    if (company?.phone) parts.push(centerLine('Tél : ' + company.phone));
    if (company?.email) parts.push(centerLine(company.email));
    if (company?.siret) parts.push(centerLine('SIRET : ' + company.siret));
    return parts.join('\n');
  })();

  return (
    <div ref={ref} className={printOnly ? 'order-ticket order-ticket--print-only' : 'order-ticket'}>
      <pre className="order-ticket__body">
{`${companyHeader}
${SEP}
Commande : #${order.id.slice(0, 8)}
Date     : ${date.toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})}
${SEP}
Client   : ${order.customer_name || '-'}
Tél      : ${order.customer_phone || '-'}
Mode     : ${orderTypeLabel(order.order_type)}
${deliveryTime ? `Horaire  : ${deliveryTime}\n` : ''}${order.order_type === 'livraison' && order.delivery_address?.address
  ? `Adresse  :\n${order.delivery_address.address}\n`
  : ''}${SEP}
${lines
  .map((l) => {
    const head = padLine(`${l.qty}x ${l.name}`, fmt(l.sub));
    const detail = `   PU ${fmt(l.unit)}`;
    const extras: string[] = [];
    if (l.supplements) extras.push(`   + ${l.supplements}`);
    if (l.notes) extras.push(`   Note: ${l.notes}`);
    return [head, detail, ...extras].join('\n');
  })
  .join('\n')}
${SEP}
${padLine('Total HT', fmt(totalHT))}
${padLine(`TVA (${(TVA_RATE * 100).toFixed(0)}%)`, fmt(tva))}
${padLine('TOTAL TTC', fmt(totalTTC))}
${SEP}
${paymentLabel}
${order.notes ? `${SEP}\nNote client :\n${order.notes}\n` : ''}${SEP}
       Merci et à bientôt !
`}
      </pre>
    </div>
  );
});

OrderTicket.displayName = 'OrderTicket';

export default OrderTicket;
