/**
 * Point unique de chargement des outils de mesure d'audience.
 * Ne charge Google Analytics que si le visiteur a accepté (analytics = true)
 * ET qu'un identifiant est configuré (VITE_GA_MEASUREMENT_ID).
 */
let loaded = false;

export function loadAnalyticsIfConsented(analytics: boolean) {
  if (!analytics || loaded) return;
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
  if (!id) return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id, { anonymize_ip: true });
}
