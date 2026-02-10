/**
 * Generates notification sounds using the Web Audio API.
 * Two distinct sounds: one for orders (urgent chime) and one for chat messages (soft ping).
 */

function createAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch {
    return null;
  }
}

function playTone(frequencies: number[], durations: number[], volume = 0.3, type: OscillatorType = 'sine') {
  const ctx = createAudioContext();
  if (!ctx) return;

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

  // Cleanup
  setTimeout(() => ctx.close(), 2000);
}

/** Urgent double chime for new orders */
export function playOrderSound() {
  playTone([880, 1100, 880, 1100], [0.12, 0.12, 0.12, 0.2], 0.4, 'sine');
}

/** Soft single ping for chat messages */
export function playChatSound() {
  playTone([660, 520], [0.15, 0.2], 0.25, 'triangle');
}
