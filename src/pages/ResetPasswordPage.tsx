import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Recovery links can arrive in several formats. Establish a valid
    // recovery session before allowing the password to be updated.
    const establishSession = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash') || url.searchParams.get('token');
        const type = url.searchParams.get('type') || hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (code) {
          // PKCE flow: exchange the code for a session
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          // Implicit flow: tokens are in the URL hash
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else if (tokenHash) {
          // Token hash flow: verify the OTP to create a session
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
        }
      } catch (e) {
        console.error('Recovery session error:', e);
      }

      const { data } = await supabase.auth.getSession();
      setReady(!!data.session);
      setChecking(false);
    };

    establishSession();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) newErrors.password = err.errors[0].message;
    }
    if (password !== confirm) {
      newErrors.confirm = 'Les mots de passe ne correspondent pas';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      toast.error(error.message || "Lien invalide ou expiré. Veuillez recommencer.");
    } else {
      toast.success('Mot de passe mis à jour avec succès !');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-background flex flex-col">
      <div className="p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/auth')}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl text-white mb-2">Déclic Pizza</h1>
          <p className="text-white/70">Choisissez un nouveau mot de passe</p>
        </div>

        <div className="w-full max-w-md glass-card p-6 rounded-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword" className="text-foreground">Nouveau mot de passe</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-foreground">Confirmer le mot de passe</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                />
              </div>
              {errors.confirm && <p className="text-destructive text-sm mt-1">{errors.confirm}</p>}
            </div>

            <Button type="submit" className="w-full" variant="warm" disabled={loading || !ready}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mettre à jour le mot de passe'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
