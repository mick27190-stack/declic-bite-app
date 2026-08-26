import { supabase } from '@/integrations/supabase/client';

/** Version courante des documents légaux (CGV + Politique de confidentialité). */
export const LEGAL_DOCS_VERSION = 'v1.0-2026-08';

export type ConsentType = 'cgv_politique' | 'sms_marketing';

export interface ConsentEntry {
  type_consentement: ConsentType;
  accepte: boolean;
}

/**
 * Enregistre un ou plusieurs consentements.
 *
 * L'écriture passe d'abord par l'edge function `record-consent`, qui déduit
 * l'utilisateur du jeton d'authentification et récupère l'adresse IP côté
 * serveur. En cas d'indisponibilité, on retombe sur une insertion directe
 * (protégée par RLS) avec une adresse IP vide — jamais collectée côté client.
 *
 * Les lignes sont TOUJOURS insérées : aucun historique n'est modifié.
 */
export async function recordConsents(entries: ConsentEntry[]): Promise<void> {
  if (entries.length === 0) return;

  try {
    const { data, error } = await supabase.functions.invoke('record-consent', {
      body: { entries, version_document: LEGAL_DOCS_VERSION },
    });
    if (!error && (data as { ok?: boolean } | null)?.ok) return;
  } catch {
    // On bascule sur l'insertion directe ci-dessous.
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  await supabase.from('consentements').insert(
    entries.map((entry) => ({
      client_id: userId,
      type_consentement: entry.type_consentement,
      accepte: entry.accepte,
      version_document: LEGAL_DOCS_VERSION,
    })),
  );
}

/** Dernier état connu d'un consentement pour l'utilisateur connecté. */
export async function getLatestConsent(
  type: ConsentType,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('consentements')
    .select('accepte')
    .eq('type_consentement', type)
    .order('date_consentement', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.accepte;
}

/**
 * Vrai si le client connecté a déjà accepté la version courante des CGV /
 * de la Politique de confidentialité. `null` si la vérification échoue
 * (réseau, RLS…) — dans ce cas on n'affiche pas la modal de régularisation.
 */
export async function hasCurrentLegalConsent(): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('consentements')
    .select('id')
    .eq('type_consentement', 'cgv_politique')
    .eq('version_document', LEGAL_DOCS_VERSION)
    .eq('accepte', true)
    .limit(1);

  if (error) return null;
  return (data?.length ?? 0) > 0;
}
