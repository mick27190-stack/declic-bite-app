import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { hasCurrentLegalConsent, recordConsents } from '@/lib/consent';

/** Pages où la modal ne doit jamais bloquer (lecture des documents légaux,
 *  parcours d'authentification par lien email). */
const EXEMPT_PATHS = [
  '/cgv',
  '/confidentialite',
  '/mentions-legales',
  '/reset-password',
  '/auth/confirm',
  '/auth/callback',
  '/unsubscribe',
];

/**
 * Modal bloquante de régularisation RGPD pour les comptes créés avant la
 * mise en place du système de consentement. Aucune fermeture possible :
 * le client doit accepter les CGV / la Politique de confidentialité.
 * Le panier en cours n'est jamais touché.
 */
export default function ConsentUpdateDialog() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [needsConsent, setNeedsConsent] = useState(false);
  const [acceptLegal, setAcceptLegal] = useState(false);
  const [acceptSms, setAcceptSms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (loading || !user) {
      setNeedsConsent(false);
      return;
    }
    (async () => {
      const ok = await hasCurrentLegalConsent();
      if (!cancelled && ok === false) setNeedsConsent(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const exempt = EXEMPT_PATHS.some((p) => pathname.startsWith(p));

  // Empêche le défilement de la page derrière la modal.
  useEffect(() => {
    if (needsConsent && !exempt) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [needsConsent, exempt]);

  if (!needsConsent || exempt) return null;

  const handleConfirm = async () => {
    if (!acceptLegal) {
      setError('Vous devez accepter les CGV et la Politique de confidentialité pour continuer.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await recordConsents([
        { type_consentement: 'cgv_politique', accepte: true },
        { type_consentement: 'sms_marketing', accepte: acceptSms },
      ]);
      setNeedsConsent(false);
    } catch {
      setError("L'enregistrement a échoué. Merci de réessayer dans un instant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-update-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-sm"
    >
      <div className="glass-card w-full max-w-md rounded-2xl border border-border p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 id="consent-update-title" className="text-xl font-bold text-foreground">
            Mise à jour de nos conditions
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Nos Conditions Générales de Vente et notre Politique de confidentialité ont
          évolué. Merci de bien vouloir en prendre connaissance et confirmer votre accord
          pour continuer à utiliser votre compte Déclic Pizza.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <Checkbox
            id="consent-legal"
            checked={acceptLegal}
            onCheckedChange={(v) => {
              setAcceptLegal(v === true);
              if (v === true) setError(null);
            }}
            className="mt-0.5"
          />
          <label htmlFor="consent-legal" className="text-sm leading-relaxed text-foreground">
            J'ai lu et j'accepte les{' '}
            <a
              href="/cgv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Conditions Générales de Vente
            </a>{' '}
            et la{' '}
            <a
              href="/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Politique de confidentialité
            </a>
          </label>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-border/60 p-3">
          <Checkbox
            id="consent-sms"
            checked={acceptSms}
            onCheckedChange={(v) => setAcceptSms(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="consent-sms" className="text-sm leading-relaxed text-muted-foreground">
            J'accepte de recevoir par SMS les offres promotionnelles et actualités de
            Déclic Pizza. Vous pouvez vous désinscrire à tout moment.
            <span className="mt-1 block text-xs italic">Facultatif</span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

        <Button
          onClick={handleConfirm}
          disabled={!acceptLegal || saving}
          className="mt-6 w-full"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirmer
        </Button>
      </div>
    </div>
  );
}
