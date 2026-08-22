'use client';

import { useEffect } from 'react';

/**
 * Error boundary.
 *
 * Next hides real error messages in production and shows only a digest, which is
 * useless to whoever is standing in front of the tablet. The overwhelmingly
 * likely cause on a fresh deployment is a missing Supabase environment variable,
 * so this says so and points at /api/health, which can tell you for certain.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Chore board error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="text-6xl" aria-hidden="true">
        🔧
      </span>

      <h1 className="text-3xl font-black">The board could not load</h1>

      <p className="text-lg font-semibold text-muted">
        This is almost always a missing setting rather than something you did.
      </p>

      <a
        href="/api/health"
        className="rounded-2xl bg-foreground px-6 py-4 text-lg font-black text-white active:scale-[0.98]"
      >
        Check what is wrong
      </a>

      <button
        type="button"
        onClick={reset}
        className="rounded-2xl bg-surface px-6 py-4 text-lg font-bold text-muted shadow-sm ring-1 ring-black/10 active:scale-[0.98]"
      >
        Try again
      </button>

      {error.digest && (
        <p className="text-sm font-semibold text-muted">
          Reference: <span className="tabular-nums">{error.digest}</span>
        </p>
      )}
    </main>
  );
}
