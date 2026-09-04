import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gift, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoyaltyCard } from '@/hooks/useLoyalty';
import { CATEGORY_LABELS, rewardLabel } from '@/lib/loyalty';

export default function LoyaltyCardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedRestaurant } = useCart();
  const site = selectedRestaurant?.id ?? null;
  const { entries, loading } = useLoyaltyCard(site);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-gradient-to-br from-primary via-primary-dark to-background p-6 pt-12">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="font-display text-2xl text-white flex-1">Carte de fidélité</h1>
          <Gift className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="p-6 space-y-4">
        {!site && (
          <p className="text-muted-foreground text-sm">
            Choisissez d'abord une pizzeria pour voir votre carte de fidélité.
          </p>
        )}

        {site && loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {site && !loading && entries.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Aucun programme de fidélité n'est actif pour le moment.
          </p>
        )}

        {!user && site && entries.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Connectez-vous pour suivre votre progression.
          </p>
        )}

        {entries.map(({ program, currentCount, pendingRewards }) => {
          const pct = Math.min(100, Math.round((currentCount / program.required_count) * 100));
          return (
            <div key={program.id} className="glass-card p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-foreground">
                  Pizzas {CATEGORY_LABELS[program.category]}
                </h2>
                <span className="text-sm font-semibold text-primary">
                  {currentCount}/{program.required_count}
                </span>
              </div>

              <Progress value={pct} className="h-3" />

              <p className="text-xs text-muted-foreground">
                Récompense : {rewardLabel(program)}
              </p>

              {pendingRewards > 0 && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-start gap-2">
                  <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-green-700">
                    Récompense disponible sur ta prochaine pizza {CATEGORY_LABELS[program.category]} !
                    {pendingRewards > 1 && ` (${pendingRewards} disponibles)`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
