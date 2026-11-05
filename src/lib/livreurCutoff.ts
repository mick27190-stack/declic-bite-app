import { parisCivilDate } from './parisTime';

/** Heure (Paris) à laquelle l'espace livreur repart à zéro. */
export const LIVREUR_RESET_HOUR = 5;

/**
 * Instant (UTC) du dernier passage à 5h00 heure de Paris.
 * Les commandes créées avant cet instant sont masquées de l'espace livreur
 * uniquement (l'administration continue de les afficher).
 */
export function livreurServiceStart(now: Date = new Date()): Date {
  const civil = parisCivilDate(now);
  // Décalage Paris - UTC à cet instant (gère l'heure d'été/hiver).
  const realOffset = Date.UTC(
    civil.getFullYear(), civil.getMonth(), civil.getDate(),
    civil.getHours(), civil.getMinutes(), civil.getSeconds(),
  ) - Math.floor(now.getTime() / 1000) * 1000;
  const day = new Date(civil);
  if (civil.getHours() < LIVREUR_RESET_HOUR) day.setDate(day.getDate() - 1);
  const resetWall = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), LIVREUR_RESET_HOUR, 0, 0);
  return new Date(resetWall - realOffset);
}

export function isVisibleForLivreur(createdAt: string, now: Date = new Date()): boolean {
  return new Date(createdAt).getTime() >= livreurServiceStart(now).getTime();
}
