import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Anon client — safe in the browser. Used for reads and for the TV board's
 * realtime subscription.
 */
export function createBrowserClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL', url),
    required('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
  );
}

/**
 * Service-role client — server only. Every write goes through here, which is why
 * the guards in the server actions are the real security boundary.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    required('NEXT_PUBLIC_SUPABASE_URL', url),
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
