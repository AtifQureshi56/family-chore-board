'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setInitialPin, verifyPin } from '@/app/actions/verifyPin';

type Mode = 'enter' | 'create';

/**
 * Four-digit numeric entry. Big keys - a parent uses this one-handed.
 *
 * In `create` mode the family has signed in but has not chosen a PIN yet, so the
 * same keypad collects it twice and sets it. Before families existed the PIN was
 * planted by `npm run seed`; a parent arriving from Google has never run that,
 * and a locked parent zone with no way in would be the end of the sign-up.
 */
export default function PinGate({ mode = 'enter' }: { mode?: Mode }) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const confirming = mode === 'create' && first !== null;

  const submit = (value: string) => {
    startTransition(async () => {
      if (mode === 'create') {
        if (first === null) {
          // First of two entries: remember it and ask again rather than setting a
          // PIN the parent may have mistyped and can never guess back.
          setFirst(value);
          setPin('');
          return;
        }
        if (value !== first) {
          setError('Those two PINs did not match. Start again.');
          setFirst(null);
          setPin('');
          return;
        }

        const result = await setInitialPin(value);
        if (result.ok) {
          router.refresh();
        } else {
          setError(result.error ?? 'Could not set that PIN.');
          setFirst(null);
          setPin('');
        }
        return;
      }

      const result = await verifyPin(value);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? 'That PIN is not right.');
        setPin('');
      }
    });
  };

  const press = (digit: string) => {
    if (pending) return;
    setError(null);
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  const heading =
    mode === 'create'
      ? confirming
        ? 'Type it once more'
        : 'Choose a parent PIN'
      : 'Parents only';

  const subheading =
    mode === 'create'
      ? confirming
        ? 'Just to be sure you will remember it'
        : 'Four digits. It keeps the children out of the chore editor on a shared tablet.'
      : 'Enter the 4-digit PIN';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-6xl" aria-hidden="true">
          {mode === 'create' ? '🔑' : '🔒'}
        </span>
        <h1 className="text-3xl font-black">{heading}</h1>
        <p className="font-semibold text-muted">{subheading}</p>
      </header>

      <div className="flex gap-3" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="grid h-16 w-14 place-items-center rounded-2xl bg-surface text-3xl font-black shadow-sm ring-1 ring-black/5"
          >
            {pin[i] ? '•' : ''}
          </span>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-lg font-bold text-amber-700">
          {error}
        </p>
      )}

      <div className="grid w-full grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={pending}
            className="h-20 rounded-2xl bg-surface text-3xl font-black shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPin('');
            setError(null);
          }}
          disabled={pending}
          className="h-20 rounded-2xl bg-surface text-lg font-bold text-muted shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => press('0')}
          disabled={pending}
          className="h-20 rounded-2xl bg-surface text-3xl font-black shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          disabled={pending}
          className="h-20 rounded-2xl bg-surface text-2xl shadow-sm ring-1 ring-black/5 active:scale-95 disabled:opacity-50"
          aria-label="Delete last digit"
        >
          ⌫
        </button>
      </div>

      <Link href="/" className="text-lg font-bold text-muted underline-offset-4 hover:underline">
        ← Back to the board
      </Link>
    </main>
  );
}
