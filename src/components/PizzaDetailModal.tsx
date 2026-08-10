import { useState } from 'react';
import { X, Plus, Minus, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pizza, PizzaSize, Supplement, CartItem } from '@/types/pizza';
import { pizzaSizes, paniniSizes, supplements, pizzas } from '@/data/pizzas';
import { useCart } from '@/contexts/CartContext';
import { ProductImage } from '@/components/ProductImage';

import { useOrderingStatus } from '@/hooks/useOrderingStatus';
import { useToast } from '@/hooks/use-toast';
import { getPizzaSizePrice, getSizePriceInfo, getNonPizzaPrice, getPairPromoForSize, computePairPromoLineTotal, getRawSizePrice } from '@/lib/pricing';
import { usePricing } from '@/contexts/PricingContext';

const PIZZA_CATEGORIES = ['classiques', 'speciales', 'vegetariennes', 'gourmandes'];

interface PizzaDetailModalProps {
  pizza: Pizza;
  onClose: () => void;
}

export function PizzaDetailModal({ pizza, onClose }: PizzaDetailModalProps) {
  const isPizza = PIZZA_CATEGORIES.includes(pizza.category);
  const isPanini = pizza.category === 'paninis';
  const isBambino = pizza.category === 'bambino';
  const availableSizes = isPanini ? paniniSizes : pizzaSizes;
  const showSize = pizza.hasSize !== false;
  const showBase = pizza.hasBase !== false;
  const showSupplements = pizza.hasSupplements !== false;

  const allPizzas = pizzas.filter((p) => PIZZA_CATEGORIES.includes(p.category) && p.isAvailable);

  const [selectedSize, setSelectedSize] = useState<PizzaSize>(availableSizes[0]);
  const [selectedBase, setSelectedBase] = useState<'tomate' | 'creme'>('tomate');
  const [selectedSupplements, setSelectedSupplements] = useState<Supplement[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedBambinoPizza, setSelectedBambinoPizza] = useState<Pizza | null>(null);
  const [itemNotes, setItemNotes] = useState('');
  
  const { addItem, selectedRestaurant } = useCart();
  usePricing();
  const { manualClosure, isOrderingClosed } = useOrderingStatus();
  const { toast } = useToast();
  const isOrderingBlocked = isOrderingClosed || !!manualClosure;

  const toggleSupplement = (supplement: Supplement) => {
    setSelectedSupplements((prev) =>
      prev.find((s) => s.id === supplement.id)
        ? prev.filter((s) => s.id !== supplement.id)
        : [...prev, supplement]
    );
  };

  const calculateTotal = () => {
    if (!showSize) {
      return getNonPizzaPrice(pizza) * quantity;
    }
    const supps = selectedSupplements.reduce((sum, s) => sum + s.price, 0);
    if (isPizza) {
      const pairPromo = getPairPromoForSize(selectedSize.id, pizza.category);
      if (pairPromo) {
        const ref = getRawSizePrice(selectedSize.id);
        return computePairPromoLineTotal(pairPromo.promo_type, ref, quantity) + supps * quantity;
      }
      return (getPizzaSizePrice(selectedSize.id, pizza.category) + supps) * quantity;
    }
    return (getNonPizzaPrice(pizza, selectedSize) + supps) * quantity;
  };

  const handleAddToCart = () => {
    if (isOrderingBlocked) return;

    const cartPizza = isBambino && selectedBambinoPizza
      ? { ...pizza, description: `Menu Bambino - ${selectedBambinoPizza.name}` }
      : pizza;
    const item: CartItem = {
      pizza: cartPizza,
      size: showSize ? selectedSize : availableSizes[0],
      base: showBase ? selectedBase : 'tomate',
      supplements: selectedSupplements,
      quantity,
      notes: itemNotes.trim() || undefined,
    };
    addItem(item);
    toast({
      title: "Ajouté au panier ! 🛒",
      description: `${quantity}x ${pizza.name}${isBambino && selectedBambinoPizza ? ` (${selectedBambinoPizza.name})` : ''}${showSize ? ` (${selectedSize.name})` : ''}`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative aspect-video">
          <ProductImage
            src={pizza.image}
            alt={pizza.name}
            className="w-full h-full object-cover"
            iconClassName="h-16 w-16"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">{pizza.name}</h2>
            <p className="text-muted-foreground mt-1">{pizza.description}</p>
            {pizza.ingredients.length > 0 && (
              <p className="text-sm text-primary mt-2">
                {pizza.ingredients.join(' • ')}
              </p>
            )}
          </div>

          {/* Bambino Pizza Choice */}
          {isBambino && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Choix de la pizza</h3>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {allPizzas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedBambinoPizza(p)}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg border-2 text-sm transition-all text-left ${
                      selectedBambinoPizza?.id === p.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/50 text-foreground hover:border-primary/50'
                    }`}
                  >
                    <ProductImage src={p.image} alt={p.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" iconClassName="h-4 w-4" />
                    <span className="truncate font-medium">{p.name}</span>
                    {selectedBambinoPizza?.id === p.id && <Check className="w-4 h-4 flex-shrink-0 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showBase && (
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
          )}

          {/* Size Selection */}
          {showSize && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {isPanini ? 'Format' : 'Taille'}
              </h3>
              <div className="space-y-2">
                {availableSizes.map((size) => (
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
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-snug">
                        {isPanini
                          ? `Panini ${size.name.toLowerCase()} (${getNonPizzaPrice(pizza, size)}€)`
                          : size.description}
                      </p>
                    </div>
                    <div className="text-right">
                      {isPizza ? (() => {
                        const info = getSizePriceInfo(size.id, pizza.category);
                        return info.isPromo ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground line-through">{info.base}€</span>
                            <span className="font-display font-bold text-green-500">{info.effective}€</span>
                          </div>
                        ) : (
                          <span className="font-display font-bold text-primary">{info.effective}€</span>
                        );
                      })() : (
                        <span className="font-display font-bold text-primary">
                          {getNonPizzaPrice(pizza, size)}€
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Supplements - only for pizzas */}
          {showSupplements && (
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
          )}

          {/* Item notes for the pizzeria */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Message pour la pizzeria</h3>
            <Textarea
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="Ex : sans origan"
              className="bg-muted/50 border-border resize-none"
              rows={3}
            />
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

          {isOrderingBlocked && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive text-sm">Commandes indisponibles</p>
                <p className="text-sm text-foreground mt-1">
                  {manualClosure?.reason ?? 'La commande est momentanément indisponible.'}
                </p>
              </div>
            </div>
          )}
          {!isOrderingBlocked && (
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={handleAddToCart}
              disabled={isBambino && !selectedBambinoPizza}
            >
              Ajouter au panier • {calculateTotal().toFixed(2)}€
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
