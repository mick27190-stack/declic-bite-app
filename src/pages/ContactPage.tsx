import { ChevronLeft, Phone, MapPin, Clock, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BottomNavigation } from '@/components/BottomNavigation';
import { restaurants } from '@/data/pizzas';
import CustomerChat from '@/components/CustomerChat';

export default function ContactPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Contact 📞
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* About */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-display font-bold text-foreground mb-3">
            À propos de Déclic Pizza
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Depuis plus de 10 ans, Déclic Pizza vous propose des pizzas artisanales 
            préparées avec des ingrédients frais et de qualité. Notre pâte est 
            faite maison chaque jour, et nos pizzas sont cuites au feu de bois 
            pour un goût authentique.
          </p>
        </div>

        {/* Restaurants */}
        {restaurants.map((restaurant) => (
          <div key={restaurant.id} className="glass-card p-6 space-y-4">
            <h3 className="text-lg font-display font-bold text-primary">
              {restaurant.name}
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-foreground">{restaurant.address}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                <a 
                  href={`tel:${restaurant.phone.replace(/\./g, '')}`}
                  className="text-foreground hover:text-primary transition-colors"
                >
                  {restaurant.phone}
                </a>
              </div>
              
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-foreground">{restaurant.hours}</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => window.open(`tel:${restaurant.phone.replace(/\./g, '')}`, '_self')}
            >
              <Phone className="w-4 h-4" />
              Appeler
            </Button>
          </div>
        ))}

        {/* Delivery Info */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-display font-bold text-foreground mb-3">
            🚗 Livraison
          </h2>
          <p className="text-muted-foreground">
            Nous livrons dans un rayon de <strong className="text-primary">12 km</strong> autour 
            de nos restaurants. La livraison est gratuite à partir de 20€ de commande.
          </p>
        </div>

        {/* Hours */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-display font-bold text-foreground mb-3">
            🕐 Horaires d'ouverture
          </h2>
          <div className="space-y-2 text-foreground">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mardi - Dimanche</span>
              <span className="font-semibold">18h00 - 22h00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lundi</span>
              <span className="text-destructive">Fermé</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-primary font-medium">
            🎉 Mardi et Mercredi : toutes nos pizzas Senior à 10€ !
          </p>
        </div>
      </main>

      {/* Customer Chat */}
      <CustomerChat />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
