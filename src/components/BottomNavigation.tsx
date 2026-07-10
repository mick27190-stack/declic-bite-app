import { Home, Pizza, ShoppingCart, User, Shield, Bike } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAdmin } from '@/contexts/AdminContext';

// Le livreur n'a accès à son espace que pendant la plage de livraison : 18h - 23h30 (heure de Paris).
function isLivreurWindowOpen(): boolean {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase() ?? '';
  const isMonday = weekday.startsWith('lun');
  const minutes = hour * 60 + minute;
  // Fermé le lundi : pas de créneau livreur quand la pizzeria est fermée.
  return !isMonday && minutes >= 18 * 60 && minutes <= 23 * 60 + 30;
}

export function BottomNavigation() {
  const location = useLocation();
  const { totalItems } = useCart();
  const { isAnyAdmin, isAnyLivreur } = useAdmin();

  const [livreurOpen, setLivreurOpen] = useState(isLivreurWindowOpen());

  useEffect(() => {
    if (!isAnyLivreur) return;
    const interval = setInterval(() => setLivreurOpen(isLivreurWindowOpen()), 60 * 1000);
    return () => clearInterval(interval);
  }, [isAnyLivreur]);

  const navItems = [
    { icon: Home, label: 'Accueil', path: '/' },
    { icon: Pizza, label: 'Menu', path: '/menu' },
    { icon: ShoppingCart, label: 'Panier', path: '/cart' },
    ...(isAnyAdmin ? [{ icon: Shield, label: 'Admin', path: '/admin' }] : []),
    ...(isAnyLivreur && livreurOpen ? [{ icon: Bike, label: 'Livreur', path: '/livreur' }] : []),
    { icon: User, label: 'Profil', path: '/profile' },
  ];

  return (
    <nav
      className="fixed left-0 right-0 top-auto z-40 bg-card/90 backdrop-blur-xl border-t border-border/50 bottom-[env(safe-area-inset-bottom)]"
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const isCart = item.path === '/cart';

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center w-16 h-full transition-all duration-300 ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                
                {/* Cart badge */}
                {isCart && totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center animate-bounce-soft">
                    {totalItems}
                  </span>
                )}
              </div>
              
              <span className={`text-xs mt-1 font-medium transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}>
                {item.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 w-12 h-0.5 bg-gradient-to-r from-primary to-secondary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
