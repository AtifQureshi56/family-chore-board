import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Reachable without signing in. Everything else needs a parent account. */
const PUBLIC_PATHS = ['/login', '/auth', '/api/health'];

/**
 * Refreshes the Supabase session on every request and turns away anyone who has
 * not signed in.
 *
 * The refresh is the part that is easy to skip and expensive to omit: access
 * tokens are short-lived, and a kitchen tablet that sits on the board for a week
 * only stays signed in because something writes the rotated cookie back on each
 * request. Server Components cannot set cookies, so this is the only place it can
 * happen.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Misconfigured deploys should fail loudly in the page, not silently lock
  // everyone out at the edge.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // API routes have had their session refreshed and are left to answer for
  // themselves. Redirecting them would hand a fetch() an HTML login page with a
  // 200 on it, which is far harder to react to than the 401 they return.
  if (path.startsWith('/api/')) return response;

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    // So the parent lands back where they were aiming after signing in.
    if (path !== '/') login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }

  // A signed-in parent has no use for the sign-in screen - unless they came to
  // hand the device to a different account, which ?switch=1 says explicitly.
  // Without that door, whoever is signed in on a browser stays signed in, and the
  // next person silently gets their board.
  if (user && path === '/login' && request.nextUrl.searchParams.get('switch') !== '1') {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and the icons/manifest the PWA fetches
    // before a session exists.
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
