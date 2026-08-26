import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import ConsentMigrationStats from '@/components/admin/ConsentMigrationStats';

type AppRole = 'super_admin' | 'secondary_super_admin' | 'site_admin_conches' | 'site_admin_beaumont' | 'secondary_admin_conches' | 'secondary_admin_beaumont' | 'livreur_conches' | 'livreur_beaumont';

interface AdminPhone {
  id: string;
  phone: string;
  role: AppRole;
  site: string | null;
  active: boolean;
  created_at: string;
  first_name?: string | null;
}

const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  secondary_super_admin: 'Super Admin Secondaire',
  site_admin_conches: 'Admin Conches',
  site_admin_beaumont: 'Admin Beaumont',
  secondary_admin_conches: 'Admin Secondaire Conches',
  secondary_admin_beaumont: 'Admin Secondaire Beaumont',
  livreur_conches: 'Livreur Conches',
  livreur_beaumont: 'Livreur Beaumont'
};

const roleBadgeColors: Record<AppRole, string> = {
  super_admin: 'bg-red-500',
  secondary_super_admin: 'bg-red-400',
  site_admin_conches: 'bg-blue-500',
  site_admin_beaumont: 'bg-green-500',
  secondary_admin_conches: 'bg-blue-300',
  secondary_admin_beaumont: 'bg-green-300',
  livreur_conches: 'bg-amber-500',
  livreur_beaumont: 'bg-amber-600'
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    isSuperAdmin, 
    isSiteAdminConches, 
    isSiteAdminBeaumont,
    canManageSecondaryAdmins,
    loading: adminLoading,
    assignRole,
    removeRole,
    toggleAdminActive,
    getAdminPhones
  } = useAdmin();

  const [adminPhones, setAdminPhones] = useState<AdminPhone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<AppRole | ''>('');

  const fetchAdminPhones = async () => {
    setIsLoading(true);
    const { data, error } = await getAdminPhones();
    if (!error) {
      const admins = data as AdminPhone[];
      // Récupère les prénoms depuis les profils en fonction du numéro de téléphone
      const { data: profiles } = await supabase
        .from('profiles')
        .select('phone, first_name');
      const normalize = (p?: string | null) => (p || '').replace(/\D/g, '');
      const phoneToName = new Map<string, string | null>();
      (profiles || []).forEach((pr) => {
        if (pr.phone) phoneToName.set(normalize(pr.phone), pr.first_name);
      });
      setAdminPhones(
        admins.map((a) => ({ ...a, first_name: phoneToName.get(normalize(a.phone)) ?? null }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isSuperAdmin) {
        navigate('/admin');
      } else {
        fetchAdminPhones();
      }
    }
  }, [user, isSuperAdmin, authLoading, adminLoading]);

  const getAvailableRoles = (): { value: AppRole; label: string }[] => {
    if (isSuperAdmin) {
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'secondary_super_admin', label: 'Super Admin Secondaire' },
        { value: 'site_admin_conches', label: 'Admin Site Conches' },
        { value: 'site_admin_beaumont', label: 'Admin Site Beaumont' },
        { value: 'secondary_admin_conches', label: 'Admin Secondaire Conches' },
        { value: 'secondary_admin_beaumont', label: 'Admin Secondaire Beaumont' },
        { value: 'livreur_conches', label: 'Livreur Conches' },
        { value: 'livreur_beaumont', label: 'Livreur Beaumont' }
      ];
    }
    if (isSiteAdminConches) {
      return [
        { value: 'secondary_admin_conches', label: 'Admin Secondaire Conches' },
        { value: 'livreur_conches', label: 'Livreur Conches' }
      ];
    }
    if (isSiteAdminBeaumont) {
      return [
        { value: 'secondary_admin_beaumont', label: 'Admin Secondaire Beaumont' },
        { value: 'livreur_beaumont', label: 'Livreur Beaumont' }
      ];
    }
    return [];
  };

  const handleAddAdmin = async () => {
    if (!newPhone || !newRole) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    // Determine site based on role
    let site: string | undefined;
    if (newRole.includes('conches')) site = 'conches';
    if (newRole.includes('beaumont')) site = 'beaumont';

    const { error } = await assignRole(newPhone, newRole, site);
    
    if (error) {
      toast.error('Erreur lors de l\'ajout: ' + error.message);
    } else {
      toast.success('Administrateur ajouté avec succès');
      setNewPhone('');
      setNewRole('');
      setIsDialogOpen(false);
      fetchAdminPhones();
    }
  };

  const handleRemoveAdmin = async (phone: string, role: AppRole) => {
    const { error } = await removeRole(phone, role);
    
    if (error) {
      toast.error('Erreur lors de la suppression: ' + error.message);
    } else {
      toast.success('Administrateur supprimé');
      fetchAdminPhones();
    }
  };

  const isSiteAdminRole = (role: AppRole) =>
    role.startsWith('site_admin_') || role.startsWith('secondary_admin_') || role.startsWith('livreur_');

  const handleToggleActive = async (admin: AdminPhone, active: boolean) => {
    const { error } = await toggleAdminActive(admin.id, active);
    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success(active ? 'Admin activé' : 'Admin désactivé');
      fetchAdminPhones();
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-primary">Gestion des Administrateurs</h1>
            <p className="text-sm text-muted-foreground">Ajouter ou supprimer des admins par numéro de téléphone</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <ConsentMigrationStats />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Administrateurs</CardTitle>
              <CardDescription>
                Liste des numéros de téléphone avec accès administrateur
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter un admin
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un administrateur</DialogTitle>
                  <DialogDescription>
                    Entrez le numéro de téléphone et le rôle de l'administrateur.
                    Le rôle sera attribué automatiquement lors de sa connexion.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <Input
                      id="phone"
                      placeholder="+33612345678"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Rôle</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles().map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddAdmin}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : adminPhones.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun administrateur configuré
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead>Date d'ajout</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminPhones.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {admin.first_name || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono">{admin.phone}</TableCell>
                      <TableCell>
                        <Badge className={roleBadgeColors[admin.role]}>
                          {roleLabels[admin.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{admin.site || '-'}</TableCell>
                      <TableCell>
                        {isSiteAdminRole(admin.role) ? (
                          <Switch
                            checked={admin.active}
                            onCheckedChange={(checked) => handleToggleActive(admin, checked)}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {admin.active ? 'Actif' : 'Inactif'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveAdmin(admin.phone, admin.role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
