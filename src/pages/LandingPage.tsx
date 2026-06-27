import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Clock, User, ExternalLink, Store, Bike, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RestaurantSelector } from '@/components/RestaurantSelector';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Restaurant } from '@/types/pizza';
import heroImage from '@/assets/declic-hero.jpeg';

// La badge "Livreur" n'est visible que pendant la plage de livraison : 18h - 23h30 (heure de Paris).
function isLivreurWindowOpen(): boolean {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const minutes = hour * 60 + minute;
  return minutes >= 18 * 60 && minutes <= 23 * 60 + 30;
}

// Le badge "Admin site" n'est visible que pendant les horaires d'ouverture :
// 18h - 22h (heure de Paris), fermé le lundi.
function isPizzeriaOpen(): boolean {
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
  return !isMonday && minutes >= 18 * 60 && minutes < 22 * 60;
}

export default function LandingPage() {
  const [showRestaurantSelector, setShowRestaurantSelector] = useState(false);
  const { setRestaurant, selectedRestaurant } = useCart();
  const { user, profile } = useAuth();
  const {
    isAnyLivreur,
    isSiteAdminConches,
    isSiteAdminBeaumont,
    isSecondaryAdminConches,
    isSecondaryAdminBeaumont,
  } = useAdmin();
  const navigate = useNavigate();

  const isSiteAdmin =
    isSiteAdminConches ||
    isSiteAdminBeaumont ||
    isSecondaryAdminConches ||
    isSecondaryAdminBeaumont;

  const [livreurOpen, setLivreurOpen] = useState(isLivreurWindowOpen());

  // Actualisation automatique (toutes les minutes) pour faire apparaître/disparaître
  // le badge "Livreur" en fonction de l'heure, sans rechargement de la page.
  useEffect(() => {
    setLivreurOpen(isLivreurWindowOpen());
    const interval = setInterval(() => setLivreurOpen(isLivreurWindowOpen()), 60 * 1000);
    return () => clearInterval(interval);
  }, [isAnyLivreur, isSiteAdmin]);

  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setRestaurant(restaurant);
    navigate('/menu');
  };

  const handleDiscoverMenu = () => {
    if (selectedRestaurant) {
      navigate('/menu');
    } else {
      setShowRestaurantSelector(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Hero Gradient Background */}
      <div className="hero-gradient absolute inset-0 pointer-events-none" />
      
      {/* Auth Button */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {isSiteAdmin && (
          <Badge className="bg-primary hover:bg-primary text-primary-foreground flex items-center gap-1 px-3 py-1.5 shadow-lg">
            <Shield className="w-4 h-4" />
            Admin site
          </Badge>
        )}
        {isAnyLivreur && livreurOpen && (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white flex items-center gap-1 px-3 py-1.5 shadow-lg">
            <Bike className="w-4 h-4" />
            Livreur
          </Badge>
        )}
        <Button
          variant="glass"
          size="sm"
          onClick={() => navigate(user ? '/profile' : '/auth')}
          className="flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          {user ? (profile?.first_name || 'Profil') : 'Connexion'}
        </Button>
      </div>

      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-40 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {!showRestaurantSelector ? (
          <>
            {/* Logo/Hero Image */}
            <div className="relative w-full max-w-sm mb-8 animate-float">
              <img
                src={heroImage}
                alt="Déclic Pizza"
                className="w-full h-auto rounded-3xl shadow-2xl shadow-primary/20"
              />
            </div>

            {/* Welcome Text */}
            <div className="text-center mb-10 space-y-3">
              <h1 className="text-4xl sm:text-5xl font-display font-bold gradient-text">
                Déclic Pizza
              </h1>
              <p className="text-lg text-muted-foreground max-w-xs mx-auto">
                Des pizzas artisanales, fraîches et savoureuses, livrées chez vous !
              </p>
            </div>

            {/* Info Badges */}
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <div className="glass-button px-4 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">18h - 22h</span>
              </div>
              <div className="glass-button px-4 py-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">Livraison 12km</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="w-full max-w-xs space-y-4">
              <Button
                variant="hero"
                size="xl"
                className="w-full"
                onClick={() => setShowRestaurantSelector(true)}
              >
                Commander maintenant
                <ChevronRight className="w-6 h-6" />
              </Button>
              
              <Button
                variant="glass"
                size="lg"
                className="w-full"
                onClick={handleDiscoverMenu}
              >
                Découvrir le menu
              </Button>
            </div>

            {/* Opening Hours Note */}
            <p className="text-sm text-muted-foreground mt-8 text-center">
              🍕 Ouvert du mardi au dimanche
            </p>
          </>
        ) : (
          <div className="w-full fade-up">
            <button
              onClick={() => setShowRestaurantSelector(false)}
              className="mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              ← Retour
            </button>
            <RestaurantSelector onSelect={handleRestaurantSelect} />
            
            <div className="mt-8 w-full max-w-md mx-auto">
              <a
                href="https://application.smart-machine.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full glass-card p-5 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 border border-border/50 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-glow group-hover:scale-110 transition-transform duration-300">
                  <Store className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-display font-bold text-primary">
                    Distributeur Déclic Pizza
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Disponible 24h/24 • Commandez en ligne
                  </p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 px-4">
        <p className="text-xs text-muted-foreground">
          © 2024 Déclic Pizza • Conches & Beaumont
        </p>
      </footer>
    </div>
  );
}
