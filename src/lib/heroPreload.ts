import animMobileAsset from '@/assets/declic-anim-mobile-v3.webp.asset.json';
import animDesktopAsset from '@/assets/declic-anim-desktop-v3.webp.asset.json';
import posterAsset from '@/assets/declic-poster-v3.webp.asset.json';

export const heroPosterUrl = posterAsset.url;

// Appareils modestes / connexions lentes : on n'affiche (et donc on ne précharge)
// que le poster statique, l'animation provoquerait des saccades.
export function pickHeroAnim(): string | null {
  if (typeof window === 'undefined') return null;
  const nav = navigator as any;
  const conn = nav.connection;
  if (conn?.saveData) return null;
  if (conn?.effectiveType && /2g|slow-2g|3g/.test(conn.effectiveType)) return null;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return null;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return null;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return window.innerWidth < 640 ? animMobileAsset.url : animDesktopAsset.url;
}

function addPreloadLink(href: string, priority: 'high' | 'low') {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/webp';
  link.href = href;
  (link as any).fetchPriority = priority;
  document.head.appendChild(link);
}

let heroAnimPromise: Promise<string | null> | null = null;

/**
 * Démarre le téléchargement (et le décodage hors thread principal) du poster et
 * de l'animation dès le chargement de l'application, avant même le rendu React :
 * sur iOS/Android l'image est déjà en cache quand la page d'accueil s'affiche.
 * Le résultat est mémorisé, les appels suivants réutilisent la même promesse.
 */
export function preloadHeroMedia(): Promise<string | null> {
  if (heroAnimPromise) return heroAnimPromise;
  if (typeof window === 'undefined') return Promise.resolve(null);

  // Poster : prioritaire, c'est le premier pixel affiché.
  addPreloadLink(heroPosterUrl, 'high');

  const src = pickHeroAnim();
  if (!src) {
    heroAnimPromise = Promise.resolve(null);
    return heroAnimPromise;
  }

  // Animation : préchargée en priorité basse pour ne pas concurrencer le poster
  // ni le rendu initial, mais lancée immédiatement (plus d'attente d'idle).
  addPreloadLink(src, 'low');

  heroAnimPromise = (async () => {
    const img = new Image();
    img.decoding = 'async';
    (img as any).fetchPriority = 'low';
    img.src = src;
    try {
      if (img.decode) await img.decode();
      else await new Promise((res) => { img.onload = res; img.onerror = res; });
    } catch {
      return null;
    }
    return src;
  })();

  return heroAnimPromise;
}
