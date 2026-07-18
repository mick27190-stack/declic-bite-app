import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = 'loading' | 'ready' | 'confirmed' | 'invalid' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState(data?.alreadyUnsubscribed ? 'confirmed' : 'invalid');
          return;
        }
        setEmail(data?.email ?? null);
        setState(data?.alreadyUnsubscribed ? 'confirmed' : 'ready');
      } catch {
        setState('error');
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? 'confirmed' : 'error');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-orange-500">🍕 Déclic Pizza</h1>
        {state === 'loading' && <p>Vérification en cours…</p>}
        {state === 'ready' && (
          <>
            <h2 className="text-xl font-semibold">Se désabonner des emails</h2>
            <p className="text-muted-foreground">
              {email
                ? `Confirmez la désinscription de ${email}.`
                : 'Confirmez votre désinscription.'}
            </p>
            <Button onClick={confirm} disabled={submitting}>
              {submitting ? 'Traitement…' : 'Confirmer la désinscription'}
            </Button>
          </>
        )}
        {state === 'confirmed' && (
          <p>Vous êtes désinscrit. Vous ne recevrez plus nos emails.</p>
        )}
        {state === 'invalid' && (
          <p className="text-destructive">Lien de désinscription invalide ou expiré.</p>
        )}
        {state === 'error' && (
          <p className="text-destructive">Une erreur est survenue. Réessayez plus tard.</p>
        )}
      </div>
    </div>
  );
}
