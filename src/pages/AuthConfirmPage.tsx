import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'verifying' | 'success' | 'error';

const AuthConfirmPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        // 1) Modern PKCE / token_hash flow (?token_hash=...&type=...)
        const tokenHash =
          params.get('token_hash') ||
          params.get('token') ||
          hashParams.get('token_hash') ||
          hashParams.get('token');
        const rawType = params.get('type') || hashParams.get('type');
        const type = (rawType === 'email_change_new' || rawType === 'email_change_current'
          ? 'email_change'
          : rawType) as
          | 'signup'
          | 'email'
          | 'email_change'
          | 'recovery'
          | 'invite'
          | 'magiclink'
          | null;

        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        } else {
          // 2) Legacy hash flow (#access_token=...&refresh_token=...&type=...)
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          } else {
            throw new Error('Lien de confirmation invalide ou expiré.');
          }
        }

        // Force a fresh user fetch so email_confirmed_at is up to date.
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const email = userData.user?.email;
        if (email && userData.user?.id) {
          try {
            await supabase
              .from('profiles')
              .update({ email })
              .eq('user_id', userData.user.id);
          } catch (e) {
            console.error('Profile email sync failed:', e);
          }
        }

        // Refresh the local session so the AuthContext picks up the newly
        // confirmed email (and email_confirmed_at) without a manual sign-in.
        try {
          await supabase.auth.refreshSession();
        } catch (e) {
          console.error('Session refresh failed:', e);
        }
        try {
          await refreshProfile();
        } catch (e) {
          console.error('Profile refresh failed:', e);
        }

        setStatus('success');
        setMessage('Votre adresse email est vérifiée.');
        toast.success('Email vérifié avec succès !');
        setTimeout(() => navigate('/profile', { replace: true }), 1500);
      } catch (e: any) {
        console.error('Email confirm error:', e);
        setStatus('error');
        setMessage(
          e?.message ||
            'Impossible de vérifier votre email. Le lien est peut-être expiré.',
        );
      }
    };
    run();
  }, [params, navigate, refreshProfile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-background flex items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center space-y-4">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h1 className="font-display text-2xl">Vérification en cours…</h1>
            <p className="text-muted-foreground text-sm">
              Merci de patienter pendant que nous confirmons votre adresse email.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <h1 className="font-display text-2xl">Email vérifié !</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <Button onClick={() => navigate('/profile', { replace: true })} className="w-full">
              Aller à mon profil
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-14 h-14 text-destructive mx-auto" />
            <h1 className="font-display text-2xl">Vérification impossible</h1>
            <p className="text-muted-foreground text-sm">{message}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/profile')} className="w-full">
                Ouvrir mon profil
              </Button>
              <Button variant="outline" onClick={() => navigate('/auth')} className="w-full">
                Retour à la connexion
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthConfirmPage;
