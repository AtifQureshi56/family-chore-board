'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerAuthClient } from '@/lib/supabase';
import { closeParentSession } from '@/lib/parentSession';

/**
 * Signs the family out of the device.
 *
 * The parent-zone unlock is dropped too. Leaving it behind would mean the next
 * account to sign in on a shared tablet inherits an unlocked chore editor - the
 * cookie is family-stamped so it would not actually grant anything, but clearing
 * it keeps the two session concepts from drifting apart.
 */
export async function signOut(): Promise<void> {
  const store = await cookies();
  const supabase = createServerAuthClient({
    getAll: () => store.getAll(),
    set: (name, value, options) => store.set(name, value, options),
  });

  await supabase.auth.signOut();
  await closeParentSession();

  redirect('/login');
}
