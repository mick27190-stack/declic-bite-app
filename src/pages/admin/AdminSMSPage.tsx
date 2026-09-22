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
import { ArrowLeft, Send, History, Users, AlertTriangle, Clock, FlaskConical, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { analyzeSms, estimateCampaignCost, withStopLink } from '@/lib/smsSegments';
import { smsSendWindowError } from '@/lib/smsSendWindow';
import { useLiveParisTime } from '@/hooks/useLiveParisTime';

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
const mockCampaigns: SMSCampaign[] = [];

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

  // SMS test
  const [testOpen, setTestOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Analyse du message (segments réels, encodage, coût estimé)
  const now = useLiveParisTime();
  const windowError = smsSendWindowError(now);
  // Le lien de désinscription est ajouté à chaque SMS envoyé : il doit être
  // compté dans les segments facturés, sinon le coût affiché est sous-estimé.
  const sms = analyzeSms(withStopLink(message));
  const testSms = analyzeSms(withStopLink(`[TEST] ${message}`));
  const estimatedCost = estimateCampaignCost(sms.segments, recipientCount ?? 0);

  // Pré-remplit le numéro de test avec celui du profil admin connecté.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.phone) setTestPhone(data.phone);
    })();
  }, [user]);

  const handleSendTest = async () => {
    const formatted = formatFrenchPhone(testPhone);
    if (!formatted) {
      toast.error('Numéro de test invalide (ex : 06 12 34 56 78)');
      return;
    }
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-test', {
        body: { message, phone: formatted },
      });
      if (error) throw error;
      if (data?.error === 'sms_not_configured') {
        toast.warning("Messagerie SMS non configurée.");
        return;
      }
      if (data?.error) {
        toast.error(data.message || "Erreur lors de l'envoi du SMS test");
        return;
      }
      toast.success(`SMS test envoyé au ${formatted}`);
      setTestOpen(false);
    } catch {
      toast.error("Erreur lors de l'envoi du SMS test");
    } finally {
      setIsSendingTest(false);
    }
  };


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

  const handleDeleteCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast.success('Campagne supprimée de l\'historique');
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

    if (windowError) {
      toast.error(windowError);
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
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.6rem center',
                    backgroundSize: '1.1rem',
                  }}
                  className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                {message.length}/320 caractères — {sms.segments} segment(s){' '}
                {sms.encoding === 'gsm7' ? 'GSM-7' : 'Unicode'}
              </p>
              {sms.encoding === 'unicode' && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  <p className="text-muted-foreground">
                    Votre message contient des caractères hors GSM-7 (
                    <span className="font-medium">{sms.unicodeChars.slice(0, 10).join(' ')}</span>
                    ) : chaque segment ne fait plus que 70 caractères au lieu de 160, ce qui
                    augmente le coût. Retirez-les (emojis, symboles) pour rester en GSM-7.
                  </p>
                </div>
              )}
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
              {recipientCount !== null && message.trim().length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Coût estimé : <span className="font-medium">{estimatedCost.toFixed(2)} €</span>{' '}
                  ({recipientCount} destinataire(s) × {sms.segments} segment(s) × 0,0734 €)
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Envoi possible uniquement entre 8h et 20h, hors dimanche et jours fériés.
                {windowError && (
                  <span className="block font-medium text-destructive mt-1">{windowError}</span>
                )}
              </span>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                onClick={handleSendSMS}
                disabled={isSending || !message.trim() || !!windowError}
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
              <Button
                variant="outline"
                onClick={() => setTestOpen(true)}
                disabled={!message.trim()}
                className="w-full md:w-auto"
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Envoyer un SMS test
              </Button>
            </div>
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
                    <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          aria-label="Supprimer la campagne"
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

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un SMS test</DialogTitle>
            <DialogDescription>
              Le message sera envoyé uniquement à ce numéro, précédé de « [TEST] ». Il n'est pas
              compté dans la campagne ni dans le fichier client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-phone">Numéro de test</Label>
            <Input
              id="test-phone"
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="06 12 34 56 78"
            />
            <p className="text-sm text-muted-foreground">
              {testSms.segments} segment(s) {testSms.encoding === 'gsm7' ? 'GSM-7' : 'Unicode'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSendTest} disabled={isSendingTest || !testPhone.trim()}>
              {isSendingTest ? 'Envoi…' : 'Envoyer le test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
