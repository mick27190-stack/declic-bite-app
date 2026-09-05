import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Pizza, 
  MessageSquare, 
  Users, 
  Send, 
  ShoppingBag,
  Settings,
  ArrowLeft,
  TrendingUp,
  Contact,
  Tag,
  History,
  Building2,
  FileText,
  Gift,
  ShieldCheck,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Check,
  ArrowUpDown


} from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';

const ORDER_STORAGE_KEY = 'admin_dashboard_card_order';


export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { 
    isAnyAdmin, 
    isSuperAdmin,
    canManageMenu, 
    canManageOrders, 
    canManageChat, 
    canSendSMS,
    canManageSecondaryAdmins,
    loading: adminLoading 
  } = useAdmin();

  const [reorderMode, setReorderMode] = useState(false);
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [dragged, setDragged] = useState<string | null>(null);

  const persist = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAnyAdmin) {
        navigate('/');
      }
    }
  }, [user, isAnyAdmin, authLoading, adminLoading, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAnyAdmin) {
    return null;
  }

  const adminCards = [
    {
      title: 'Commandes',
      description: 'Gérer les commandes en cours',
      icon: ShoppingBag,
      href: '/admin/orders',
      show: canManageOrders
    },
    {
      title: 'Suivi des Ventes',
      description: 'Statistiques pizzas & chiffre d\'affaires',
      icon: TrendingUp,
      href: '/admin/sales',
      show: isSuperAdmin
    },
    {
      title: 'Historique des Commandes',
      description: 'Commandes archivées semaine par semaine',
      icon: History,
      href: '/admin/orders-history',
      show: canManageOrders
    },
    {
      title: 'Menu',
      description: 'Modifier les pizzas et le menu',
      icon: Pizza,
      href: '/admin/menu',
      show: canManageMenu
    },
    {
      title: 'Gestion des Tarifs',
      description: 'Prix des pizzas par taille & promotions',
      icon: Tag,
      href: '/admin/pricing',
      show: isSuperAdmin
    },
    {
      title: 'Chat Clients',
      description: 'Communiquer avec les clients',
      icon: MessageSquare,
      href: '/admin/chat',
      show: canManageChat
    },
    {
      title: 'Fichier Client',
      description: 'Consulter et ajouter des clients',
      icon: Contact,
      href: '/admin/customers',
      show: isAnyAdmin
    },
    {
      title: 'SMS Promotionnels',
      description: 'Envoyer des offres par SMS',
      icon: Send,
      href: '/admin/sms',
      show: isSuperAdmin
    },
    {
      title: 'Gestion Admins',
      description: 'Gérer les administrateurs',
      icon: Users,
      href: '/admin/users',
      show: isSuperAdmin
    },
    {
      title: 'Paramètres',
      description: 'Configuration générale',
      icon: Settings,
      href: '/admin/settings',
      show: isSuperAdmin
    },
    {
      title: "Informations de l'entreprise",
      description: 'Coordonnées affichées sur les tickets',
      icon: Building2,
      href: '/admin/company-info',
      show: isSuperAdmin
    },
    {
      title: 'Factures',
      description: 'Historique des factures envoyées',
      icon: FileText,
      href: '/admin/invoices',
      show: isSuperAdmin
    },
    {
      title: 'Consentements RGPD',
      description: 'Registre et export CSV des consentements',
      icon: ShieldCheck,
      href: '/admin/consents',
      show: isSuperAdmin
    },
    {
      title: 'Carte de fidélité',
      description: 'Programmes de fidélité et progression des clients',
      icon: Gift,
      href: '/admin/loyalty',
      show: isSuperAdmin
    }
  ];

  const visibleCards = adminCards.filter((card) => card.show);
  const sortedCards = [...visibleCards].sort((a, b) => {
    const ia = order.indexOf(a.href);
    const ib = order.indexOf(b.href);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const move = (href: string, direction: -1 | 1) => {
    const hrefs = sortedCards.map((c) => c.href);
    const from = hrefs.indexOf(href);
    const to = from + direction;
    if (to < 0 || to >= hrefs.length) return;
    hrefs.splice(to, 0, hrefs.splice(from, 1)[0]);
    persist(hrefs);
  };

  const dropOn = (targetHref: string) => {
    if (!dragged || dragged === targetHref) return;
    const hrefs = sortedCards.map((c) => c.href);
    const from = hrefs.indexOf(dragged);
    const to = hrefs.indexOf(targetHref);
    if (from === -1 || to === -1) return;
    hrefs.splice(to, 0, hrefs.splice(from, 1)[0]);
    persist(hrefs);
    setDragged(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-primary">Administration</h1>
              <p className="text-sm text-muted-foreground">Déclic Pizza</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-sm text-muted-foreground">
            {reorderMode
              ? 'Glissez les onglets ou utilisez les flèches pour changer l’ordre.'
              : ''}
          </p>
          <div className="flex items-center gap-2">
            {reorderMode && order.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => persist([])}>
                Réinitialiser
              </Button>
            )}
            <Button
              variant={reorderMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReorderMode((v) => !v)}
            >
              {reorderMode ? (
                <>
                  <Check className="h-4 w-4 mr-2" /> Terminé
                </>
              ) : (
                <>
                  <ArrowUpDown className="h-4 w-4 mr-2" /> Réorganiser
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCards.map((card, index) => (
            <Card
              key={card.href}
              draggable={reorderMode}
              onDragStart={() => setDragged(card.href)}
              onDragOver={(e) => reorderMode && e.preventDefault()}
              onDrop={() => dropOn(card.href)}
              onDragEnd={() => setDragged(null)}
              className={`transition-shadow ${
                reorderMode
                  ? `cursor-grab active:cursor-grabbing border-primary/40 ${dragged === card.href ? 'opacity-50' : ''}`
                  : 'cursor-pointer hover:shadow-lg'
              }`}
              onClick={() => !reorderMode && navigate(card.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  {reorderMode && (
                    <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="p-2 rounded-lg bg-primary/10">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  {reorderMode && (
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(card.href, -1);
                        }}
                        aria-label="Monter"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={index === sortedCards.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          move(card.href, 1);
                        }}
                        aria-label="Descendre"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

    </div>
  );
}
