import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createBrowserClient as createSsrBrowserClient,
  createServerClient as createSsrServerClient,
} from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your Supabase keys.`,
    );
  }
  return value;
}

/** The cookie shape @supabase/ssr needs, without importing Next types into a shared module. */
export type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

/**
 * Anon client for the browser, reading the signed-in parent's session from
 * cookies. The TV board's realtime subscription runs through this, and it is the
 * session - not the key - that decides which family's rows come back.
 */
export function createBrowserClient(): SupabaseClient {
  return createSsrBrowserClient(
    required('NEXT_PUBLIC_SUPABASE_URL', url),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
  );
}

/**
 * Anon client for the server, bound to the request's cookies. This is the only
 * client that knows *who* is asking; use it to read the user, never to read
 * family data (that is what the service client plus an explicit family filter is
 * for).
 */
export function createServerAuthClient(store: CookieStore): SupabaseClient {
  return createSsrServerClient(
    required('NEXT_PUBLIC_SUPABASE_URL', url),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookies) => {
          try {
            for (const { name, value, options } of cookies) store.set(name, value, options);
          } catch {
            // A Server Component cannot write cookies. The middleware refreshes
            // the session on every request, so losing the write here is harmless.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — server only, bypasses RLS entirely. Every read and write
 * goes through here, which is why passing the right family_id is not a
 * convenience: it is the only thing keeping one family's board out of another's.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL', url),
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
