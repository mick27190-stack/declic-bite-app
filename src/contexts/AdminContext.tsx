import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

type AppRole = 'super_admin' | 'site_admin_conches' | 'site_admin_beaumont' | 'secondary_admin_conches' | 'secondary_admin_beaumont' | 'user';

interface AdminContextType {
  roles: AppRole[];
  isSuperAdmin: boolean;
  isSiteAdminConches: boolean;
  isSiteAdminBeaumont: boolean;
  isSecondaryAdminConches: boolean;
  isSecondaryAdminBeaumont: boolean;
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
    if (user) {
      fetchRoles(user.id);
    } else {
      setRoles([]);
      setLoading(false);
    }
  }, [user]);

  const isSuperAdmin = roles.includes('super_admin');
  const isSiteAdminConches = roles.includes('site_admin_conches');
  const isSiteAdminBeaumont = roles.includes('site_admin_beaumont');
  const isSecondaryAdminConches = roles.includes('secondary_admin_conches');
  const isSecondaryAdminBeaumont = roles.includes('secondary_admin_beaumont');
  
  const isAnyAdmin = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont || isSecondaryAdminConches || isSecondaryAdminBeaumont;

  // Permissions based on roles
  const canManageMenu = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;
  const canManageOrders = isAnyAdmin;
  const canManageChat = isAnyAdmin;
  const canSendSMS = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;
  const canManageSecondaryAdmins = isSuperAdmin || isSiteAdminConches || isSiteAdminBeaumont;

  const assignRole = async (phone: string, role: AppRole, site?: string) => {
    try {
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
