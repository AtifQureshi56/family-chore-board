import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerAuthClient, createServiceClient } from './supabase';

export type FamilySession = {
  userId: string;
  email: string | null;
  familyId: string;
};

/**
 * The signed-in parent, or null. Uses getUser() rather than getSession(): the
 * session cookie is attacker-supplied data until Supabase has verified the JWT
 * against the auth server, and every authorisation decision below hangs off this.
 *
 * Wrapped in React's cache() so one page render costs one round trip to the auth
 * server no matter how many guards ask.
 */
export const getUser = cache(async () => {
  const store = await cookies();
  const supabase = createServerAuthClient({
    getAll: () => store.getAll(),
    set: (name, value, options) => store.set(name, value, options),
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
});

/**
 * Which family the signed-in parent belongs to, creating or adopting one on their
 * very first visit. Null means nobody is signed in.
 */
export const getFamilySession = cache(async (): Promise<FamilySession | null> => {
  const user = await getUser();
  if (!user) return null;

  const db = createServiceClient();
  const { data: member } = await db
    .from('family_members')
    .select('family_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (member?.family_id) {
    return { userId: user.id, email: user.email ?? null, familyId: member.family_id as string };
  }

  // First sign-in: adopt the pre-auth board if it is still unclaimed, otherwise
  // get a brand new family with the default chore list already in it.
  const { data: familyId, error } = await db.rpc('claim_or_create_family', {
    p_user_id: user.id,
    p_email: user.email ?? null,
  });
  if (error) throw error;

  return { userId: user.id, email: user.email ?? null, familyId: familyId as string };
});

/**
 * The guard every page and every write sits behind. Sends anyone without a
 * session to the sign-in screen rather than throwing, so a bookmarked deep link
 * from a logged-out tablet lands somewhere useful.
 */
export async function requireFamily(): Promise<FamilySession> {
  const session = await getFamilySession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Same guard for server actions and route handlers, where a redirect is the wrong
 * answer - a fetch should get an error it can show, not an HTML login page.
 */
export async function requireFamilyOrThrow(): Promise<FamilySession> {
  const session = await getFamilySession();
  if (!session) throw new Error('Please sign in again.');
  return session;
}
