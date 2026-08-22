import type { MetadataRoute } from 'next';

/**
 * The PWA manifest.
 *
 * `display: standalone` is what removes the browser chrome once the board is
 * installed to the tablet's home screen - the Phase 6 acceptance criterion.
 *
 * `start_url` is the picker, not the last visited page: whoever picks the tablet
 * up next is not necessarily the child who put it down.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Family Chore Board',
    short_name: 'Chores',
    description: 'Daily chores and stars for the whole family',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#3B82F6',
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Scoreboard', url: '/scoreboard' },
      { name: 'Parent zone', url: '/parent' },
    ],
  };
}
