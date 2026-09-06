import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type BannerTone = 'yellow' | 'red' | 'green';

const TONE_CLASSES: Record<BannerTone, string> = {
  yellow: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700',
  red: 'border-destructive/30 bg-destructive/10 text-destructive',
  green: 'border-green-500/30 bg-green-500/10 text-green-600',
};

interface RetractableBannerProps {
  /** When false, renders nothing and resets the timer. */
  visible: boolean;
  /** Compact content shown once the banner has retracted. */
  summary: ReactNode;
  /** Full banner content shown while expanded. */
  children: ReactNode;
  /** Outer spacing (e.g. "mb-4"). */
  className?: string;
  tone?: BannerTone;
  /** Collapse delay in ms. */
  delay?: number;
}

/**
 * Customer-facing informational banner that automatically retracts to a compact
 * summary bar after `delay` ms. Tapping the summary re-expands it and re-arms
 * the timer. When `visible` is false the banner is absent and the timer resets,
 * so it always shows fully for the first `delay` ms whenever it appears.
 */
export function RetractableBanner({
  visible,
  summary,
  children,
  className = '',
  tone = 'yellow',
  delay = 4000,
}: RetractableBannerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [armed, setArmed] = useState(0);

  // (Re)expand whenever the banner (re)appears.
  useEffect(() => {
    if (!visible) {
      setCollapsed(false);
      return;
    }
    setCollapsed(false);
    setArmed((a) => a + 1);
  }, [visible]);

  // Auto-retract timer, re-armed on appear and on manual expand.
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setCollapsed(true), delay);
    return () => window.clearTimeout(t);
  }, [visible, armed, delay]);

  const expand = useCallback(() => {
    setCollapsed(false);
    setArmed((a) => a + 1);
  }, []);

  if (!visible) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={expand}
        aria-label="Afficher le détail du message"
        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl border text-sm font-semibold animate-fade-in ${TONE_CLASSES[tone]} ${className}`}
      >
        {summary}
        <ChevronDown className="w-4 h-4 ml-auto shrink-0 opacity-70" />
      </button>
    );
  }

  return (
    <div key="expanded" className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

export default RetractableBanner;
