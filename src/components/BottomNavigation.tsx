import { Home, Pizza, ShoppingCart, User, MessageCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';

const navItems = [
  { icon: Home, label: 'Accueil', path: '/' },
  { icon: Pizza, label: 'Menu', path: '/menu' },
  { icon: ShoppingCart, label: 'Panier', path: '/cart' },
  { icon: MessageCircle, label: 'Contact', path: '/contact' },
];

export function BottomNavigation() {
  const location = useLocation();
  const { totalItems } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border/50 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
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
