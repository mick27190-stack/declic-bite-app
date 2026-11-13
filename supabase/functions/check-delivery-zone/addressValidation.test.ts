import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hasCompleteStreetAddress } from './addressValidation.ts';

const component = (type: string, name: string) => ({ types: [type], long_name: name });

Deno.test('12 Rue du Hameau is a complete numbered street address', () => {
  assertEquals(hasCompleteStreetAddress([
    component('street_number', '12'), component('route', 'Rue du Hameau'),
  ]), true);
});

Deno.test('3 Chemin du Hameau is a complete numbered street address', () => {
  assertEquals(hasCompleteStreetAddress([
    component('street_number', '3'), component('route', 'Chemin du Hameau'),
  ]), true);
});

Deno.test('a lieu-dit or hameau alone remains blocked, even with a number', () => {
  assertEquals(hasCompleteStreetAddress([
    component('street_number', '12'), component('neighborhood', 'Hameau des Champs'),
  ]), false);
});

Deno.test('a street without a number remains blocked', () => {
  assertEquals(hasCompleteStreetAddress([component('route', 'Rue du Hameau')]), false);
});

Deno.test('a postal code and commune alone remain blocked', () => {
  assertEquals(hasCompleteStreetAddress([
    component('postal_code', '27190'), component('locality', 'Conches-en-Ouche'),
  ]), false);
});

Deno.test('missing or empty address components remain blocked', () => {
  assertEquals(hasCompleteStreetAddress(), false);
  assertEquals(hasCompleteStreetAddress([
    component('street_number', ' '), component('route', 'Rue du Hameau'),
  ]), false);
});