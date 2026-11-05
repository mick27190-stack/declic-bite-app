import { describe, it, expect } from 'vitest';
import { isVisibleForLivreur } from './livreurCutoff';

describe("remise à zéro de l'espace livreur à 5h00 (Paris)", () => {
  // Hiver : Paris = UTC+1
  it('garde la commande de 21h la nuit même à 2h du matin', () => {
    expect(isVisibleForLivreur('2026-11-05T20:00:00Z', new Date('2026-11-06T01:00:00Z'))).toBe(true);
  });
  it('masque la commande de la veille à partir de 5h00', () => {
    expect(isVisibleForLivreur('2026-11-05T20:00:00Z', new Date('2026-11-06T04:00:00Z'))).toBe(false);
  });
  it('encore visible à 4h59', () => {
    expect(isVisibleForLivreur('2026-11-05T20:00:00Z', new Date('2026-11-06T03:59:00Z'))).toBe(true);
  });
  // Été : Paris = UTC+2
  it("applique 5h00 heure d'été", () => {
    expect(isVisibleForLivreur('2026-07-15T19:00:00Z', new Date('2026-07-16T02:59:00Z'))).toBe(true);
    expect(isVisibleForLivreur('2026-07-15T19:00:00Z', new Date('2026-07-16T03:00:00Z'))).toBe(false);
  });
});
