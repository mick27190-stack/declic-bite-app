import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartView } from '@/components/CartView';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Retour"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Votre Panier 🛒
            </h1>
          </div>
        </div>
      </header>

      {/* Cart Content */}
      <main className="max-w-md mx-auto px-4 py-6">
        <CartView />
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
