import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const configured = Boolean(url && secret);

export function testDb(): SupabaseClient {
  return createClient(url!, secret!, { auth: { persistSession: false } });
}

/**
 * A throwaway tenant for one test file.
 *
 * Every integration test now runs inside its own family rather than sharing the
 * seeded one. That is worth the extra setup twice over: the tests stop depending
 * on whatever chores happen to be seeded, and deleting the family at the end
 * cascades to children, tasks, completions, perfect_days and settings, so a
 * failed run leaves nothing behind to poison the next one.
 */
export async function createTestFamily(db: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await db
    .from('families')
    .insert({ name: `__test__ ${name}` })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function deleteTestFamily(db: SupabaseClient, familyId: string): Promise<void> {
  if (!familyId) return;
  await db.from('families').delete().eq('id', familyId);
}
