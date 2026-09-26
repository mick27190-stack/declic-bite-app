import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getCookieConsent, saveCookieConsent, OPEN_COOKIE_PREFS_EVENT } from '@/lib/cookieConsent';
import { loadAnalyticsIfConsented } from '@/lib/analyticsLoader';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = getCookieConsent();
    if (c) loadAnalyticsIfConsented(c.analytics);
    else setVisible(true);
    const open = () => {
      setAnalytics(getCookieConsent()?.analytics ?? false);
      setCustom(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_PREFS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFS_EVENT, open);
  }, []);

  const decide = (value: boolean) => {
    saveCookieConsent(value);
    loadAnalyticsIfConsented(value);
    setVisible(false);
    setCustom(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Gestion des cookies" className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5 space-y-3">
        <h2 className="font-display text-xl text-foreground">🍪 Gestion des cookies</h2>
        {!custom ? (
          <>
            <p className="text-sm text-muted-foreground">
              Nous utilisons des cookies pour mesurer l'audience du site et améliorer votre expérience. Vous pouvez accepter, refuser, ou personnaliser vos choix à tout moment.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => decide(true)} className="flex-1">Tout accepter</Button>
              <Button variant="outline" onClick={() => decide(false)} className="flex-1">Tout refuser</Button>
              <Button variant="ghost" onClick={() => { setAnalytics(false); setCustom(true); }} className="flex-1">Personnaliser</Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/50 p-3">
              <div>
                <p className="font-semibold text-sm text-foreground">Cookies essentiels</p>
                <p className="text-xs text-muted-foreground">Nécessaires au fonctionnement du site (panier, connexion, paiement).</p>
              </div>
              <Switch checked disabled aria-label="Cookies essentiels (toujours actifs)" />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/50 p-3">
              <div>
                <p className="font-semibold text-sm text-foreground">Cookies de mesure d'audience</p>
                <p className="text-xs text-muted-foreground">Google Analytics et l'outil d'analyse intégré à la plateforme. Aucune donnée n'est utilisée à des fins publicitaires.</p>
              </div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Cookies de mesure d'audience" />
            </div>
            <Button onClick={() => decide(analytics)} className="w-full">Enregistrer mes choix</Button>
          </>
        )}
        <Link to="/politique-cookies" className="inline-block text-xs text-primary underline underline-offset-2">
          Politique de cookies
        </Link>
      </div>
    </div>
  );
}
