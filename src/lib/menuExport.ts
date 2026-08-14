import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Pizza } from '@/types/pizza';

const PIZZA_CATS = ['classiques', 'speciales', 'vegetariennes', 'gourmandes', 'bambino'];

export type AvailabilityFn = (id: string, site: 'conches' | 'beaumont') => boolean;

const groupLabel = (category: string) => {
  if (PIZZA_CATS.includes(category)) return 'Pizzas';
  if (category === 'paninis') return 'Paninis';
  if (category === 'boissons') return 'Boissons';
  return 'Autres';
};

const rowsFor = (items: Pizza[], isAvailable: AvailabilityFn) =>
  items.map((p) => [
    groupLabel(p.category),
    p.category,
    p.name,
    p.category === 'boissons' ? (p.description || '') : p.ingredients.join(', '),
    p.basePrice ? `${p.basePrice.toFixed(2)} €` : '',
    isAvailable(p.id, 'conches') ? 'Oui' : 'Non',
    isAvailable(p.id, 'beaumont') ? 'Oui' : 'Non',
  ]);

const HEADERS = ['Type', 'Catégorie', 'Nom', 'Ingrédients / Contenance', 'Prix', 'Conches', 'Beaumont'];

const fileStamp = () => new Date().toISOString().slice(0, 10);

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export function exportMenuToCsv(items: Pizza[], isAvailable: AvailabilityFn) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [HEADERS, ...rowsFor(items, isAvailable)].map((r) => r.map(esc).join(';'));
  const csv = '\uFEFF' + lines.join('\r\n');
  download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `menu-declic-pizza-${fileStamp()}.csv`);
}

export function exportMenuToPdf(items: Pizza[], isAvailable: AvailabilityFn) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const counts = {
    pizzas: items.filter((p) => PIZZA_CATS.includes(p.category)).length,
    paninis: items.filter((p) => p.category === 'paninis').length,
    boissons: items.filter((p) => p.category === 'boissons').length,
  };

  doc.setFontSize(16);
  doc.text('Menu Déclic Pizza', 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Édité le ${new Date().toLocaleDateString('fr-FR')} — Total : ${items.length} · Pizzas : ${counts.pizzas} · Paninis : ${counts.paninis} · Boissons : ${counts.boissons}`,
    14,
    22,
  );

  autoTable(doc, {
    startY: 28,
    head: [HEADERS],
    body: rowsFor(items, isAvailable),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [220, 80, 40], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 26 },
      2: { cellWidth: 45 },
      3: { cellWidth: 110 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 22, halign: 'center' },
    },
  });

  doc.save(`menu-declic-pizza-${fileStamp()}.pdf`);
}
