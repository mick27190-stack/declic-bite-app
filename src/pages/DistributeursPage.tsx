import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import distriGenericAsset from '@/assets/distri-declic-generic.png.asset.json';
import conchesLogoAsset from '@/assets/distri-declic-conches.png.asset.json';

const DISTRIBUTEURS = [
  {
    id: 'conches',
    name: 'Distributeur Déclic Pizza - Conches',
    subtitle: 'Disponible 24h/24 • Commandez en ligne',
    logo: conchesLogoAsset.url,
  },
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
        <div className="space-y-4">
          {DISTRIBUTEURS.map((d) => (
            <a
              key={d.id}
              href="https://application.smart-machine.fr/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={openSmartPizza}
              className="w-full glass-card p-5 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 border border-border/50 group"
            >
              <img src={d.logo} alt={`Logo ${d.name}`} className="w-20 h-20 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110" />
              <div className="text-left flex-1">
                <h3 className="text-lg font-display font-bold text-primary">{d.name}</h3>
                <p className="text-sm text-muted-foreground">{d.subtitle}</p>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
