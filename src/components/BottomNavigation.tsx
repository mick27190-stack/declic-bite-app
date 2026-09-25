import { Home, Pizza, ShoppingCart, User, Shield, Bike, Gift } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useLoyaltyCard } from '@/hooks/useLoyalty';
import { useSiteActivityBadges } from '@/hooks/useOpeningHours';

export function BottomNavigation() {
  const location = useLocation();
  const { totalItems, selectedRestaurant } = useCart();
  const { hasActiveProgram } = useLoyaltyCard(selectedRestaurant?.id ?? null);
  const { isAnyAdmin, isAnyLivreur, livreurSite } = useAdmin();

  // Badge « Livreur » aligné sur les horaires d'ouverture configurés du site.
  const { livreurOpen } = useSiteActivityBadges([], livreurSite);

  const navItems = [
    { icon: Home, label: 'Accueil', path: '/' },
    { icon: Pizza, label: 'Menu', path: '/menu' },
    { icon: ShoppingCart, label: 'Panier', path: '/cart' },
    ...(hasActiveProgram ? [{ icon: Gift, label: 'Fidélité', path: '/loyalty' }] : []),
    ...(isAnyAdmin ? [{ icon: Shield, label: 'Admin', path: '/admin' }] : []),
    ...(isAnyLivreur && livreurOpen ? [{ icon: Bike, label: 'Livreur', path: '/livreur' }] : []),
    { icon: User, label: 'Profil', path: '/profile' },
  ];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 top-auto z-40 bg-card/90 backdrop-blur-xl border-t border-border/50"
      style={{ transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-1 sm:px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          const isCart = item.path === '/cart';

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-w-0 flex-1 max-w-16 flex-col items-center justify-center h-full transition-all duration-300 ${
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
              
              <span className={`max-w-full truncate text-[10px] sm:text-xs mt-1 font-medium transition-all duration-300 ${
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
