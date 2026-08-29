'use client';

import { useTransition } from 'react';
import { signOut } from '@/app/actions/auth';

/**
 * Signs the whole family out of this device.
 *
 * On a kitchen tablet this is close to a factory reset - it takes the board away
 * from everyone in the house until a parent signs in again - so it asks first.
 */
export default function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Sign this device out? The board will be hidden until you sign in again.')) {
          return;
        }
        startTransition(async () => {
          await signOut();
        });
      }}
      className="h-16 rounded-2xl bg-surface px-6 text-lg font-bold text-muted shadow-sm ring-1 ring-black/10 active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
