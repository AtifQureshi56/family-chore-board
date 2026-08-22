'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { lockParentZone } from '@/app/actions/verifyPin';

/** Locks the parent zone again without waiting for the session to expire. */
export default function LockButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await lockParentZone();
          router.refresh();
        })
      }
      className="grid shrink-0 place-items-center rounded-2xl bg-surface px-5 font-bold text-muted shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50"
      style={{ height: 64 }}
    >
      🔒 Lock
    </button>
  );
}
