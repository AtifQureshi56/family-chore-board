'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated count-up number. Children watch the number climb; landing on the new
 * total instantly loses most of the reward.
 */
type Props = {
  value: number;
  className?: string;
  durationMs?: number;
};

export default function StarCounter({ value, className = '', durationMs = 500 }: Props) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // ease-out so it decelerates into the final number
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return (
    <span className={className} suppressHydrationWarning>
      {shown}
    </span>
  );
}
