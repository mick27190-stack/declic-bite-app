import { useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';
import NotificationBell from '@/components/admin/NotificationBell';

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
      title: 'Chat Clients',
      description: 'Communiquer avec les clients',
      icon: MessageSquare,
      href: '/admin/chat',
      show: canManageChat
    },
    {
      title: 'SMS Promotionnels',
      description: 'Envoyer des offres par SMS',
      icon: Send,
      href: '/admin/sms',
      show: canSendSMS
    },
    {
      title: 'Gestion Admins',
      description: 'Gérer les administrateurs',
      icon: Users,
      href: '/admin/users',
      show: canManageSecondaryAdmins || isSuperAdmin
    },
    {
      title: 'Paramètres',
      description: 'Configuration générale',
      icon: Settings,
      href: '/admin/settings',
      show: isSuperAdmin
    }
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.filter(card => card.show).map((card) => (
            <Card 
              key={card.href} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(card.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <card.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
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
