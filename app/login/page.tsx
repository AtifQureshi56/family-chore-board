import SignInButtons from '@/components/SignInButtons';
import { getUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — Chore Board',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; switch?: string }>;
}) {
  const { next } = await searchParams;
  // Reached with ?switch=1 while still signed in: name the account being left, so
  // nobody signs a second family in on top of the first without noticing.
  const current = await getUser();
  // Only in-app paths, never an absolute URL: an open redirect here would let a
  // crafted link bounce a freshly signed-in parent off to someone else's site.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-10 p-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="text-6xl" aria-hidden="true">
          ⭐
        </span>
        <h1 className="text-4xl font-black tracking-tight">Chore Board</h1>
        <p className="text-lg font-semibold text-muted">
          Sign in to set up your family&apos;s board. Your children and their stars stay private to
          your account.
        </p>
      </header>

      {current && (
        <p className="w-full rounded-2xl bg-surface p-4 text-center font-semibold text-muted shadow-sm ring-1 ring-black/5">
          This device is signed in as <span className="text-foreground">{current.email}</span>. Signing in
          below swaps the board over to the account you choose.
        </p>
      )}

      <SignInButtons next={safeNext} />

      <p className="text-center text-sm font-semibold text-muted">
        One account per family. Everything you add — children, chores, stars — is visible only to
        the account that created it.
      </p>
    </main>
  );
}
