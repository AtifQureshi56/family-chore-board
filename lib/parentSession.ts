import 'server-only';
import { cookies } from 'next/headers';

/**
 * The parent zone unlock, held in an httpOnly cookie.
 *
 * The cookie only ever holds an opaque marker plus an expiry - never the PIN and
 * never its hash. Every privileged server action re-checks this on the server;
 * hiding the UI is not a security boundary.
 */
export const PARENT_COOKIE = 'parent_unlocked';

/** How long an unlock lasts. Long enough to finish a job, short enough to matter. */
const UNLOCK_MINUTES = 30;

export async function isParentUnlocked(): Promise<boolean> {
  const store = await cookies();
  const raw = store.get(PARENT_COOKIE)?.value;
  if (!raw) return false;

  const expiresAt = Number(raw);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export async function openParentSession(): Promise<void> {
  const store = await cookies();
  store.set(PARENT_COOKIE, String(Date.now() + UNLOCK_MINUTES * 60_000), {
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

/** Throws unless the parent zone is currently unlocked. Call at the top of every write. */
export async function requireParent(): Promise<void> {
  if (!(await isParentUnlocked())) {
    throw new Error('The parent zone is locked. Enter the PIN again.');
  }
}
