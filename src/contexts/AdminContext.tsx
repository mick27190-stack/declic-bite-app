import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type AppRole = 'super_admin' | 'secondary_super_admin' | 'site_admin_conches' | 'site_admin_beaumont' | 'secondary_admin_conches' | 'secondary_admin_beaumont' | 'livreur_conches' | 'livreur_beaumont' | 'user';

interface AdminContextType {
  roles: AppRole[];
  isSuperAdmin: boolean;
  isSiteAdminConches: boolean;
  isSiteAdminBeaumont: boolean;
  isSecondaryAdminConches: boolean;
  isSecondaryAdminBeaumont: boolean;
  isLivreurConches: boolean;
  isLivreurBeaumont: boolean;
  isAnyLivreur: boolean;
  livreurSite: 'conches' | 'beaumont' | null;
  isAnyAdmin: boolean;
  canManageMenu: boolean;
  canManageOrders: boolean;
  canManageChat: boolean;
  canSendSMS: boolean;
  canManageSecondaryAdmins: boolean;
  loading: boolean;
  refreshRoles: () => Promise<void>;
  assignRole: (phone: string, role: AppRole, site?: string) => Promise<{ error: Error | null }>;
  removeRole: (phone: string, role: AppRole) => Promise<{ error: Error | null }>;
  toggleAdminActive: (id: string, active: boolean) => Promise<{ error: Error | null }>;
  getAdminPhones: () => Promise<{ data: any[]; error: Error | null }>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (data && !error) {
      setRoles(data.map(r => r.role as AppRole));
    } else {
      setRoles([]);
    }
    setLoading(false);
  };

  const refreshRoles = async () => {
    if (user) {
      await fetchRoles(user.id);
    }
  };

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    // Re-sync roles against admin_phones so that any deactivation
    // (e.g. a livreur disabled in the admin section) is reflected immediately,
    // then load the resulting roles.
    const syncAndFetch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke('assign-admin-role', {
            body: { user_id: user.id, phone: user.phone },
          });
        }
      } catch (e) {
        console.error('Error syncing roles:', e);
      }
      await fetchRoles(user.id);
    };
    syncAndFetch();

    // Keep the badge/permissions live: if the roles change in the database
    // (granted or revoked), update the UI without a reload.
    const channel = supabase
      .channel(`user_roles_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => fetchRoles(user.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);


  // A secondary super admin has the exact same rights as the super admin.
  const isSuperAdmin = roles.includes('super_admin') || roles.includes('secondary_super_admin');
  const isSiteAdminConches = roles.includes('site_admin_conches');
  const isSiteAdminBeaumont = roles.includes('site_admin_beaumont');
  const isSecondaryAdminConches = roles.includes('secondary_admin_conches');
  const isSecondaryAdminBeaumont = roles.includes('secondary_admin_beaumont');

  const isLivreurConches = roles.includes('livreur_conches');
  const isLivreurBeaumont = roles.includes('livreur_beaumont');
  const isAnyLivreur = isLivreurConches || isLivreurBeaumont;
  const livreurSite: 'conches' | 'beaumont' | null = isLivreurConches
    ? 'conches'
    : isLivreurBeaumont
      ? 'beaumont'
      : null;

  const isAnyAdmin = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont || isSecondaryAdminConches || isSecondaryAdminBeaumont;

  // Permissions based on roles
  const canManageMenu = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;
  const canManageOrders = isAnyAdmin;
  const canManageChat = isAnyAdmin;
  const canSendSMS = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;
  const canManageSecondaryAdmins = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;

  const assignRole = async (phone: string, role: AppRole, site?: string) => {
    try {
      // Enforce limits: a single super admin and at most 2 secondary super admins.
      if (role === 'super_admin' || role === 'secondary_super_admin') {
        const { count } = await supabase
          .from('admin_phones')
          .select('id', { count: 'exact', head: true })
          .eq('role', role);
        const limit = role === 'super_admin' ? 1 : 2;
        if ((count ?? 0) >= limit) {
          throw new Error(
            role === 'super_admin'
              ? "Il ne peut y avoir qu'un seul Super Admin"
              : "On ne peut définir que 2 Super Admin secondaires"
          );
        }
      }

      // Add to admin_phones table
      const { error } = await supabase
        .from('admin_phones')
        .insert({
          phone,
          role,
          site,
          created_by: user?.id
        });
      
      if (error) throw error;

      // Grant the role on any matching account right away so its badge/permissions
      // update instantly via the user_roles realtime channel (no reload needed).
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone', phone)
        .maybeSingle();
      if (profile?.user_id) {
        await supabase
          .from('user_roles')
          .upsert(
            { user_id: profile.user_id, role },
            { onConflict: 'user_id,role' }
          );
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const removeRole = async (phone: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('admin_phones')
        .delete()
        .eq('phone', phone)
        .eq('role', role);
      
      if (error) throw error;

      // Revoke the role on any matching account right away so its badge/permissions
      // disappear instantly via the user_roles realtime channel (no reload needed).
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone', phone)
        .maybeSingle();
      if (profile?.user_id) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', profile.user_id)
          .eq('role', role);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  // Enable/disable an admin entry. When disabled, the matching user_roles
  // entries are removed so the access is revoked immediately; when re-enabled
  // the role is granted back to any matching account.
  const toggleAdminActive = async (id: string, active: boolean) => {
    try {
      const { data: row, error: updateError } = await supabase
        .from('admin_phones')
        .update({ active })
        .eq('id', id)
        .select('phone, role')
        .single();

      if (updateError) throw updateError;
      if (!row) return { error: null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('phone', row.phone)
        .maybeSingle();

      if (profile?.user_id) {
        if (active) {
          await supabase
            .from('user_roles')
            .upsert(
              { user_id: profile.user_id, role: row.role as AppRole },
              { onConflict: 'user_id,role' }
            );
        } else {
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', profile.user_id)
            .eq('role', row.role as AppRole);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };


  const getAdminPhones = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_phones')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  };

  return (
    <AdminContext.Provider value={{
      roles,
      isSuperAdmin,
      isSiteAdminConches,
      isSiteAdminBeaumont,
      isSecondaryAdminConches,
      isSecondaryAdminBeaumont,
      isLivreurConches,
      isLivreurBeaumont,
      isAnyLivreur,
      livreurSite,
      isAnyAdmin,
      canManageMenu,
      canManageOrders,
      canManageChat,
      canSendSMS,
      canManageSecondaryAdmins,
      loading,
      refreshRoles,
      assignRole,
      removeRole,
      toggleAdminActive,
      getAdminPhones
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
