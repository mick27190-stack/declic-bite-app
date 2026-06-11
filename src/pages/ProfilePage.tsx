import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  LogOut, 
  Plus, 
  Trash2, 
  Star, 
  ArrowLeft,
  Loader2,
  Edit2,
  Check,
  X,
  MessageSquare,
  Send
} from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useCustomerChat } from '@/hooks/useCustomerChat';
import { useAdminPresenceWatch } from '@/hooks/useAdminPresence';

interface AddressForm {
  label: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
}

function ProfileChat() {
  const { profile } = useAuth();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendMessage } = useCustomerChat();
  const { isOnline } = useAdminPresenceWatch();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg);
  };

  const siteName = profile?.preferred_restaurant || 'votre restaurant';

  return (
    <div className="glass-card p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Chat avec {siteName}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
          <span className="text-[10px] text-muted-foreground">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
        </div>
      </div>

      <ScrollArea className="h-64 rounded-lg border border-border p-3 mb-3" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Envoyez un message à votre restaurant, nous vous répondrons au plus vite !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isCustomer = msg.sender_type === 'customer';
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isCustomer
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isCustomer ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Votre message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, addresses, signOut, updateProfile, addAddress, deleteAddress, setDefaultAddress, loading } = useAuth();
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || ''
  });
  
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm>({
    label: 'Domicile',
    street: '',
    city: '',
    postal_code: '',
    country: 'France',
    is_default: addresses.length === 0,
    latitude: null,
    longitude: null
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    const { error } = await updateProfile(profileForm);
    setSavingProfile(false);
    
    if (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } else {
      toast.success('Profil mis à jour !');
      setEditingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!addressForm.street || !addressForm.city || !addressForm.postal_code) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setSavingAddress(true);
    const { error } = await addAddress(addressForm);
    setSavingAddress(false);
    
    if (error) {
      toast.error('Erreur lors de l\'ajout de l\'adresse');
    } else {
      toast.success('Adresse ajoutée !');
      setShowAddAddress(false);
      setAddressForm({
        label: 'Domicile',
        street: '',
        city: '',
        postal_code: '',
        country: 'France',
        is_default: false,
        latitude: null,
        longitude: null
      });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const { error } = await deleteAddress(id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Adresse supprimée');
    }
  };

  const handleSetDefault = async (id: string) => {
    const { error } = await setDefaultAddress(id);
    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success('Adresse par défaut mise à jour');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-semibold mb-4">Vous n'êtes pas connecté</h2>
        <Button variant="warm" onClick={() => navigate('/auth')}>
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary via-primary-dark to-background p-6 pt-12">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="font-display text-2xl text-white">Mon Profil</h1>
        </div>
        
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">
                {profile?.first_name || 'Utilisateur'} {profile?.last_name || ''}
              </h2>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile Section */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Informations personnelles
            </h3>
            {!editingProfile ? (
              <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                <Edit2 className="w-4 h-4 mr-1" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingProfile(false)}
                  disabled={savingProfile}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUpdateProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
          
          {editingProfile ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prénom</Label>
                  <Input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.first_name || '-'} {profile?.last_name || '-'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.phone || '-'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Addresses Section */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Mes adresses
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddAddress(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>
          
          {addresses.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucune adresse enregistrée
            </p>
          ) : (
            <div className="space-y-3">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`p-3 rounded-lg border ${address.is_default ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{address.label}</span>
                        {address.is_default && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Par défaut
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {address.street}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.postal_code} {address.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!address.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSetDefault(address.id)}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteAddress(address.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Address Modal */}
        {showAddAddress && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="glass-card w-full max-w-md p-6 rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto">
              <h3 className="font-semibold text-lg mb-4">Nouvelle adresse</h3>
              
              <form onSubmit={handleAddAddress} className="space-y-4">
                <div>
                  <Label>Nom de l'adresse</Label>
                  <Input
                    value={addressForm.label}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                    className="mt-1"
                    placeholder="Domicile, Bureau, etc."
                  />
                </div>
                
                <div>
                  <Label>Adresse *</Label>
                  <Input
                    value={addressForm.street}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, street: e.target.value }))}
                    className="mt-1"
                    placeholder="123 rue de la Paix"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Code postal *</Label>
                    <Input
                      value={addressForm.postal_code}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, postal_code: e.target.value }))}
                      className="mt-1"
                      placeholder="75001"
                      required
                    />
                  </div>
                  <div>
                    <Label>Ville *</Label>
                    <Input
                      value={addressForm.city}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                      className="mt-1"
                      placeholder="Paris"
                      required
                    />
                  </div>
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressForm.is_default}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Définir comme adresse par défaut</span>
                </label>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddAddress(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" variant="warm" className="flex-1" disabled={savingAddress}>
                    {savingAddress ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Se déconnecter
        </Button>
      </div>

      <BottomNavigation />
    </div>
  );
}
