import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_restaurant: string | null;
}

interface Address {
  id: string;
  user_id: string;
  label: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  addresses: Address[];
  loading: boolean;
  signUpWithPhone: (phone: string, password: string, firstName: string, lastName: string, email?: string) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string, password: string) => Promise<{ error: Error | null; isAdmin?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  addAddress: (address: Omit<Address, 'id' | 'user_id'>) => Promise<{ error: Error | null }>;
  updateAddress: (id: string, updates: Partial<Address>) => Promise<{ error: Error | null }>;
  deleteAddress: (id: string) => Promise<{ error: Error | null }>;
  setDefaultAddress: (id: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data as Profile);
    }
  };

  const fetchAddresses = async (userId: string) => {
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false });
    
    if (data) {
      setAddresses(data as Address[]);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchAddresses(user.id)]);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // A recovery (password reset) link establishes a temporary session.
        // No matter where the email link redirected (often the site root),
        // always send the user to the reset-password screen so they can pick
        // a new password.
        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.location.assign('/reset-password');
            return;
          }
        }

        // Defer data fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchAddresses(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setAddresses([]);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchAddresses(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUpWithPhone = async (phone: string, password: string, firstName: string, lastName: string, email?: string) => {
    const formattedPhone = phone.startsWith('0') ? `+33${phone.slice(1)}` : phone;
    const { data, error } = await supabase.auth.signUp({
      phone: formattedPhone,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: formattedPhone,
          email: email || null
        }
      }
    });

    // Attach an email to the account so password reset by email works
    if (!error && data.user && email) {
      try {
        await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: `${window.location.origin}/auth/confirm` }
        );
      } catch (e) {
        console.error('Error attaching email:', e);
      }
      try {
        await supabase.from('profiles').update({ email }).eq('user_id', data.user.id);
      } catch (e) {
        console.error('Error saving email to profile:', e);
      }
    }

    
    // If successful, try to assign admin role based on phone
    if (!error && data.user) {
      try {
        await supabase.functions.invoke('assign-admin-role', {
          body: { user_id: data.user.id, phone: formattedPhone }
        });
      } catch (e) {
        console.error('Error checking admin role:', e);
      }
    }
    
    return { error };
  };

  const signInWithPhone = async (phone: string, password: string) => {
    const formattedPhone = phone.startsWith('0') ? `+33${phone.slice(1)}` : phone;
    const { data, error } = await supabase.auth.signInWithPassword({
      phone: formattedPhone,
      password
    });
    
    // If successful, try to assign admin role based on phone
    let isAdmin = false;
    if (!error && data.user) {
      try {
        const result = await supabase.functions.invoke('assign-admin-role', {
          body: { user_id: data.user.id, phone: formattedPhone }
        });
        if (result.data?.role) {
          isAdmin = true;
        }
      } catch (e) {
        console.error('Error checking admin role:', e);
      }
    }
    
    return { error, isAdmin };
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };



  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAddresses([]);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    // Save all fields (including email) to the profile first
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      return { error };
    }

    // If the email changed, also update it on the auth account so password
    // reset by email works. This sends a confirmation email to the new address.
    if (updates.email && updates.email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({
        email: updates.email,
      });
      if (authError) {
        await fetchProfile(user.id);
        return {
          error: new Error(
            "Adresse enregistrée, mais l'email de confirmation n'a pas pu être envoyé : " +
              authError.message
          ),
        };
      }
    }

    await fetchProfile(user.id);
    return { error: null };
  };

  const addAddress = async (address: Omit<Address, 'id' | 'user_id'>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    // If this is the first address or is_default is true, unset other defaults
    if (address.is_default) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }
    
    const { error } = await supabase
      .from('addresses')
      .insert({ ...address, user_id: user.id });
    
    if (!error) {
      await fetchAddresses(user.id);
    }
    return { error };
  };

  const updateAddress = async (id: string, updates: Partial<Address>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { error } = await supabase
      .from('addresses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (!error) {
      await fetchAddresses(user.id);
    }
    return { error };
  };

  const deleteAddress = async (id: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (!error) {
      await fetchAddresses(user.id);
    }
    return { error };
  };

  const setDefaultAddress = async (id: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    // Unset all defaults first
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user.id);
    
    // Set the new default
    const { error } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (!error) {
      await fetchAddresses(user.id);
    }
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      addresses,
      loading,
      signUpWithPhone,
      signInWithPhone,
      signOut,
      updateProfile,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      refreshProfile,
      resetPasswordForEmail,
      updatePassword

    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
