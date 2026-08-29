import Link from 'next/link';

/**
 * Google sign-in.
 *
 * Deliberately a link, not a button with a click handler. The redirect to Google
 * is started by /auth/signin on the server, so the tap is an ordinary navigation
 * that no browser has cause to block and that works before - or without - any
 * JavaScript. The mobile failure this replaced was a click handler whose
 * navigation happened a tick after the tap and was silently dropped.
 */
export default function SignInButtons({ next }: { next?: string }) {
  const href = next ? `/auth/signin?next=${encodeURIComponent(next)}` : '/auth/signin';

  return (
    <div className="flex w-full flex-col gap-4">
      <Link
        href={href}
        prefetch={false}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-surface text-lg font-black shadow-sm ring-1 ring-black/10 active:scale-[0.98]"
      >
        <GoogleMark />
        Continue with Google
      </Link>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.2z"
      />
      <path
        fill="#34A853"
        d="M24 46c6 0 11-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.7C7.8 41 15.3 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.7 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.4-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 30 2 24 2 15.3 2 7.8 7 4.3 14.1l7.4 5.7c1.7-5.2 6.6-9.1 12.3-9.1z"
      />
    </svg>
  );
}
