/**
 * A short pop on check.
 *
 * Synthesised with the Web Audio API rather than shipped as an audio file: no
 * asset to load, no delay on the first tap, and it cannot fail to decode on the
 * tablet's browser. Silent until the child's first tap, because browsers refuse
 * to start audio before a user gesture.
 */
let ctx: AudioContext | null = null;

export function playCheckSound(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // A rising two-note blip: reads as "yes" rather than "alert".
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(990, now + 0.09);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch {
    // Audio is a bonus, never a requirement. A blocked AudioContext must not
    // break the toggle.
  }
}
