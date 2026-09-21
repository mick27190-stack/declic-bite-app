/**
 * Calcul du nombre réel de segments SMS facturés par Twilio.
 *
 * Un SMS est encodé en GSM-7 (160 caractères par segment, 153 si le message
 * est découpé en plusieurs segments) tant que tous ses caractères font partie
 * du jeu GSM-7. Dès qu'un emoji ou un caractère hors de ce jeu apparaît,
 * Twilio bascule en UCS-2 (70 caractères par segment, 67 si concaténé), ce qui
 * peut plus que doubler le coût d'une campagne.
 */

const GSM7_BASE =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

/** Caractères GSM-7 étendus : ils comptent double dans un segment. */
const GSM7_EXTENDED = '^{}\\[~]|€';

const BASE_SET = new Set(Array.from(GSM7_BASE));
const EXT_SET = new Set(Array.from(GSM7_EXTENDED));

export interface SmsSegmentInfo {
  /** 'gsm7' ou 'unicode' */
  encoding: 'gsm7' | 'unicode';
  /** Nombre de segments réellement facturés. */
  segments: number;
  /** Longueur utilisée pour le calcul (unités GSM-7 ou UTF-16). */
  length: number;
  /** Caractères qui forcent l'encodage Unicode (uniques, ordre d'apparition). */
  unicodeChars: string[];
}

export function analyzeSms(message: string): SmsSegmentInfo {
  const chars = Array.from(message);
  const unicodeChars: string[] = [];
  let gsmLength = 0;

  for (const ch of chars) {
    if (BASE_SET.has(ch)) {
      gsmLength += 1;
    } else if (EXT_SET.has(ch)) {
      gsmLength += 2;
    } else if (!unicodeChars.includes(ch)) {
      unicodeChars.push(ch);
    }
  }

  if (unicodeChars.length > 0) {
    // UCS-2 : la longueur se compte en unités UTF-16 (un emoji = 2 unités).
    const length = message.length;
    const segments = length === 0 ? 0 : length <= 70 ? 1 : Math.ceil(length / 67);
    return { encoding: 'unicode', segments, length, unicodeChars };
  }

  const segments = gsmLength === 0 ? 0 : gsmLength <= 160 ? 1 : Math.ceil(gsmLength / 153);
  return { encoding: 'gsm7', segments, length: gsmLength, unicodeChars: [] };
}

/** Tarif Twilio indicatif par segment (USD). */
export const SMS_SEGMENT_PRICE_USD = 0.0798;

export function estimateCampaignCost(segments: number, recipients: number): number {
  return segments * recipients * SMS_SEGMENT_PRICE_USD;
}
