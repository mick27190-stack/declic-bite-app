import { useEffect } from 'react';

/**
 * Empêche la mise en veille de l'écran tant que `enabled` est vrai
 * (tablettes Android en boutique). Utilise l'API Screen Wake Lock native :
 * - demande le wake lock 'screen' à l'activation,
 * - le redemande quand l'onglet redevient visible (le navigateur le libère
 *   automatiquement quand l'onglet passe en arrière-plan),
 * - le libère proprement au démontage / désactivation,
 * - échoue silencieusement si l'API n'est pas disponible (iOS Safari, etc.).
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          // Désactivé entre-temps : on libère immédiatement.
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
      } catch {
        // Refusé (batterie faible, permissions…) : on ignore, l'app continue.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        request();
      }
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
