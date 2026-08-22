'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

/** Confetti and a badge on a perfect day. Dismisses on any tap. */
type Props = {
  color: string;
  name: string;
  points: number;
  onDismiss: () => void;
};

export default function CelebrationOverlay({ color, name, points, onDismiss }: Props) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const end = Date.now() + 1500;
    const colors = [color, '#fbbf24', '#ffffff'];

    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();

    // Auto-dismiss so the board never gets stuck behind an overlay.
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [color, onDismiss]);

  return (
    <div
      role="dialog"
      aria-label={`${name} finished every chore`}
      onClick={onDismiss}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 backdrop-blur-sm"
    >
      <div className="animate-pop-in flex flex-col items-center gap-4 rounded-[2.5rem] bg-surface px-10 py-12 text-center shadow-2xl">
        <span className="text-8xl" aria-hidden="true">
          🎉
        </span>
        <p className="text-4xl font-black" style={{ color }}>
          Perfect day!
        </p>
        <p className="text-xl font-bold text-muted">
          {name} finished everything
        </p>
        <p className="rounded-full px-6 py-3 text-2xl font-black text-white" style={{ backgroundColor: color }}>
          ⭐ {points} stars
        </p>
        <p className="text-sm font-semibold text-muted">Tap anywhere to close</p>
      </div>
    </div>
  );
}
