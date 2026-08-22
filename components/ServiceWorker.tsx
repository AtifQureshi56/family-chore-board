'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, which is what makes the browser offer "Add to
 * home screen". Registration is deliberately silent: if it fails, the board still
 * works in a normal tab.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Dev builds change on every edit; a worker caching them helps nobody.
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* installability is a bonus, never a requirement */
    });
  }, []);

  return null;
}
