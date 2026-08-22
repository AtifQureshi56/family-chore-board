'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveChild, removeChild, restoreChild, saveChild } from '@/app/actions/manageChildren';
import type { Child } from '@/lib/types';

const COLORS = [
  '#EC4899', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16',
];

const AVATARS = ['🦋', '🚀', '🦁', '🐬', '🌸', '⚽', '🦄', '🐼', '🎨', '🦖', '🐧', '🌟'];

export default function ChildForm({ kids }: { kids: Child[] }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'That did not save.');
      else router.refresh();
    });
  };

  const add = () =>
    run(async () => {
      const result = await saveChild({ name, color, avatar });
      if (result.ok) setName('');
      return result;
    });

  const field = 'w-full rounded-2xl bg-surface px-4 text-lg font-semibold shadow-sm ring-1 ring-black/10';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {kids.map((child, i) => (
          <div
            key={child.id}
            className={`flex items-center gap-3 rounded-2xl p-3 shadow-sm ring-1 ring-black/5 ${
              child.is_active ? 'bg-surface' : 'bg-black/[0.03] opacity-70'
            }`}
            style={{ minHeight: 64 }}
          >
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl"
              style={{ backgroundColor: `${child.color}22` }}
              aria-hidden="true"
            >
              {child.avatar}
            </span>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-bold" style={{ color: child.color }}>
                {child.name}
              </span>
              {!child.is_active && (
                <span className="text-sm font-semibold text-muted">
                  Removed — history kept
                </span>
              )}
            </div>

            {child.is_active ? (
              <>
                <button
                  type="button"
                  onClick={() => run(() => moveChild(child.id, 'up'))}
                  disabled={pending || i === 0}
                  aria-label={`Move ${child.name} up`}
                  className="grid h-12 w-12 place-items-center rounded-xl bg-black/[0.04] text-lg active:scale-95 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => run(() => moveChild(child.id, 'down'))}
                  disabled={pending}
                  aria-label={`Move ${child.name} down`}
                  className="grid h-12 w-12 place-items-center rounded-xl bg-black/[0.04] text-lg active:scale-95 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => run(() => removeChild(child.id))}
                  disabled={pending}
                  className="grid h-12 place-items-center rounded-xl bg-black/[0.04] px-4 font-bold text-muted active:scale-95 disabled:opacity-40"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => run(() => restoreChild(child.id))}
                disabled={pending}
                className="grid h-12 place-items-center rounded-xl bg-black/[0.04] px-4 font-bold active:scale-95 disabled:opacity-40"
              >
                Bring back
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-black/[0.03] p-4">
        <h3 className="text-lg font-black">Add a child</h3>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          maxLength={24}
          className={field}
          style={{ height: 64 }}
        />

        <div className="flex flex-col gap-2">
          <span className="font-bold">Their colour</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Use ${c}`}
                aria-pressed={color === c}
                className={`h-14 w-14 rounded-xl shadow-sm transition ${
                  color === c ? 'ring-4 ring-black/40' : 'ring-1 ring-black/10'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-bold">Their avatar</span>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                aria-label={`Use ${a}`}
                aria-pressed={avatar === a}
                className={`grid h-14 w-14 place-items-center rounded-xl text-2xl shadow-sm transition ${
                  avatar === a ? 'bg-white ring-2 ring-black/40' : 'bg-surface ring-1 ring-black/10'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={add}
          disabled={pending || !name.trim()}
          className="rounded-2xl bg-foreground px-6 text-xl font-black text-white active:scale-[0.98] disabled:opacity-40"
          style={{ height: 64 }}
        >
          {pending ? 'Saving…' : 'Add child'}
        </button>
      </div>
    </div>
  );
}
