export type ClosureType = 'orders' | 'site';

/**
 * Libellés client unifiés selon le type de blocage choisi par l'admin :
 * « Blocage des commandes en ligne » vs « Fermeture du site ».
 */
export function closureTitle(type: ClosureType): string {
  return type === 'site' ? 'Site fermé' : 'Commandes en ligne bloquées';
}

export function closureDefaultMessage(type: ClosureType): string {
  return type === 'site'
    ? "Le restaurant est actuellement fermé. Aucune commande ne peut être prise, sur place comme en ligne."
    : "Les commandes en ligne sont momentanément suspendues. Vous pouvez contacter le restaurant par téléphone.";
}

export function closureMessage(type: ClosureType, reason?: string | null): string {
  const trimmed = (reason ?? '').trim();
  return trimmed || closureDefaultMessage(type);
}
