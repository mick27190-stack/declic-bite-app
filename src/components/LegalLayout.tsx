import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LegalLayoutProps {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}

/**
 * Mise en page commune aux pages légales (mentions, CGV, confidentialité).
 * Thème sombre/orange cohérent avec le site, conteneur centré ~800px,
 * orienté lecture, bonne lisibilité mobile.
 */
export function LegalLayout({ title, intro, children }: LegalLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              aria-label="Retour à l'accueil"
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Accueil</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-primary text-center flex-1">
              {title}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {intro && <div className="text-sm text-muted-foreground mb-6 space-y-1">{intro}</div>}
        <article className="space-y-1 text-foreground/85 leading-relaxed">
          {children}
        </article>
      </main>
    </div>
  );
}

/* ---------- Helpers de mise en forme réutilisables ---------- */

export function LegalH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg sm:text-xl font-display font-bold text-primary mt-8 mb-3 scroll-mt-24">
      {children}
    </h2>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="mb-3 leading-relaxed">{children}</p>;
}

/** Bloc "établissement" : nom en gras orange + lignes d'info. */
export function LegalEntity({
  name,
  lines,
}: {
  name: string;
  lines: ReactNode[];
}) {
  return (
    <div className="glass-card p-4 my-3">
      <p className="font-display font-bold text-primary mb-1">{name}</p>
      <div className="space-y-0.5 text-sm">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 mb-4">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto my-4 rounded-xl border border-border/50">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-primary/15">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left font-display font-bold text-primary px-3 py-2.5 border-b border-border/50 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30 last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 align-top text-foreground/85">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
