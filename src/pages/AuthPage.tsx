import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Phone, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().trim().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');
const phoneSchema = z.string().regex(/^(\+33|0)[1-9](\d{2}){4}$/, 'Numéro de téléphone invalide');
const nameSchema = z.string().trim().min(2, 'Minimum 2 caractères');

type AuthMode = 'login' | 'signup' | 'phone' | 'otp';

export default function AuthPage() {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithOtp, verifyOtp, loading: authLoading } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const validateLogin = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.email = e.errors[0].message;
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.password = e.errors[0].message;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      nameSchema.parse(firstName);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.firstName = e.errors[0].message;
    }
    
    try {
      nameSchema.parse(lastName);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.lastName = e.errors[0].message;
    }
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.email = e.errors[0].message;
    }
    
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.password = e.errors[0].message;
    }
    
    if (phone) {
      try {
        phoneSchema.parse(phone);
      } catch (e) {
        if (e instanceof z.ZodError) newErrors.phone = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhone = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      phoneSchema.parse(phone);
    } catch (e) {
      if (e instanceof z.ZodError) newErrors.phone = e.errors[0].message;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLogin()) return;
    
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou mot de passe incorrect');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Connexion réussie !');
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignup()) return;
    
    setLoading(true);
    const { error } = await signUp(email, password, firstName, lastName, phone);
    setLoading(false);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Cet email est déjà utilisé');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Compte créé avec succès !');
      navigate('/');
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone()) return;
    
    setLoading(true);
    const formattedPhone = phone.startsWith('0') ? `+33${phone.slice(1)}` : phone;
    const { error } = await signInWithOtp(formattedPhone);
    setLoading(false);
    
    if (error) {
      toast.error('Erreur lors de l\'envoi du code: ' + error.message);
    } else {
      toast.success('Code envoyé par SMS !');
      setMode('otp');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setErrors({ otp: 'Le code doit contenir 6 chiffres' });
      return;
    }
    
    setLoading(true);
    const formattedPhone = phone.startsWith('0') ? `+33${phone.slice(1)}` : phone;
    const { error } = await verifyOtp(formattedPhone, otp);
    setLoading(false);
    
    if (error) {
      toast.error('Code invalide ou expiré');
    } else {
      toast.success('Connexion réussie !');
      navigate('/');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-secondary to-background flex flex-col">
      {/* Header */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl text-white mb-2">Déclic Pizza</h1>
          <p className="text-white/70">
            {mode === 'login' && 'Connectez-vous à votre compte'}
            {mode === 'signup' && 'Créez votre compte'}
            {mode === 'phone' && 'Connexion par SMS'}
            {mode === 'otp' && 'Entrez le code reçu'}
          </p>
        </div>

        {/* Form Card */}
        <div className="w-full max-w-md glass-card p-6 rounded-2xl">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="votre@email.com"
                  />
                </div>
                {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <Label htmlFor="password" className="text-foreground">Mot de passe</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
              </div>
              
              <Button type="submit" className="w-full" variant="warm" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
              </Button>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMode('phone')}
              >
                <Phone className="w-5 h-5 mr-2" />
                Connexion par SMS
              </Button>
              
              <p className="text-center text-sm text-muted-foreground mt-4">
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-primary hover:underline font-medium"
                >
                  Créer un compte
                </button>
              </p>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-foreground">Prénom</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10"
                      placeholder="Jean"
                    />
                  </div>
                  {errors.firstName && <p className="text-destructive text-sm mt-1">{errors.firstName}</p>}
                </div>
                
                <div>
                  <Label htmlFor="lastName" className="text-foreground">Nom</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1"
                    placeholder="Dupont"
                  />
                  {errors.lastName && <p className="text-destructive text-sm mt-1">{errors.lastName}</p>}
                </div>
              </div>
              
              <div>
                <Label htmlFor="emailSignup" className="text-foreground">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="emailSignup"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="votre@email.com"
                  />
                </div>
                {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <Label htmlFor="phoneSignup" className="text-foreground">Téléphone (optionnel)</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phoneSignup"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="06 12 34 56 78"
                  />
                </div>
                {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
              </div>
              
              <div>
                <Label htmlFor="passwordSignup" className="text-foreground">Mot de passe</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="passwordSignup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
              </div>
              
              <Button type="submit" className="w-full" variant="warm" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer mon compte'}
              </Button>
              
              <p className="text-center text-sm text-muted-foreground mt-4">
                Déjà un compte ?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline font-medium"
                >
                  Se connecter
                </button>
              </p>
            </form>
          )}

          {mode === 'phone' && (
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div>
                <Label htmlFor="phoneLogin" className="text-foreground">Numéro de téléphone</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phoneLogin"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    placeholder="06 12 34 56 78"
                  />
                </div>
                {errors.phone && <p className="text-destructive text-sm mt-1">{errors.phone}</p>}
              </div>
              
              <Button type="submit" className="w-full" variant="warm" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Recevoir un code'}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode('login')}
              >
                Retour à la connexion email
              </Button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-center text-muted-foreground text-sm mb-4">
                Un code à 6 chiffres a été envoyé au {phone}
              </p>
              
              <div>
                <Label htmlFor="otp" className="text-foreground">Code de vérification</Label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mt-1 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                {errors.otp && <p className="text-destructive text-sm mt-1">{errors.otp}</p>}
              </div>
              
              <Button type="submit" className="w-full" variant="warm" disabled={loading}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier'}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode('phone')}
              >
                Renvoyer un code
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
