'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase';
import { requireFamilyOrThrow } from '@/lib/session';
import {
  closeParentSession,
  openParentSession,
  requireParentZone,
} from '@/lib/parentSession';

/**
 * A tablet sitting on a kitchen counter is the threat model here: a curious child
 * with unlimited time, not a botnet. A short lockout after repeated wrong guesses
 * makes brute-forcing 10,000 combinations impractical without punishing a parent
 * who fat-fingers it once.
 *
 * The counter is per family. It used to be a pair of module-level numbers, which
 * with more than one family on the server would have meant one child guessing
 * wildly could lock every other family out of their own parent zone.
 */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

type Attempts = { count: number; lockedUntil: number };
const attemptsByFamily = new Map<string, Attempts>();

function attemptsFor(familyId: string): Attempts {
  // Serverless instances are recycled constantly, so this map is a speed bump
  // rather than a vault - but it is bounded, and stale entries are dropped as we
  // go so a long-lived instance cannot grow one per family forever.
  const now = Date.now();
  for (const [id, state] of attemptsByFamily) {
    if (state.lockedUntil < now - LOCKOUT_MS * 10 && state.count === 0) {
      attemptsByFamily.delete(id);
    }
  }

  const existing = attemptsByFamily.get(familyId);
  if (existing) return existing;

  const fresh: Attempts = { count: 0, lockedUntil: 0 };
  attemptsByFamily.set(familyId, fresh);
  return fresh;
}

async function readPinHash(familyId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('settings')
    .select('value')
    .eq('family_id', familyId)
    .eq('key', 'parent_pin_hash')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return typeof data.value === 'string' ? data.value : String(data.value);
}

/** Whether this family has chosen a PIN yet. Drives the "create a PIN" screen. */
export async function familyHasPin(): Promise<boolean> {
  const { familyId } = await requireFamilyOrThrow();
  return (await readPinHash(familyId)) !== null;
}

export async function verifyPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireFamilyOrThrow();
  const state = attemptsFor(familyId);

  if (Date.now() < state.lockedUntil) {
    const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    return { ok: false, error: `Too many tries. Wait ${seconds} seconds.` };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: 'The PIN is four digits.' };
  }

  const hash = await readPinHash(familyId);
  if (!hash) return { ok: false, error: 'No PIN is set for this family yet.' };

  if (!bcrypt.compareSync(pin, hash)) {
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCKOUT_MS;
      state.count = 0;
      return { ok: false, error: 'Too many tries. Wait a minute.' };
    }
    return { ok: false, error: 'That PIN is not right.' };
  }

  state.count = 0;
  await openParentSession(familyId);
  revalidatePath('/parent');
  return { ok: true };
}

/**
 * The first PIN a new family sets. Deliberately refuses once one exists: without
 * that check, anyone who reached this action could overwrite the PIN they do not
 * know. Changing an existing PIN goes through changePin, which asks for the old
 * one.
 */
export async function setInitialPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  const { familyId } = await requireFamilyOrThrow();

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, error: 'The PIN must be four digits.' };
  }

  if (await readPinHash(familyId)) {
    return { ok: false, error: 'This family already has a PIN. Enter it to unlock.' };
  }

  const db = createServiceClient();
  const { error } = await db
    .from('settings')
    .insert({ family_id: familyId, key: 'parent_pin_hash', value: bcrypt.hashSync(pin, 10) });

  // A second tab that set the PIN a moment ago trips the primary key. Not an
  // error worth showing - the family has a PIN either way.
  if (error && !error.message.includes('duplicate key')) {
    return { ok: false, error: error.message };
  }
  if (error) return { ok: false, error: 'This family already has a PIN. Enter it to unlock.' };

  await openParentSession(familyId);
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
  const { familyId } = await requireParentZone();

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
    .upsert(
      { family_id: familyId, key: 'parent_pin_hash', value: bcrypt.hashSync(next, 10) },
      { onConflict: 'family_id,key' },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
