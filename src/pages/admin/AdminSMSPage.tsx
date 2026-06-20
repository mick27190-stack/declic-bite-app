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
    message: '🍕 Mardi et Mercredi, toutes nos pizzas Senior à 10€ ! Venez en profiter !',
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

  const refreshRecipientCount = useCallback(async () => {
    let query = supabase.from('customers').select('id', { count: 'exact', head: true }).not('phone', 'is', null);
    const selected: string[] = [];
    if (targetConches) selected.push('conches');
    if (targetBeaumont) selected.push('beaumont');
    if (selected.length === 1) {
      query = query.or(`site.eq.${selected[0]},site.is.null`);
    }
    const { count } = await query;
    setRecipientCount(count ?? 0);
  }, [targetConches, targetBeaumont]);

  useEffect(() => {
    if (canSendSMS) refreshRecipientCount();
  }, [canSendSMS, refreshRecipientCount]);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!canSendSMS) {
        navigate('/admin');
      }
    }
  }, [user, canSendSMS, authLoading, adminLoading]);

  // Set default targets based on role
  useEffect(() => {
    if (!isSuperAdmin) {
      setTargetConches(isSiteAdminConches);
      setTargetBeaumont(isSiteAdminBeaumont);
    }
  }, [isSuperAdmin, isSiteAdminConches, isSiteAdminBeaumont]);

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

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000));

    const site = targetConches && targetBeaumont ? 'all' : targetConches ? 'conches' : 'beaumont';
    const newCampaign: SMSCampaign = {
      id: Date.now().toString(),
      message,
      recipientCount: Math.floor(Math.random() * 100) + 50,
      sentAt: new Date().toISOString(),
      site
    };

    setCampaigns(prev => [newCampaign, ...prev]);
    setMessage('');
    setIsSending(false);
    toast.success('SMS envoyés avec succès !');
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
