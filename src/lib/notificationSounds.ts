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
