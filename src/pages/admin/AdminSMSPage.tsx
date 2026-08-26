import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Send, History, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserPlus } from 'lucide-react';

const SITE_OPTIONS = [
  { value: 'conches', label: 'Conches-en-Ouche' },
  { value: 'beaumont', label: 'Beaumont-le-Roger' },
] as const;

// Format a French phone number to the +33 international format.
const formatFrenchPhone = (raw: string): string | null => {
  const digits = raw.replace(/[^\d+]/g, '');
  if (/^\+33\d{9}$/.test(digits)) return digits;
  if (/^0\d{9}$/.test(digits)) return '+33' + digits.slice(1);
  if (/^33\d{9}$/.test(digits)) return '+' + digits;
  return null;
};

interface SMSCampaign {
  id: string;
  message: string;
  recipientCount: number;
  sentAt: string;
  site: 'conches' | 'beaumont' | 'all';
}

// Mock data
const mockCampaigns: SMSCampaign[] = [
  {
    id: '1',
    message: '🍕 Mardi, toutes nos pizzas Senior à 10€ ! Venez en profiter !',
    recipientCount: 150,
    sentAt: new Date(Date.now() - 86400000).toISOString(),
    site: 'all'
  },
  {
    id: '2',
    message: 'Nouvelle pizza du mois : La Forestière ! Champignons, lardons et crème fraîche 🌲',
    recipientCount: 85,
    sentAt: new Date(Date.now() - 172800000).toISOString(),
    site: 'conches'
  }
];

export default function AdminSMSPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { canSendSMS, isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont, loading: adminLoading } = useAdmin();
  
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>(mockCampaigns);
  const [message, setMessage] = useState('');
  const [targetConches, setTargetConches] = useState(true);
  const [targetBeaumont, setTargetBeaumont] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);

  // New customer form
  const [newFirstName, setNewFirstName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSite, setNewSite] = useState<'conches' | 'beaumont'>('conches');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  const refreshRecipientCount = useCallback(async () => {
    const selected: string[] = [];
    if (targetConches) selected.push('conches');
    if (targetBeaumont) selected.push('beaumont');
    // Compte uniquement les clients opt-in SMS (les désinscrits sont exclus).
    const { data } = await supabase.rpc('sms_marketing_recipient_count', {
      _sites: selected.length === 1 ? selected : null,
    });
    setRecipientCount(data ?? 0);
  }, [targetConches, targetBeaumont]);


  useEffect(() => {
    if (canSendSMS) refreshRecipientCount();
  }, [canSendSMS, refreshRecipientCount]);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isSuperAdmin) {
        // Restreint aux Super Admins (et Super Admins secondaires) uniquement
        navigate('/admin');
      }
    }
  }, [user, isSuperAdmin, authLoading, adminLoading, navigate]);

  // Set default targets based on role
  useEffect(() => {
    if (!isSuperAdmin) {
      setTargetConches(isSiteAdminConches);
      setTargetBeaumont(isSiteAdminBeaumont);
    }
  }, [isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont]);

  const handleAddCustomer = async () => {
    const formattedPhone = formatFrenchPhone(newPhone);
    if (!formattedPhone) {
      toast.error('Numéro de téléphone invalide (ex : 06 12 34 56 78)');
      return;
    }

    setIsAddingCustomer(true);
    try {
      // Avoid duplicates by phone number.
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (existing) {
        toast.warning('Ce client est déjà dans le fichier client');
        return;
      }

      const { error } = await supabase.from('customers').insert({
        phone: formattedPhone,
        first_name: newFirstName.trim() || null,
        site: newSite,
        source: 'manual',
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Client ajouté au fichier client !');
      setNewFirstName('');
      setNewPhone('');
      refreshRecipientCount();
    } catch (e) {
      toast.error("Erreur lors de l'ajout du client");
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const handleSendSMS = async () => {
    if (!message.trim()) {
      toast.error('Veuillez entrer un message');
      return;
    }

    if (!targetConches && !targetBeaumont) {
      toast.error('Veuillez sélectionner au moins un site');
      return;
    }

    setIsSending(true);

    const sites: string[] = [];
    if (targetConches) sites.push('conches');
    if (targetBeaumont) sites.push('beaumont');

    try {
      const { data, error } = await supabase.functions.invoke('send-promo-sms', {
        body: { message, sites },
      });

      if (error) throw error;

      if (data?.error === 'sms_not_configured') {
        toast.warning(
          `Messagerie SMS non configurée. ${data.recipientCount} client(s) ciblé(s) dans le fichier client.`
        );
      } else if (data?.error) {
        toast.error(data.message || 'Erreur lors de l\'envoi');
        return;
      } else {
        const site = targetConches && targetBeaumont ? 'all' : targetConches ? 'conches' : 'beaumont';
        const newCampaign: SMSCampaign = {
          id: Date.now().toString(),
          message,
          recipientCount: data?.sent ?? data?.recipientCount ?? 0,
          sentAt: new Date().toISOString(),
          site,
        };
        setCampaigns(prev => [newCampaign, ...prev]);
        setMessage('');
        toast.success(`SMS envoyés à ${data?.sent ?? 0} client(s) !`);
      }
    } catch (e) {
      toast.error('Erreur lors de l\'envoi des SMS');
    } finally {
      setIsSending(false);
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
            <h1 className="text-xl font-bold text-primary">SMS Promotionnels</h1>
            <p className="text-sm text-muted-foreground">Envoyer des offres à vos clients</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Add customer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Ajouter un client
            </CardTitle>
            <CardDescription>
              Enregistrez un nouveau client dans le fichier client pour l'inclure dans les prochaines campagnes SMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="new-firstname">Prénom (facultatif)</Label>
                <Input
                  id="new-firstname"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="Jean"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-phone">Téléphone</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-site">Site</Label>
                <select
                  id="new-site"
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value as 'conches' | 'beaumont')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {SITE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              onClick={handleAddCustomer}
              disabled={isAddingCustomer || !newPhone.trim()}
              variant="secondary"
              className="w-full md:w-auto"
            >
              {isAddingCustomer ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Ajout en cours...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter au fichier client
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Compose SMS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Nouvelle campagne SMS
            </CardTitle>
            <CardDescription>
              Composez votre message promotionnel (max 160 caractères pour un SMS)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="🍕 Offre spéciale ! ..."
                rows={4}
                maxLength={320}
              />
              <p className="text-sm text-muted-foreground text-right">
                {message.length}/320 caractères ({Math.ceil(message.length / 160)} SMS)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Destinataires</Label>
              <div className="flex flex-wrap gap-4">
                {(isSuperAdmin || isSiteAdminConches) && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="conches"
                      checked={targetConches}
                      onCheckedChange={(checked) => setTargetConches(checked as boolean)}
                      disabled={!isSuperAdmin && isSiteAdminConches}
                    />
                    <Label htmlFor="conches" className="cursor-pointer">
                      Clients Conches-en-Ouche
                    </Label>
                  </div>
                )}
                {(isSuperAdmin || isSiteAdminBeaumont) && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="beaumont"
                      checked={targetBeaumont}
                      onCheckedChange={(checked) => setTargetBeaumont(checked as boolean)}
                      disabled={!isSuperAdmin && isSiteAdminBeaumont}
                    />
                    <Label htmlFor="beaumont" className="cursor-pointer">
                      Clients Beaumont-le-Roger
                    </Label>
                  </div>
                )}
              </div>
              {recipientCount !== null && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                  <Users className="h-4 w-4" />
                  {recipientCount} client(s) inscrits aux SMS promotionnels seront contactés
                </p>
              )}
            </div>

            <Button 
              onClick={handleSendSMS} 
              disabled={isSending || !message.trim()}
              className="w-full md:w-auto"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer la campagne
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des campagnes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune campagne envoyée
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Destinataires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        {new Date(campaign.sentAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {campaign.message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {campaign.site === 'all' ? 'Tous' : campaign.site}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.recipientCount}
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
