import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pizza, PizzaSize, Supplement, CartItem } from '@/types/pizza';
import { pizzaSizes, supplements } from '@/data/pizzas';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveBasePrice, isPromoDay } from '@/lib/promo';

interface PizzaDetailModalProps {
  pizza: Pizza;
  onClose: () => void;
}

export function PizzaDetailModal({ pizza, onClose }: PizzaDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<PizzaSize>(pizzaSizes[0]);
  const [selectedBase, setSelectedBase] = useState<'tomate' | 'creme'>('tomate');
  const [selectedSupplements, setSelectedSupplements] = useState<Supplement[]>([]);
  const [quantity, setQuantity] = useState(1);
  
  const { addItem } = useCart();
  const { toast } = useToast();

  const toggleSupplement = (supplement: Supplement) => {
    setSelectedSupplements((prev) =>
      prev.find((s) => s.id === supplement.id)
        ? prev.filter((s) => s.id !== supplement.id)
        : [...prev, supplement]
    );
  };

  const calculateTotal = () => {
    const base = getEffectiveBasePrice(pizza.basePrice, selectedSize.id) + selectedSize.price;
    const supps = selectedSupplements.reduce((sum, s) => sum + s.price, 0);
    return (base + supps) * quantity;
  };

  const handleAddToCart = () => {
    const item: CartItem = {
      pizza,
      size: selectedSize,
      base: selectedBase,
      supplements: selectedSupplements,
      quantity,
    };
    addItem(item);
    toast({
      title: "Ajouté au panier ! 🍕",
      description: `${quantity}x ${pizza.name} (${selectedSize.name})`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        <div className="relative aspect-video">
          <img
            src={pizza.image}
            alt={pizza.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">{pizza.name}</h2>
            <p className="text-muted-foreground mt-1">{pizza.description}</p>
            <p className="text-sm text-primary mt-2">
              {pizza.ingredients.join(' • ')}
            </p>
          </div>

          {/* Base Selection */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Base</h3>
            <div className="flex gap-3">
              {(['tomate', 'creme'] as const).map((base) => (
                <button
                  key={base}
                  onClick={() => setSelectedBase(base)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                    selectedBase === base
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-foreground hover:border-primary/50'
                  }`}
                >
                  {base === 'tomate' ? '🍅 Tomate' : '🥛 Crème'}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Taille</h3>
            <div className="space-y-2">
              {pizzaSizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size)}
                  className={`w-full flex items-center justify-between py-3 px-4 rounded-xl border-2 transition-all ${
                    selectedSize.id === size.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/50 hover:border-primary/50'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{size.name}</p>
                    <p className="text-xs text-muted-foreground">{size.description}</p>
                  </div>
                  <div className="text-right">
                    {size.id === 'senior' && isPromoDay() ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">{pizza.basePrice + size.price}€</span>
                        <span className="font-display font-bold text-green-500">{getEffectiveBasePrice(pizza.basePrice, size.id) + size.price}€</span>
                      </div>
                    ) : (
                      <span className="font-display font-bold text-primary">
                        {pizza.basePrice + size.price}€
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Supplements */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Suppléments</h3>
            <div className="grid grid-cols-2 gap-2">
              {supplements.map((supplement) => {
                const isSelected = selectedSupplements.find((s) => s.id === supplement.id);
                return (
                  <button
                    key={supplement.id}
                    onClick={() => toggleSupplement(supplement)}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg border-2 text-sm transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-foreground hover:border-primary/50'
                    }`}
                  >
                    <span>{supplement.name}</span>
                    <span className="font-semibold">+{supplement.price}€</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Quantité</h3>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-xl font-display font-bold text-foreground w-8 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Add to Cart */}
          <Button
            variant="hero"
            size="xl"
            className="w-full"
            onClick={handleAddToCart}
          >
            Ajouter au panier • {calculateTotal().toFixed(2)}€
          </Button>
        </div>
      </div>
    </div>
  );
}
