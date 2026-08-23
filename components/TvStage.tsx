'use client';

import { useEffect, useState } from 'react';

/**
 * Holds the board at exactly 1920x1080 and scales it to fit whatever the screen
 * actually is.
 *
 * The spec designs for a fixed 1920x1080 landscape with no breakpoints. Scaling
 * keeps that promise while surviving the real world - an old laptop on HDMI, a
 * 1366x768 panel, a TV that reports something odd - without a single media query.
 */
export default function TvStage({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0b1020',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {children}
      </div>
    </div>
  );
}
