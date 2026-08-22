'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { closeParentSession, openParentSession, requireParent } from '@/lib/parentSession';

/**
 * A tablet sitting on a kitchen counter is the threat model here: a curious child
 * with unlimited time, not a botnet. A short lockout after repeated wrong guesses
 * makes brute-forcing 10,000 combinations impractical without punishing a parent
 * who fat-fingers it once.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

let attempts = 0;
let lockedUntil = 0;

export async function verifyPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  if (Date.now() < lockedUntil) {
    const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
    return { ok: false, error: `Too many tries. Wait ${seconds} seconds.` };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: 'The PIN is four digits.' };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('key', 'parent_pin_hash')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No PIN is set. Run `npm run seed` first.' };

  const hash = typeof data.value === 'string' ? data.value : String(data.value);

  if (!bcrypt.compareSync(pin, hash)) {
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_MS;
      attempts = 0;
      return { ok: false, error: 'Too many tries. Wait a minute.' };
    }
    return { ok: false, error: 'That PIN is not right.' };
  }

  attempts = 0;
  await openParentSession();
  revalidatePath('/parent');
  return { ok: true };
}

export async function lockParentZone(): Promise<void> {
  await closeParentSession();
  revalidatePath('/parent');
}

export async function changePin(
  current: string,
  next: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireParent();

  if (!/^\d{4}$/.test(next)) {
    return { ok: false, error: 'The new PIN must be four digits.' };
  }

  // Re-check the current PIN even though the zone is unlocked: an unattended
  // unlocked tablet should not let anyone lock the parent out of their own zone.
  const check = await verifyPin(current);
  if (!check.ok) return { ok: false, error: 'The current PIN is not right.' };

  const db = createServiceClient();
  const { error } = await db
    .from('settings')
    .upsert({ key: 'parent_pin_hash', value: bcrypt.hashSync(next, 10) });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
