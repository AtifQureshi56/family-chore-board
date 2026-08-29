import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerAuthClient } from '@/lib/supabase';
import { getFamilySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Where Google sends the parent back to.
 *
 * Two things have to happen here and both matter: the one-time code is traded for
 * a session cookie, and getFamilySession() runs once so the family row exists
 * before the first page renders. Doing the second lazily would mean a brand new
 * parent's first request races itself.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) {
    const reason = searchParams.get('error_description') ?? searchParams.get('error');
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
    );
  }

  const store = await cookies();
  const supabase = createServerAuthClient({
    getAll: () => store.getAll(),
    set: (name, value, options) => store.set(name, value, options),
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(error.message)}`,
    );
  }

  try {
    await getFamilySession();
  } catch (err) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?reason=${encodeURIComponent(
        err instanceof Error ? err.message : 'Could not set up your family board.',
      )}`,
    );
  }

  return NextResponse.redirect(`${origin}${target}`);
}
