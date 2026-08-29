import 'server-only';
import { cookies } from 'next/headers';
import { requireFamilyOrThrow, type FamilySession } from './session';

/**
 * The parent zone unlock, held in an httpOnly cookie.
 *
 * This sits on top of the Google sign-in, and the two answer different questions.
 * The sign-in says which family's board this is; the PIN says whether the person
 * holding the tablet right now is the parent or the eight-year-old. A kitchen
 * tablet stays signed in for weeks, so the account alone cannot keep a child out
 * of the chore editor.
 *
 * The cookie holds the family id and an expiry - never the PIN and never its
 * hash. The family id is in there so an unlock does not survive switching
 * accounts on a shared device.
 */
export const PARENT_COOKIE = 'parent_unlocked';

/** How long an unlock lasts. Long enough to finish a job, short enough to matter. */
const UNLOCK_MINUTES = 30;

export async function isParentUnlocked(familyId: string): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(PARENT_COOKIE)?.value;
  if (!raw) return false;

  const separator = raw.lastIndexOf(':');
  if (separator === -1) return false;

  const unlockedFamily = raw.slice(0, separator);
  const expiresAt = Number(raw.slice(separator + 1));

  return (
    unlockedFamily === familyId && Number.isFinite(expiresAt) && expiresAt > Date.now()
  );
}

export async function openParentSession(familyId: string): Promise<void> {
  const store = await cookies();
  store.set(PARENT_COOKIE, `${familyId}:${Date.now() + UNLOCK_MINUTES * 60_000}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UNLOCK_MINUTES * 60,
  });
}

export async function closeParentSession(): Promise<void> {
  const store = await cookies();
  store.delete(PARENT_COOKIE);
}

/**
 * The guard at the top of every privileged write. Returns the family so callers
 * cannot forget to scope their query - getting the permission and getting the
 * family id are deliberately the same call.
 */
export async function requireParentZone(): Promise<FamilySession> {
  const session = await requireFamilyOrThrow();
  if (!(await isParentUnlocked(session.familyId))) {
    throw new Error('The parent zone is locked. Enter the PIN again.');
  }
  return session;
}
