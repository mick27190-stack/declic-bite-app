/** Extrait le message d'erreur réel renvoyé par une Edge Function.
 *  `supabase.functions.invoke` lève une FunctionsHttpError générique
 *  (« Edge Function returned a non-2xx status code ») : le vrai message
 *  se trouve dans le corps JSON de la réponse. */
export async function edgeErrorMessage(error: unknown, fallback = 'Action impossible'): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  const res = ctx as Response | undefined;
  if (res && typeof (res as Response).text === 'function') {
    try {
      const raw = await (res as Response).clone().text();
      try {
        const parsed = JSON.parse(raw) as { error?: string; message?: string };
        if (parsed?.error || parsed?.message) return String(parsed.error ?? parsed.message);
      } catch {
        if (raw.trim()) return raw.trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
