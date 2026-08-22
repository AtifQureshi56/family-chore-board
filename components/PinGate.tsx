'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { verifyPin } from '@/app/actions/verifyPin';

/** Four-digit numeric entry. Big keys - a parent uses this one-handed. */
export default function PinGate() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = (value: string) => {
    startTransition(async () => {
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-6xl" aria-hidden="true">
          🔒
        </span>
        <h1 className="text-3xl font-black">Parents only</h1>
        <p className="font-semibold text-muted">Enter the 4-digit PIN</p>
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
