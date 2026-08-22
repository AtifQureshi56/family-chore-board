'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveTask, removeTask, saveTask } from '@/app/actions/manageTasks';
import { EMOJI_CHOICES } from '@/lib/choreLibrary';
import { SLOTS, SLOT_META, type Slot, type Task } from '@/lib/types';

/** Add, edit, reorder and remove chores on the SHARED list every child sees. */
export default function TaskForm({ tasks }: { tasks: Task[] }) {
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [slot, setSlot] = useState<Slot>('morning');
  const [points, setPoints] = useState(5);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const reset = () => {
    setEditingId(null);
    setTitle('');
    setIcon('⭐');
    setPoints(5);
  };

  const save = () =>
    run(async () => {
      const result = await saveTask({ id: editingId ?? undefined, title, icon, slot, points });
      if (result.ok) reset();
      return result;
    });

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setIcon(task.icon);
    setSlot(task.slot);
    setPoints(task.points);
  };

  const field = 'w-full rounded-2xl bg-surface px-4 text-lg font-semibold shadow-sm ring-1 ring-black/10';

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        These chores appear for every child. To give one child something extra, use the
        Extra chores tab.
      </p>

      {SLOTS.map((s) => {
        const inSlot = tasks.filter((t) => t.slot === s);
        if (inSlot.length === 0) return null;

        return (
          <div key={s} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 font-black uppercase tracking-wide text-muted">
              <span aria-hidden="true">{SLOT_META[s].icon}</span>
              {SLOT_META[s].label}
            </h3>

            {inSlot.map((task, i) => (
              <div
                key={task.id}
                className="flex items-center gap-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-black/5"
                style={{ minHeight: 64 }}
              >
                <span className="text-2xl" aria-hidden="true">
                  {task.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{task.title}</span>
                  <span className="text-sm font-semibold text-muted">+{task.points}</span>
                </div>

                <button
                  type="button"
                  onClick={() => run(() => moveTask(task.id, 'up'))}
                  disabled={pending || i === 0}
                  aria-label={`Move ${task.title} up`}
                  className="grid h-12 w-11 place-items-center rounded-xl bg-black/[0.04] active:scale-95 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => run(() => moveTask(task.id, 'down'))}
                  disabled={pending || i === inSlot.length - 1}
                  aria-label={`Move ${task.title} down`}
                  className="grid h-12 w-11 place-items-center rounded-xl bg-black/[0.04] active:scale-95 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(task)}
                  disabled={pending}
                  className="grid h-12 place-items-center rounded-xl bg-black/[0.04] px-3 font-bold active:scale-95 disabled:opacity-40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => run(() => removeTask(task.id))}
                  disabled={pending}
                  className="grid h-12 place-items-center rounded-xl bg-black/[0.04] px-3 font-bold text-muted active:scale-95 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        );
      })}

      <div className="flex flex-col gap-4 rounded-2xl bg-black/[0.03] p-4">
        <h3 className="text-lg font-black">
          {editingId ? 'Edit chore' : 'Add a chore for everyone'}
        </h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Brush your teeth"
          maxLength={60}
          className={field}
          style={{ height: 64 }}
        />

        <label className="flex flex-col gap-2">
          <span className="font-bold">Time of day</span>
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as Slot)}
            className={field}
            style={{ height: 64 }}
          >
            {SLOTS.map((s) => (
              <option key={s} value={s}>
                {SLOT_META[s].icon} {SLOT_META[s].label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-bold">Icon</span>
          <div className="flex flex-wrap gap-2">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                aria-label={`Use ${e}`}
                aria-pressed={icon === e}
                className={`grid h-14 w-14 place-items-center rounded-xl text-2xl shadow-sm transition ${
                  icon === e ? 'bg-white ring-2 ring-black/40' : 'bg-surface ring-1 ring-black/10'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="font-bold">Points</span>
          <input
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className={field}
            style={{ height: 64 }}
          />
        </label>

        {editingId && (
          <p className="text-sm font-semibold text-muted">
            Changing the points here will not rewrite any stars already earned.
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={save}
            disabled={pending || !title.trim()}
            className="flex-1 rounded-2xl bg-foreground px-6 text-xl font-black text-white active:scale-[0.98] disabled:opacity-40"
            style={{ height: 64 }}
          >
            {pending ? 'Saving…' : editingId ? 'Save changes' : 'Add chore'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-2xl bg-surface px-6 text-lg font-bold text-muted ring-1 ring-black/10"
              style={{ height: 64 }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
