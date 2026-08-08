import { useActiveClosures } from '@/hooks/useRestaurantClosures';
import { useLiveParisTime } from '@/hooks/useLiveParisTime';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';

/**
 * Blocage du chat client : quand un admin a activé un blocage des commandes ou
 * une fermeture de site, le chat est indisponible sur le créneau 18h-22h
 * (heure de Paris), avec un message adapté au type de blocage.
 */
export function useChatClosure(site?: string | null) {
  const now = useLiveParisTime();
  const { getClosureForSite } = useActiveClosures();
  const { data: companies } = useCompanyInfo();

  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      hour12: false,
    }).format(now),
  );
  const isServiceWindow = parisHour >= 18 && parisHour < 22;

  const closure = site ? getClosureForSite(site) : null;
  const type: 'orders' | 'site' | null = closure
    ? closure.closure_type === 'site'
      ? 'site'
      : 'orders'
    : null;

  const phone =
    site && site.toLowerCase().includes('beaumont')
      ? companies.beaumont?.phone ?? null
      : companies.conches?.phone ?? null;

  const isChatBlocked = isServiceWindow && !!closure;

  const title = type === 'site' ? 'Chat indisponible' : 'Chat momentanément indisponible';
  const message =
    type === 'site'
      ? "Le site est actuellement fermé : le chat est indisponible. Merci de réessayer à la réouverture."
      : "Les commandes en ligne sont momentanément bloquées et le chat est indisponible. Merci de contacter directement le restaurant par téléphone.";

  return { isChatBlocked, closure, type, phone, title, message };
}
