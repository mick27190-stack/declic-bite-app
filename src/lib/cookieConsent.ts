export const COOKIE_CONSENT_KEY = 'cookie_consent';
export const OPEN_COOKIE_PREFS_EVENT = 'open-cookie-preferences';

export interface CookieConsent {
  essentiels: true;
  analytics: boolean;
  date: string;
}

export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics !== 'boolean') return null;
    return parsed as CookieConsent;
  } catch {
    return null;
  }
}

export function saveCookieConsent(analytics: boolean): CookieConsent {
  const c: CookieConsent = { essentiels: true, analytics, date: new Date().toISOString() };
  try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(c)); } catch { /* ignore */ }
  return c;
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT));
}
