import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Ban, Gift, History, Loader2, MapPin, Sparkles, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLoyaltyCard, useLoyaltyHistory } from '@/hooks/useLoyalty';
import { CATEGORY_LABELS, rewardLabel } from '@/lib/loyalty';
import { restaurants } from '@/data/pizzas';

export default function LoyaltyCardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedRestaurant } = useCart();
  const site = selectedRestaurant?.id ?? null;
  const { entries, loading } = useLoyaltyCard(site);
  const { history, loading: historyLoading } = useLoyaltyHistory(site ?? undefined);

  const restaurant = restaurants.find((r) => r.id === site) ?? null;
  const siteLabel = restaurant?.name.replace('Déclic Pizza ', '') ?? null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-gradient-to-br from-primary via-primary-dark to-background p-5 pt-12">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="font-display text-xl text-white flex-1 leading-tight">Carte de fidélité</h1>
          <Gift className="w-6 h-6 text-white shrink-0" />
        </div>
        {siteLabel && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-white text-xs font-medium">
            <MapPin className="w-3.5 h-3.5" />
            Site actif : {siteLabel}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-4">
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
          const remaining = Math.max(0, program.required_count - currentCount);
          return (
            <div key={program.id} className="glass-card p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-base text-foreground leading-tight">
                  Pizzas {CATEGORY_LABELS[program.category]}
                </h2>
                <span className="text-sm font-bold text-primary whitespace-nowrap">
                  {currentCount}/{program.required_count}
                </span>
              </div>

              <div>
                <Progress value={pct} className="h-3 bg-muted" />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {remaining > 0
                      ? <>Plus que <span className="font-semibold text-foreground">{remaining}</span> pizza{remaining > 1 ? 's' : ''}</>
                      : <>Objectif atteint ! 🎉</>}
                  </span>
                  <span className="font-medium text-foreground">{pct}%</span>
                </div>
              </div>

              {/* Prochaine récompense */}
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-start gap-2.5">
                <Trophy className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Prochaine récompense
                  </p>
                  <p className="text-sm text-foreground mt-0.5">
                    {rewardLabel(program)}
                  </p>
                </div>
              </div>

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

        {user && site && (
          <div className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg text-foreground">
                Historique des remises
              </h2>
            </div>

            {historyLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune remise fidélité utilisée pour le moment.
              </p>
            )}

            {!historyLoading &&
              history.map(({ reward, program }) => {
                const applied = reward.status === 'applied';
                const date = applied
                  ? reward.applied_at ?? reward.created_at
                  : reward.cancelled_at ?? reward.created_at;
                return (
                  <div
                    key={reward.id}
                    className="flex items-start gap-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
                  >
                    {applied ? (
                      <BadgeCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Ban className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {program
                          ? rewardLabel(program)
                          : 'Récompense fidélité'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {applied ? 'Utilisée' : 'Annulée'} le{' '}
                        {format(new Date(date), 'dd MMMM yyyy', { locale: fr })}
                        {program ? ` • Pizzas ${CATEGORY_LABELS[program.category]}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
