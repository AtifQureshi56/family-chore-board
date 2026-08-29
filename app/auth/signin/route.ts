import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerAuthClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Starts the Google sign-in, server side.
 *
 * This used to happen in the browser: a click handler awaited
 * signInWithOAuth(), which stored the PKCE verifier and then set
 * window.location itself. On a laptop that is invisible; on a phone it is the
 * whole bug. The navigation ends up one async tick removed from the tap that
 * caused it, and mobile browsers - which police navigations that are no longer
 * attached to a user gesture far more aggressively than desktop ones - can
 * simply drop it. The button appears to do nothing, with no error to show.
 *
 * A link to this route cannot fail that way. The tap is an ordinary navigation,
 * the verifier cookie is written by the server, and the redirect to Google is a
 * 302. Sign-in now works with JavaScript still loading, or off entirely.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  const callback = new URL('/auth/callback', origin);
  if (target) callback.searchParams.set('next', target);

  const store = await cookies();
  const supabase = createServerAuthClient({
    getAll: () => store.getAll(),
    set: (name, value, options) => store.set(name, value, options),
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callback.toString(),
      // Google reuses the last account silently unless asked. On a shared tablet
      // that means signing in as somebody else without being offered the choice.
      queryParams: { prompt: 'select_account' },
      // We do the redirecting; there is no browser here to do it for us.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(
        error?.message ?? 'Could not reach Google. Try again.',
      )}`,
    );
  }

  return NextResponse.redirect(data.url);
}
