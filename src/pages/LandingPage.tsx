import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, MapPin, Clock, Store, ExternalLink, AlertTriangle, Pizza } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RestaurantSelector } from '@/components/RestaurantSelector';
import { UserBadge } from '@/components/UserBadge';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { closureMessage, closureTitle } from '@/lib/closureMessages';

import { Restaurant } from '@/types/pizza';
import { preloadHeroMedia, heroPosterUrl } from '@/lib/heroPreload';
import wordmarkAsset from '@/assets/declic-wordmark.png.asset.json';

const heroPoster = heroPosterUrl;





// La badge "Livreur" n'est visible que pendant la plage de livraison : 18h - 23h30 (heure de Paris).
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
  const [heroLoaded, setHeroLoaded] = useState(false);

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
  const { closures } = useActiveClosures();

  const siteLabel = (site: string) => {
    if (site === 'all') return 'Tous les sites';
    return site.charAt(0).toUpperCase() + site.slice(1);
  };

  const isSiteAdmin =
    isSiteAdminConches ||
    isSiteAdminBeaumont ||
    isSecondaryAdminConches ||
    isSecondaryAdminBeaumont;

  const [livreurOpen, setLivreurOpen] = useState(isLivreurWindowOpen());
  const [pizzeriaOpen, setPizzeriaOpen] = useState(isPizzeriaOpen());

  // Actualisation automatique (toutes les minutes) pour faire apparaître/disparaître
  // les badges "Livreur" et "Admin site" en fonction de l'heure, sans rechargement de la page.
  useEffect(() => {
    setLivreurOpen(isLivreurWindowOpen());
    setPizzeriaOpen(isPizzeriaOpen());
    const interval = setInterval(() => {
      setLivreurOpen(isLivreurWindowOpen());
      setPizzeriaOpen(isPizzeriaOpen());
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isAnyLivreur, isSiteAdmin]);

  // L'animation est préchargée dès le démarrage de l'application (voir main.tsx) :
  // ici on se contente d'attendre la promesse partagée, déjà résolue la plupart
  // du temps, puis on affiche l'animation une fois entièrement décodée.
  const [animSrc, setAnimSrc] = useState<string | null>(null);
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadHeroMedia().then((src) => {
      if (cancelled || !src) return;
      setAnimSrc(src);
      setAnimReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);





  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setRestaurant(restaurant);
    navigate('/menu');
  };

  const handleViewMenuOnly = (restaurant: Restaurant) => {
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
        {isSiteAdmin && pizzeriaOpen && (
          <UserBadge variant="admin" label="Admin site" />
        )}
        {isAnyLivreur && livreurOpen && (
          <UserBadge variant="livreur" label="Livreur" />
        )}
        <UserBadge
          variant="account"
          label={user ? (profile?.first_name || 'Profil') : 'Connexion'}
          onClick={() => navigate(user ? '/profile' : '/auth')}
        />
      </div>

      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-40 right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        {!showRestaurantSelector && closures.length > 0 && (
          <div className="w-full max-w-md mb-8 space-y-3">
            {closures.map((closure) => {
              const type = closure.closure_type === 'site' ? 'site' : 'orders';
              return (
                <div
                  key={closure.id}
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive text-sm">
                      {closureTitle(type)}
                      {closure.site !== 'all' ? ` — ${siteLabel(closure.site)}` : ''}
                    </p>
                    <p className="text-sm text-foreground mt-1">
                      {closureMessage(type, closure.reason)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!showRestaurantSelector ? (
          <>
            {/* Logo/Hero Animation */}
            <div className="relative w-full flex justify-center mb-6 sm:mb-8 animate-float">
              {/* Espace réservé : évite tout décalage de mise en page pendant le chargement */}
              <div className="relative w-[min(88vw,22rem)] sm:w-[min(70vw,26rem)] lg:w-[min(45vw,30rem)] h-[38vh] sm:h-[42vh] flex items-center justify-center">
                {!heroLoaded && (
                  <div className="absolute inset-6 rounded-full bg-foreground/5 animate-pulse" aria-hidden="true" />
                )}
                <img
                  src={heroPoster}
                  alt="Déclic Pizza - pizzas artisanales livrées"
                  width={640}
                  height={443}
                  decoding="async"
                  loading="eager"
                  fetchPriority="high"
                  draggable={false}
                  onLoad={() => setHeroLoaded(true)}
                  onError={() => setHeroLoaded(true)}
                  className={`block w-full h-full object-contain bg-transparent select-none pointer-events-none [backface-visibility:hidden] [contain:paint] transition-opacity duration-500 ${heroLoaded && !animReady ? 'opacity-100' : ''} ${!heroLoaded ? 'opacity-0' : ''} ${animReady ? 'opacity-0' : ''}`}
                />
                {animSrc && (
                  <img
                    src={animSrc}
                    alt=""
                    aria-hidden="true"
                    width={560}
                    height={388}
                    decoding="async"
                    draggable={false}
                    className={`absolute inset-0 block w-full h-full object-contain bg-transparent select-none pointer-events-none [backface-visibility:hidden] [contain:paint] transition-opacity duration-300 ${animReady ? 'opacity-100' : 'opacity-0'}`}
                  />
                )}
              </div>


            </div>



            {/* Welcome Text */}
            <div className="text-center mb-10 space-y-3">
              <h1 className="flex justify-center">
                <img
                  src={wordmarkAsset.url}
                  alt="Déclic Pizza"
                  width={1399}
                  height={233}
                  decoding="async"
                  draggable={false}
                  className="w-[min(68vw,16rem)] sm:w-[min(52vw,21rem)] h-auto select-none pointer-events-none"
                />
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
            <div className="w-full max-w-[17rem] space-y-4 flex flex-col items-center">
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={() => setShowRestaurantSelector(true)}
              >
                Commander maintenant
                <ChevronRight className="w-6 h-6" />
              </Button>

              <Button
                variant="glass"
                size="default"
                className="w-[70%] bg-[#32B86C] text-black border-transparent hover:bg-[#2aa85f] hover:border-transparent hover:shadow-glow"
                onClick={handleDiscoverMenu}
              >
                Découvrir le menu
              </Button>
            </div>

            {/* Opening Hours Note */}
            <p className="text-sm text-muted-foreground mt-8 text-center inline-flex items-center justify-center gap-1.5">
              <Pizza className="w-4 h-4 text-[#32B86C]" />
              Ouvert du mardi au dimanche
            </p>
          </>
        ) : (
          <div className="w-full fade-up">
            <button
              onClick={() => setShowRestaurantSelector(false)}
              className="mt-8 mb-6 inline-flex items-center gap-2 rounded-xl bg-card/80 border border-border/50 px-4 py-0 text-sm font-semibold text-foreground shadow-card hover:bg-card hover:text-primary transition-colors"
            >
              ← Retour
            </button>
            <RestaurantSelector onSelect={handleRestaurantSelect} onViewMenu={handleViewMenuOnly} />
            
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
                    Distributeur Déclic Pizza - Conches
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
      <footer className="relative z-10 text-center py-6 px-4 space-y-3">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
          <Link
            to="/mentions-legales"
            className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            Mentions légales
          </Link>
          <span className="text-muted-foreground/40" aria-hidden="true">•</span>
          <Link
            to="/cgv"
            className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            CGV
          </Link>
          <span className="text-muted-foreground/40" aria-hidden="true">•</span>
          <Link
            to="/confidentialite"
            className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            Politique de confidentialité
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © 2026 Déclic Pizza • Conches & Beaumont
        </p>
      </footer>
    </div>
  );
}
