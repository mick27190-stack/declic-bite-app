import { useNavigate } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import distriGenericAsset from '@/assets/distri-declic-generic.png.asset.json';
import conchesLogoAsset from '@/assets/distri-declic-conches.png.asset.json';

const ACTIVE = [
  { id: 'conches', title: 'Conches en Ouche', place: "Bel'O Jet", address: "Bel'O Jet, 27190 Conches en Ouche", logo: conchesLogoAsset.url },
  { id: 'bray', title: 'Bray', place: "Rue de l'église", address: "30, rue de l'église, 27170 Bray", logo: distriGenericAsset.url },
];

const SOON = [
  { id: 'soon-1', subtitle: 'Emplacement dévoilé très vite', cta: "Être prévenu de l'ouverture" },
  { id: 'soon-2', subtitle: 'Peut-être près de chez vous ?', cta: 'Suggérer un emplacement' },
];

function openSmartPizza(e: React.MouseEvent<HTMLAnchorElement>) {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  if (isIOS) {
    e.preventDefault();
    window.location.href = 'https://apps.apple.com/fr/app/smart-pizza/id1603849374';
  } else if (isAndroid) {
    e.preventDefault();
    window.location.href =
      'intent://#Intent;package=com.apitech.smart_pizza;S.browser_fallback_url=' +
      encodeURIComponent('https://play.google.com/store/apps/details?id=com.apitech.smart_pizza') +
      ';end';
  }
}

const mapsUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

export default function DistributeursPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background px-4 pb-12">
      <div className="w-full max-w-md mx-auto fade-up">
        <button
          onClick={() => navigate(-1)}
          className="mt-8 mb-6 inline-flex items-center gap-2 rounded-xl bg-card/80 border border-border/50 px-4 py-0 text-sm font-semibold text-foreground shadow-card hover:bg-card hover:text-primary transition-colors"
        >
          ← Retour
        </button>
        <img src={distriGenericAsset.url} alt="Logo Distri'Déclic Pizza" className="w-48 h-48 mx-auto object-contain" />
        <h1 className="mt-4 mb-6 text-center text-3xl font-display font-bold text-foreground">Nos distributeurs</h1>

        <div className="space-y-5">
          {ACTIVE.map((d) => (
            <div key={d.id} className="glass-card border border-border/50 p-5">
              <div className="flex items-center gap-4">
                <img src={d.logo} alt={`Distributeur ${d.title}`} className="w-24 h-24 shrink-0 rounded-full object-contain border-2 border-vending/40 p-1" />
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-vending/20 px-3 py-0.5 text-xs font-semibold text-foreground">
                    <span className="w-2 h-2 rounded-full bg-vending" /> En service
                  </span>
                  <h2 className="mt-1 text-2xl font-display font-bold text-foreground leading-tight">{d.title}</h2>
                  <p className="text-sm text-muted-foreground">{d.place}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary shrink-0" />{d.address}</p>
                <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary shrink-0" /><span><span className="font-semibold text-foreground">24h/24 · 7j/7</span>, pizzas fraîches</span></p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <a
                  href="https://application.smart-machine.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openSmartPizza}
                  className="rounded-xl bg-vending text-vending-foreground py-2.5 text-center font-semibold hover:opacity-90 transition-opacity"
                >
                  Commander
                </a>
                <a
                  href={mapsUrl(d.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-border py-2.5 text-center font-semibold text-foreground hover:border-primary/50 transition-colors"
                >
                  Itinéraire
                </a>
              </div>
            </div>
          ))}

          {SOON.map((s) => (
            <div key={s.id} className="rounded-2xl border-2 border-dashed border-primary/40 bg-card/40 p-5">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 shrink-0 rounded-full bg-muted flex items-center justify-center text-5xl font-display font-bold text-primary">?</div>
                <div className="min-w-0">
                  <span className="inline-block rounded-full bg-primary/15 px-3 py-0.5 text-xs font-semibold text-primary">Bientôt</span>
                  <h2 className="mt-1 text-2xl font-display font-bold text-foreground leading-tight">Prochaine ouverture</h2>
                  <p className="text-sm text-muted-foreground">{s.subtitle}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 w-4/5 rounded-full bg-muted" />
                <div className="h-2.5 w-1/2 rounded-full bg-muted" />
              </div>
              <button type="button" disabled className="mt-4 w-full rounded-xl border border-primary/60 py-2.5 font-semibold text-primary cursor-default">
                {s.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
