import { assertEquals } from 'jsr:@std/assert@1';
import { formatItems } from './orderCancelledEmail.ts';

Deno.test('cancelled-order email omits bases and pizza sizes for drinks', () => {
  const lines = formatItems([
    { pizza: { name: 'Coca-Cola – 1,25L', category: 'boissons', hasBase: false }, size: { name: 'Senior', price: 0 }, base: 'tomate', price: 3, quantity: 1 },
    { pizza: { name: 'Bouteille de Rosé', category: 'boissons', hasBase: false }, size: { name: 'Senior', price: 0 }, base: 'creme', price: 7, quantity: 1 },
    { pizza: { name: 'Margherita', category: 'classiques' }, size: { name: 'Senior', price: 10 }, base: 'tomate', quantity: 1 },
  ], [3, 7, 10]);

  assertEquals(lines.map((line) => line.details), [undefined, undefined, 'Senior · Base tomate']);
  assertEquals(lines.map((line) => line.price), ['3,00€', '7,00€', '10,00€']);
});