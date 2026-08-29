import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign-in problem — Chore Board',
  robots: { index: false, follow: false },
};

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="text-6xl" aria-hidden="true">
        🔑
      </span>
      <h1 className="text-3xl font-black">That sign-in did not finish</h1>
      <p className="font-semibold text-muted">
        The link from Google was already used or has expired. Signing in again fixes it.
      </p>

      {reason && (
        // Shown deliberately: without it, a missing redirect URL in the Supabase
        // dashboard looks identical to a network blip.
        <p className="w-full rounded-2xl bg-surface p-4 text-sm font-semibold text-muted ring-1 ring-black/5">
          {reason}
        </p>
      )}

      <Link
        href="/login"
        className="grid h-16 w-full place-items-center rounded-2xl bg-surface text-lg font-black shadow-sm ring-1 ring-black/10 active:scale-[0.98]"
      >
        Try again
      </Link>
    </main>
  );
}
