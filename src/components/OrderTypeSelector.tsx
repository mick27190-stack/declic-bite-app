import { Truck, ShoppingBag } from 'lucide-react';
import { OrderType } from '@/types/pizza';

interface OrderTypeSelectorProps {
  value: OrderType;
  onChange: (type: OrderType) => void;
  deliveryDisabled?: boolean;
  takeawayDisabled?: boolean;
  disabled?: boolean;
}

export function OrderTypeSelector({ value, onChange, deliveryDisabled, takeawayDisabled: takeawayDisabledProp, disabled }: OrderTypeSelectorProps) {
  const takeawayDisabled = disabled || takeawayDisabledProp;
  const livraisonDisabled = disabled || deliveryDisabled;
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50' : ''}`}>
      <h3 className="font-display font-semibold text-foreground">Type de commande</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => !takeawayDisabled && onChange('emporter')}
          disabled={takeawayDisabled}
          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
            takeawayDisabled
              ? 'opacity-50 cursor-not-allowed border-border bg-muted'
              : value === 'emporter'
                ? 'border-primary bg-primary/10 shadow-glow'
                : 'border-border hover:border-primary/50 bg-card'
          }`}
        >
          <ShoppingBag className={`w-6 h-6 mx-auto mb-2 ${
            value === 'emporter' && !takeawayDisabled ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <span className={`block font-semibold ${
            value === 'emporter' && !takeawayDisabled ? 'text-primary' : 'text-foreground'
          }`}>
            À Emporter
          </span>
          <span className="text-xs text-muted-foreground">Récupérez au restaurant</span>
        </button>

        <button
          type="button"
          onClick={() => !livraisonDisabled && onChange('livraison')}
          disabled={livraisonDisabled}
          className={`p-4 rounded-xl border-2 transition-all duration-200 ${
            livraisonDisabled 
              ? 'opacity-50 cursor-not-allowed border-border bg-muted'
              : value === 'livraison'
                ? 'border-primary bg-primary/10 shadow-glow'
                : 'border-border hover:border-primary/50 bg-card'
          }`}
        >
          <Truck className={`w-6 h-6 mx-auto mb-2 ${
            value === 'livraison' && !livraisonDisabled ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <span className={`block font-semibold ${
            value === 'livraison' && !livraisonDisabled ? 'text-primary' : 'text-foreground'
          }`}>
            Livraison
          </span>
          <span className="text-xs text-muted-foreground">
            {deliveryDisabled && !disabled ? 'Non disponible après 21h16' : 'Chez vous en ~30 min'}
          </span>
        </button>
      </div>
    </div>
  );
}
