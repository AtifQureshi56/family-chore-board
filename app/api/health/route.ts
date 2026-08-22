import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics: /api/health
 *
 * Reports whether each environment variable is PRESENT and whether the database
 * actually answers. It never returns a key, or any part of one - only booleans,
 * a key's length, and the project host, which is already public in every browser
 * request the app makes.
 *
 * This exists because a missing env var otherwise surfaces as an opaque
 * "server-side exception ... Digest: 4091856041" on every single page.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url ? `set (${safeHost(url)})` : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? `set (${anon.length} chars)` : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: secret ? `set (${secret.length} chars)` : 'MISSING',
  };

  const missing = Object.entries(env)
    .filter(([, v]) => v === 'MISSING')
    .map(([k]) => k);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'Missing environment variables',
        missing,
        env,
        fix:
          'Add them in Vercel under Settings > Environment Variables for the ' +
          'Production environment, then REDEPLOY - env changes do not apply to an ' +
          'existing deployment.',
      },
      { status: 500 },
    );
  }

  // The keys are present; check the database actually answers.
  try {
    const db = createClient(url!, secret!, { auth: { persistSession: false } });
    const { error } = await db.from('children').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, problem: 'Database rejected the query', detail: error.message, env },
        { status: 500 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'Could not reach the database',
        detail: err instanceof Error ? err.message : String(err),
        env,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, env });
}

/** The project host only - never the key embedded in a connection string. */
function safeHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return 'unparseable URL';
  }
}
