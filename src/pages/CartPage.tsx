import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartView } from '@/components/CartView';
import { BottomNavigation } from '@/components/BottomNavigation';

export default function CartPage() {
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
