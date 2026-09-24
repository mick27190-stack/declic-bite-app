/**
 * Generates notification sounds using the Web Audio API.
 * Two distinct sounds: one for orders (urgent chime) and one for chat messages (soft ping).
 *
 * Browsers create AudioContexts in a "suspended" state until a user gesture
 * resumes them. We therefore keep a single shared context and unlock it on the
 * first user interaction (see initNotificationSounds()).
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedCtx) return sharedCtx;
  try {
    sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Must be called once from a user gesture (click / touch / keydown) so the
 * browser allows audio playback later, even when it's triggered asynchronously
 * (e.g. from a realtime event).
 */
export function initNotificationSounds() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playTone(frequencies: number[], durations: number[], volume = 0.3, type: OscillatorType = 'sine') {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Make sure the context is running (it can get suspended again on mobile).
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const gainNode = ctx.createGain();
  gainNode.connect(ctx.destination);

  let startTime = ctx.currentTime;

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gainNode);

    const dur = durations[i] || 0.15;
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.start(startTime);
    osc.stop(startTime + dur);
    startTime += dur * 0.8;
  });

  // Note: we deliberately do NOT close the shared context so subsequent
  // notifications can reuse it.
}

/** Urgent double chime for new orders */
export function playOrderSound() {
  playTone([880, 1100, 880, 1100], [0.12, 0.12, 0.12, 0.2], 0.4, 'sine');
}

/** Soft single ping for chat messages */
export function playChatSound() {
  playTone([660, 520], [0.15, 0.2], 0.25, 'triangle');
}

export type AlarmSoundId =
  | 'siren' | 'chime' | 'bell' | 'beep'
  | 'whistle' | 'crystal'
  | 'melody' | 'sleigh' | 'doorbell' | 'harp';
export interface AlarmSettings {
  sound: AlarmSoundId;
  volume: number; // 0-100
  duration: number; // seconds per ring (1-5)
  repetitions: number; // 0 = until acknowledged
}
export const ALARM_SOUNDS: { id: AlarmSoundId; label: string; group: string }[] = [
  { id: 'siren', label: 'Sirène', group: 'Urgents' },
  { id: 'chime', label: 'Carillon', group: 'Urgents' },
  { id: 'bell', label: 'Cloche', group: 'Urgents' },
  { id: 'beep', label: 'Bip', group: 'Urgents' },
  { id: 'whistle', label: 'Sifflet aigu', group: 'Sons aigus' },
  { id: 'crystal', label: 'Cristal', group: 'Sons aigus' },
  { id: 'melody', label: 'Mélodie', group: 'Sons mélodiques' },
  { id: 'harp', label: 'Harpe', group: 'Sons mélodiques' },
  { id: 'doorbell', label: 'Sonnerie', group: 'Sons mélodiques' },
  { id: 'sleigh', label: 'Grelots', group: 'Sons mélodiques' },
];
export const DEFAULT_ALARM_SETTINGS: AlarmSettings = { sound: 'siren', volume: 100, duration: 1, repetitions: 0 };
const ALARM_KEY = 'order-alarm-settings-v1';
export const ALARM_SETTINGS_EVENT = 'order-alarm-settings-changed';

export function getAlarmSettings(): AlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_KEY);
    return raw ? { ...DEFAULT_ALARM_SETTINGS, ...JSON.parse(raw) } : DEFAULT_ALARM_SETTINGS;
  } catch {
    return DEFAULT_ALARM_SETTINGS;
  }
}
export function saveAlarmSettings(s: AlarmSettings) {
  localStorage.setItem(ALARM_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(ALARM_SETTINGS_EVENT));
}

const PATTERNS: Record<AlarmSoundId, { f: number[]; d: number[]; type: OscillatorType }> = {
  // Urgents
  siren: { f: [988, 740], d: [0.18, 0.18], type: 'square' },
  chime: { f: [880, 1100], d: [0.14, 0.2], type: 'sine' },
  bell: { f: [1320, 990], d: [0.3, 0.4], type: 'triangle' },
  beep: { f: [1000, 0], d: [0.15, 0.1], type: 'square' },
  // Aigus (plus perçants, très audibles dans une cuisine bruyante)
  whistle: { f: [1800, 2400], d: [0.15, 0.15], type: 'sine' },
  crystal: { f: [2093, 2637], d: [0.1, 0.14], type: 'sine' },
  // Mélodiques (arpèges doux, moins agressifs)
  melody: { f: [523.25, 659.25, 783.99], d: [0.14, 0.14, 0.2], type: 'sine' },
  harp: { f: [784, 988, 1175, 1568], d: [0.12, 0.12, 0.12, 0.2], type: 'triangle' },
  doorbell: { f: [659, 523], d: [0.3, 0.35], type: 'sine' },
  sleigh: { f: [1760, 2200], d: [0.09, 0.09], type: 'triangle' },
};

/** Kitchen alarm — plays one ring using the configured sound, volume and duration. */
export function playAlarmSound(settings: AlarmSettings = getAlarmSettings()) {
  const p = PATTERNS[settings.sound] ?? PATTERNS.siren;
  const cycle = p.d.reduce((a, b) => a + b * 0.8, 0);
  const n = Math.max(1, Math.round(settings.duration / cycle));
  const f: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n; i++) { f.push(...p.f); d.push(...p.d); }
  const vol = Math.max(0.001, Math.min(1, settings.volume / 100) * 0.6);
  // Frequency 0 = silence gap
  playTone(f.map((x) => x || 1), d, vol, p.type);
}

export function isAudioUnlocked(): boolean {
  return sharedCtx?.state === 'running';
}
