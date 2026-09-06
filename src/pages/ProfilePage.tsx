import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
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
  Send,
  ArrowDown,
  AlertTriangle,
  Gift,
  ChevronRight
} from 'lucide-react';
import { useLoyaltyCard } from '@/hooks/useLoyalty';
import { rewardLabel, SITE_LABELS } from '@/lib/loyalty';
import { useChatClosure } from '@/hooks/useChatClosure';
import { BottomNavigation } from '@/components/BottomNavigation';
import CustomerNotificationBell from '@/components/CustomerNotificationBell';
import PushTestPanel from '@/components/PushTestPanel';
import NotificationPermissionReminder from '@/components/NotificationPermissionReminder';
import CommunicationPreferences from '@/components/CommunicationPreferences';

import { useCustomerChat } from '@/hooks/useCustomerChat';
import { useAdminPresenceWatch } from '@/hooks/useAdminPresence';
import { useUserOrders, isOrderPaymentAuthorized } from '@/hooks/useOrders';
import { parisIsoDate } from '@/lib/parisTime';
import { OrderTimeline } from '@/components/OrderTimeline';
import { Clock, Package, CheckCircle, XCircle, History } from 'lucide-react';
import { useOrdersLinePrices, linePriceAt } from '@/lib/orderPricing';
import { statusLabels, statusColors } from '@/types/order';
import { supabase } from '@/integrations/supabase/client';
import { generateAndSendInvoice } from '@/lib/sendInvoice';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const getFunctionErrorMessage = async (error: unknown) => {
  const context = (error as { context?: Response } | null)?.context;
  if (context) {
    try {
      const payload = await context.clone().json();
      if (payload?.message || payload?.error) {
        return String(payload.message || payload.error);
      }
    } catch {
      // Ignore malformed responses and fall back below.
    }
  }

  const message = (error as { message?: string } | null)?.message;
  if (!message || message.includes('non-2xx')) {
    return "Impossible d'envoyer le lien de vérification pour le moment. Réessayez dans quelques minutes.";
  }
  return message;
};

function CurrentOrders() {
  const { orders, loading, respondToOrder } = useUserOrders();

  const activeOrders = orders
    .filter((order) => {
      if (order.status === 'cancelled') return false;

      // Delivery orders must stay visible in the customer profile for tracking,
      // including when the restaurant marks them as delivered.
      if (order.order_type === 'livraison') return true;

      return order.status !== 'delivered';
    })
    // Suivi de commandes : uniquement les 5 dernières commandes.
    .slice(0, 5);

  // Prix unitaires calculés par le backend (source unique de vérité).
  const linePrices = useOrdersLinePrices(
    activeOrders.map((o) => ({ id: o.id, items: o.items as any[], created_at: o.created_at })),
  );


  // Demandes de facture déjà envoyées par le client.
  const [invoiceRequested, setInvoiceRequested] = useState<Set<string>>(new Set());
  const [invoiceSendingId, setInvoiceSendingId] = useState<string | null>(null);
  const { data: companyData } = useCompanyInfo();


  useEffect(() => {
    let cancelled = false;
    (async () => {
      // On se base sur les factures réellement générées et envoyées,
      // pas sur la simple demande : une tentative échouée reste réessayable.
      const { data } = await supabase.from('invoices').select('order_id');
      if (!cancelled && data) {
        setInvoiceRequested(
          new Set(
            data
              .map((r: { order_id: string | null }) => r.order_id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestInvoice = async (order: (typeof activeOrders)[number]) => {
    setInvoiceSendingId(order.id);
    try {
      // 1) Prévient l'équipe (admin de site 18h-22h, sinon super admins secondaires)
      const { error } = await supabase.rpc('request_invoice', { _order_id: order.id });
      if (error) throw error;

      // 2) Génère la facture PDF, l'envoie par e-mail et l'archive côté admin
      const { email, isInvoice } = await generateAndSendInvoice(order as any, companyData);
      setInvoiceRequested((prev) => new Set(prev).add(order.id));
      toast.success(
        isInvoice
          ? `Facture envoyée à ${email}`
          : `Récapitulatif envoyé à ${email} — la facture définitive suivra une fois la commande confirmée`,
      );
    } catch (e: any) {
      console.error('Invoice request error:', e);
      toast.error(e?.message || "Impossible de générer la facture");
    } finally {
      setInvoiceSendingId(null);
    }
  };



  return (
    <div className="glass-card p-4 rounded-xl">
      <h3 className="font-semibold flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-primary" />
        Mes commandes en cours
      </h3>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : activeOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucune commande en cours
        </p>
      ) : (
        <div className="space-y-3">
          {activeOrders.map((order) => {
            const awaitingResponse =
              order.order_type === 'livraison' &&
              !!order.delivery_estimate &&
              !order.delivery_response;

            return (
              <div key={order.id} className="p-3 rounded-lg border border-border">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">#{order.id.slice(0, 8)}</span>
                  <span className={`text-xs text-white px-2 py-0.5 rounded-full ${statusColors[order.status]}`}>
                    {statusLabels[order.status]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
                  <span>{order.order_type === 'livraison' ? '🚗 Livraison' : '🏪 À emporter'}</span>
                  <span className="font-semibold text-primary">{order.total_price.toFixed(2)}€</span>
                </div>

                {/* Détail des pizzas commandées */}
                {order.items && order.items.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                    {order.items.map((item, idx) => {
                      const orderDate = new Date(order.created_at);
                      const { unitPrice } = linePriceAt(linePrices[order.id], idx, item, orderDate);
                      return (
                      <li key={idx} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {item.quantity}× {item.pizza?.name}
                          </span>
                          {item.size?.name && (
                            <span className="text-muted-foreground">{item.size.name}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-muted-foreground">
                          <span>{item.quantity} × {unitPrice.toFixed(2)}€</span>
                          <span className="font-medium text-foreground">{(unitPrice * item.quantity).toFixed(2)}€</span>
                        </div>
                        <div className="text-muted-foreground">
                          {item.pizza?.hasBase !== false &&
                            item.pizza?.category !== 'boissons' &&
                            item.base && <span>Base {item.base === 'creme' ? 'crème' : 'tomate'}</span>}
                          {item.supplements && item.supplements.length > 0 && (
                            <span> • + {item.supplements.map((s) => s.name).join(', ')}</span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-muted-foreground italic">📝 {item.notes}</p>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}

                <OrderTimeline order={order} />

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3"
                  disabled={invoiceRequested.has(order.id) || invoiceSendingId === order.id}
                  onClick={() => requestInvoice(order)}
                >
                  {invoiceSendingId === order.id ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-1" />
                  )}
                  {invoiceRequested.has(order.id) ? 'Facture envoyée' : 'Demander une facture'}

                </Button>

                {order.order_type === 'livraison' && order.pickup_time && !order.delivery_estimate && (
                  <p className="mt-2 text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    Livraison souhaitée à <strong>{order.pickup_time}</strong>
                  </p>
                )}

                {order.order_type === 'livraison' && order.delivery_estimate && (
                  <div className="mt-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                    <p className="text-sm flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      Nouvel horaire proposé par le restaurant : <strong>{order.delivery_estimate}</strong>
                    </p>

                    {awaitingResponse && (
                      <>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cet horaire vous convient-il ?
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => respondToOrder(order.id, 'accepted')}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accepter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive"
                            onClick={() => respondToOrder(order.id, 'refused')}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Refuser
                          </Button>
                        </div>
                      </>
                    )}

                    {order.delivery_response === 'accepted' && (
                      <p className="text-xs text-green-600 mt-1">✅ Vous avez accepté cet horaire</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendMessage, markMessagesRead, site } = useCustomerChat();
  const {
    isChatBlocked,
    isMonday,
    type: closureType,
    phone: closurePhone,
    title: closureTitle,
    message: closureMsg,
  } = useChatClosure(site);
  const { isOnline } = useAdminPresenceWatch();

  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const forceScrollRef = useRef(false);

  const getViewport = useCallback(
    () =>
      scrollRef.current?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]') ?? null,
    []
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const run = () => {
        const viewport = getViewport();
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior });
        }
      };
      requestAnimationFrame(() => {
        run();
        requestAnimationFrame(run);
      });
      setTimeout(run, 80);
      isAtBottomRef.current = true;
      setIsAtBottom(true);
    },
    [getViewport]
  );

  // Track scroll position so the "back to bottom" button appears when the user
  // scrolls up to read older messages.
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const handleScroll = () => {
      const distanceToBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const atBottom = distanceToBottom < 80;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    };
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [getViewport, loading]);

  // Pin to the bottom on initial load and whenever messages change
  useLayoutEffect(() => {
    if (loading) return;
    if (forceScrollRef.current || isAtBottomRef.current) {
      forceScrollRef.current = false;
      scrollToBottom();
    }
  }, [loading, messages.length, scrollToBottom]);

  // Keep pinned to bottom when the content reflows (fonts, images, wrapping)
  useEffect(() => {
    if (loading) return;
    const viewport = getViewport();
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'auto' });
      }
    });
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [getViewport, loading]);

  // Mark restaurant messages as read only when the customer is actually at the
  // bottom of the conversation and the tab is visible.
  useEffect(() => {
    if (loading || !isAtBottom) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (messages.some((m) => m.sender_type === 'admin' && !m.read_at)) {
      markMessagesRead();
    }
  }, [loading, isAtBottom, messages, markMessagesRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isAtBottomRef.current) {
        if (messages.some((m) => m.sender_type === 'admin' && !m.read_at)) {
          markMessagesRead();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [messages, markMessagesRead]);

  const handleSend = async () => {
    if (!input.trim() || isChatBlocked) return;
    const msg = input.trim();
    setInput('');
    forceScrollRef.current = true;
    scrollToBottom('smooth');
    await sendMessage(msg);
  };

  const siteName = site
    ? `Déclic Pizza ${site.charAt(0).toUpperCase()}${site.slice(1)}`
    : 'votre restaurant';

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    if (isSameDay(date, today)) return 'Aujourd\'hui';
    if (isSameDay(date, yesterday)) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  const formatReadTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === today.toDateString()) return time;
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `hier ${time}`;
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`;
  };

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

      <div className="relative mb-3">
        <ScrollArea className="h-64 rounded-lg border border-border p-3" ref={scrollRef}>
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
              {messages.map((msg, index) => {
                const isCustomer = msg.sender_type === 'customer';
                const showDate =
                  index === 0 ||
                  formatMessageDate(msg.created_at) !==
                    formatMessageDate(messages[index - 1].created_at);

                return (
                  <div key={msg.id} className="space-y-1">
                    {showDate && (
                      <div className="flex justify-center">
                        <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                          {formatMessageDate(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isCustomer
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-[10px] mt-1 flex items-center gap-1 flex-wrap ${isCustomer ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isCustomer && (
                            msg.read_at ? (
                              <span className="font-medium">· Lu à {formatReadTime(msg.read_at)}</span>
                            ) : msg.delivered_at ? (
                              <span className="font-medium">· Reçu</span>
                            ) : (
                              <span className="font-medium">· Envoyé</span>
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {!isAtBottom && messages.length > 0 && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-2 text-xs font-medium hover:scale-105 transition-transform animate-in fade-in slide-in-from-bottom-2"
          >
            Revenir au dernier message
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isChatBlocked ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-destructive text-sm">{closureTitle}</p>
            <p className="text-sm text-foreground">{closureMsg}</p>
            {closureType === 'orders' && closurePhone && (
              isMonday ? (
                <Button type="button" size="sm" variant="outline" disabled aria-label="Fermé le lundi">
                  <Phone className="h-4 w-4 mr-2" />
                  Fermé le lundi
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${closurePhone.replace(/\s/g, '')}`}>
                    <Phone className="h-4 w-4 mr-2" />
                    Appeler {siteName}
                  </a>
                </Button>
              )
            )}
          </div>
        </div>
      ) : (
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
      )}

    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, addresses, signOut, updateProfile, addAddress, deleteAddress, setDefaultAddress, loading } = useAuth();
  const { selectedRestaurant } = useCart();
  const loyaltySite = selectedRestaurant?.id ?? profile?.preferred_restaurant ?? null;
  const { entries: loyaltyEntries, hasActiveProgram } = useLoyaltyCard(loyaltySite);
  const loyaltySummary = loyaltyEntries[0];
  
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || '',
    email: profile?.email || user?.email || '',
    preferred_restaurant: profile?.preferred_restaurant || ''
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
        phone: profile.phone || '',
        email: profile.email || user?.email || '',
        preferred_restaurant: profile.preferred_restaurant || ''
      });
    }
  }, [profile, user]);

  // Handle redirect back from the "Accepter/Refuser" email links.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resp = params.get('deliveryResponse');
    if (!resp) return;
    switch (resp) {
      case 'accepted':
        toast.success('Horaire de livraison accepté. Merci !');
        break;
      case 'refused':
        toast.info('Horaire refusé. Votre commande a été annulée.');
        break;
      case 'already':
        toast.info('Cette réponse a déjà été enregistrée.');
        break;
      case 'invalid':
        toast.error('Lien invalide ou expiré.');
        break;
      case 'error':
        toast.error("Impossible d'enregistrer votre réponse. Réessayez depuis l'app.");
        break;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('deliveryResponse');
    url.searchParams.delete('order');
    window.history.replaceState({}, '', url.toString());
  }, []);


  const handleUpdateProfile = async () => {
    setSavingProfile(true);
    const { error } = await updateProfile(profileForm);
    setSavingProfile(false);
    
    if (error) {
      toast.error(error.message || 'Erreur lors de la mise à jour du profil');
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER') {
      toast.error('Merci de taper SUPPRIMER pour confirmer');
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      toast.success('Votre compte a été supprimé. Un email de confirmation vous a été envoyé.');
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la suppression du compte');
      setDeletingAccount(false);
    }
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

  const displayedEmail = (profile?.email || user?.email || '').trim();
  const displayedEmailVerified =
    !!displayedEmail &&
    !!user.email_confirmed_at &&
    displayedEmail.toLowerCase() === (user.email || '').trim().toLowerCase();

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
          <h1 className="font-display text-2xl text-white flex-1">Mon Profil</h1>
          <div className="text-white">
            <CustomerNotificationBell />
          </div>
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
              <p className="text-muted-foreground text-sm">{displayedEmail || user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Raccourci carte de fidélité — visible uniquement si un programme actif existe pour le site choisi */}
        {hasActiveProgram && loyaltySummary && (() => {
          const pct = Math.min(100, Math.round((loyaltySummary.currentCount / loyaltySummary.program.required_count) * 100));
          const remaining = Math.max(0, loyaltySummary.program.required_count - loyaltySummary.currentCount);
          const siteLabel = loyaltySite ? SITE_LABELS[loyaltySite] ?? null : null;
          return (
          <button
            type="button"
            onClick={() => navigate('/loyalty')}
            className="w-full glass-card p-4 rounded-xl flex items-center gap-3 text-left hover:shadow-lg transition-shadow group"
          >
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">Carte de fidélité</p>
                {siteLabel && (
                  <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {siteLabel}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {remaining > 0
                  ? <>Plus que <span className="font-semibold text-foreground">{remaining}</span> pizza{remaining > 1 ? 's' : ''} · récompense : {rewardLabel(loyaltySummary.program)}</>
                  : <>Récompense disponible ! 🎉</>}
                {loyaltySummary.pendingRewards > 0 && (
                  <span className="text-green-600 font-medium"> · {loyaltySummary.pendingRewards} en attente</span>
                )}
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>
          );
        })()}

        {/* Notification permission reminder */}
        <NotificationPermissionReminder />

        {/* Push notification test */}
        <PushTestPanel />

        {/* Current Orders Section */}
        <CurrentOrders />

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
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="mt-1"
                  placeholder="votre@email.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nécessaire pour réinitialiser votre mot de passe
                </p>
              </div>
              <div>
                <Label>Site de commande</Label>
                <select
                  value={profileForm.preferred_restaurant}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, preferred_restaurant: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">— Choisir un site —</option>
                  <option value="conches">Déclic Pizza Conches</option>
                  <option value="beaumont">Déclic Pizza Beaumont</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Votre pizzeria par défaut pour commander et discuter
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.first_name || '-'} {profile?.last_name || '-'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{displayedEmail || 'Non renseigné'}</span>
                {displayedEmail && (
                  displayedEmailVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      <Check className="w-3 h-3" /> Email vérifié
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <X className="w-3 h-3" /> Non vérifié
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={async () => {
                          const target = displayedEmail;
                          if (!target) {
                            toast.error("Renseignez d'abord une adresse email dans votre profil.");
                            return;
                          }
                          // Call the edge function which handles the case where
                          // the email was previously used by another (orphan)
                          // account and needs to be freed before re-attaching.
                          const { data, error } = await supabase.functions.invoke(
                            'resend-email-verification',
                            {
                              body: {
                                email: target,
                                redirectTo: `${window.location.origin}/auth/confirm`,
                              },
                            }
                          );
                          const response = data as {
                            ok?: boolean;
                            status?: string;
                            message?: string;
                            error?: string;
                          } | null;
                          const functionMessage = error ? await getFunctionErrorMessage(error) : null;
                          const errMsg =
                            response?.error ||
                            (response?.ok === false ? response.message : undefined) ||
                            functionMessage;
                          if (errMsg) {
                            toast.error(errMsg);
                          } else if (response?.status === 'already_verified') {
                            toast.success(response.message || 'Votre adresse email est déjà vérifiée.');
                          } else {
                            toast.success(response?.message || 'Email de vérification envoyé. Vérifiez votre boîte de réception.');
                          }
                        }}

                      >
                        Renvoyer le lien
                      </Button>
                    </>
                  )
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{profile?.phone || '-'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>
                  {profile?.preferred_restaurant === 'conches'
                    ? 'Déclic Pizza Conches'
                    : profile?.preferred_restaurant === 'beaumont'
                    ? 'Déclic Pizza Beaumont'
                    : 'Aucun site sélectionné'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Communication preferences */}
        <CommunicationPreferences />

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

        {/* Chat Section */}
        {(selectedRestaurant || profile?.preferred_restaurant) ? (
          <ProfileChat />
        ) : (
          <div className="glass-card p-4 rounded-xl">
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Chat avec votre restaurant
            </h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez d'abord votre restaurant préféré pour discuter avec l'équipe.
            </p>
          </div>
        )}


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

        {/* Delete Account Button */}
        <Button
          variant="outline"
          className="w-full mt-3 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => { setDeleteConfirmText(''); setDeleteConfirmOpen(true); }}
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Supprimer mon compte
        </Button>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>définitive</strong>. Votre profil, vos adresses et vos données personnelles seront supprimés.
              Un email de confirmation sera envoyé à l'adresse enregistrée sur votre compte.
              <br /><br />
              Pour confirmer, tapez <strong>SUPPRIMER</strong> ci-dessous.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
              disabled={deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <BottomNavigation />
    </div>
  );
}
