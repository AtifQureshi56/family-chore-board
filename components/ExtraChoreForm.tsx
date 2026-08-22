'use client';

import { useMemo, useState, useTransition } from 'react';
import { addExtraChore } from '@/app/actions/manageExtraChores';
import { CHORE_LIBRARY, EMOJI_CHOICES } from '@/lib/choreLibrary';
import { SLOTS, SLOT_META, type Child, type Slot, type Task } from '@/lib/types';

const CUSTOM = '__custom__';

/**
 * Add one extra chore to one child's list.
 *
 * The shared default list is untouched by this - a child with no extras simply
 * runs the default list. The dropdown is filtered by the chosen slot, and any
 * chore the child already has is filtered out so it can never be offered twice.
 */
type Props = {
  kids: Child[];
  /** Already-assigned extras, keyed by child id, so we can hide duplicates. */
  existingByChild: Record<string, Task[]>;
};

export default function ExtraChoreForm({ kids, existingByChild }: Props) {
  const [childId, setChildId] = useState(kids[0]?.id ?? '');
  const [slot, setSlot] = useState<Slot>('morning');
  const [choice, setChoice] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [points, setPoints] = useState(5);
  const [todayOnly, setTodayOnly] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCustom = choice === CUSTOM;
  const selectedChild = kids.find((c) => c.id === childId);

  // Only offer chores this child does not already have in this slot.
  const options = useMemo(() => {
    const taken = new Set(
      (existingByChild[childId] ?? [])
        .filter((t) => t.slot === slot)
        .map((t) => t.title.toLowerCase()),
    );
    return CHORE_LIBRARY[slot].filter((preset) => !taken.has(preset.title.toLowerCase()));
  }, [childId, slot, existingByChild]);

  const pickPreset = (title: string) => {
    setChoice(title);
    setError(null);
    setDone(null);
    const preset = CHORE_LIBRARY[slot].find((p) => p.title === title);
    if (preset) {
      setIcon(preset.icon);
      setPoints(preset.points);
    }
  };

  const changeSlot = (next: Slot) => {
    setSlot(next);
    // The old choice belongs to the old slot's list.
    setChoice('');
    setCustomTitle('');
    setDone(null);
  };

  const title = isCustom ? customTitle : choice;
  const canSubmit = Boolean(childId) && Boolean(title.trim()) && !pending;

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    setDone(null);

    startTransition(async () => {
      const result = await addExtraChore({
        childId,
        slot,
        title: title.trim(),
        icon,
        points,
        todayOnly,
      });

      if (result.ok) {
        setDone(
          `Added "${title.trim()}" to ${selectedChild?.name ?? 'their list'} — ${
            todayOnly ? 'today only' : 'every day'
          }.`,
        );
        setChoice('');
        setCustomTitle('');
        setIcon('⭐');
        setPoints(5);
      } else {
        setError(result.error ?? 'That did not save.');
      }
    });
  };

  if (kids.length === 0) {
    return <p className="font-semibold text-muted">Add a child first.</p>;
  }

  const field = 'w-full rounded-2xl bg-surface px-4 text-lg font-semibold shadow-sm ring-1 ring-black/10 focus:outline-none focus:ring-2';

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted">
        Adds one extra chore to a single child&apos;s list. Everyone else keeps the normal
        chore list exactly as it is.
      </p>

      <label className="flex flex-col gap-2">
        <span className="font-bold">Add an extra chore for</span>
        <select
          value={childId}
          onChange={(e) => {
            setChildId(e.target.value);
            setDone(null);
          }}
          className={field}
          style={{ height: 64 }}
        >
          {kids.map((c) => (
            <option key={c.id} value={c.id}>
              {c.avatar} {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-bold">Time of day</span>
        <select
          value={slot}
          onChange={(e) => changeSlot(e.target.value as Slot)}
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

      <label className="flex flex-col gap-2">
        <span className="font-bold">Chore</span>
        <select
          value={choice}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              setChoice(CUSTOM);
              setIcon('⭐');
              setPoints(5);
            } else {
              pickPreset(e.target.value);
            }
          }}
          className={field}
          style={{ height: 64 }}
        >
          <option value="">Choose a chore…</option>
          {options.map((preset) => (
            <option key={preset.title} value={preset.title}>
              {preset.icon} {preset.title}
            </option>
          ))}
          <option value={CUSTOM}>✏️ Custom…</option>
        </select>
        {options.length === 0 && !isCustom && (
          <span className="text-sm font-semibold text-muted">
            {selectedChild?.name} already has every suggested {SLOT_META[slot].label.toLowerCase()}{' '}
            chore. Use Custom… to add your own.
          </span>
        )}
      </label>

      {isCustom && (
        <div className="flex flex-col gap-4 rounded-2xl bg-black/[0.03] p-4">
          <label className="flex flex-col gap-2">
            <span className="font-bold">What is the chore?</span>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Help wash the car"
              maxLength={60}
              className={field}
              style={{ height: 64 }}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-bold">Pick an icon</span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  aria-label={`Use ${e}`}
                  aria-pressed={icon === e}
                  className={`grid h-14 w-14 place-items-center rounded-xl text-2xl shadow-sm ring-1 transition ${
                    icon === e ? 'bg-white ring-2 ring-black/40' : 'bg-surface ring-black/10'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">How long should it stay?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: true, label: 'Today only', hint: 'Disappears tomorrow by itself' },
            { value: false, label: 'Every day', hint: 'Stays until you remove it' },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => setTodayOnly(option.value)}
              aria-pressed={todayOnly === option.value}
              className={`flex flex-col items-start gap-1 rounded-2xl p-4 text-left shadow-sm ring-1 transition ${
                todayOnly === option.value
                  ? 'bg-white ring-2 ring-black/40'
                  : 'bg-surface ring-black/10'
              }`}
              style={{ minHeight: 64 }}
            >
              <span className="text-lg font-bold">{option.label}</span>
              <span className="text-sm font-semibold text-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 font-bold text-amber-900">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-900">
          {done}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="rounded-2xl bg-foreground px-6 text-xl font-black text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
        style={{ height: 64 }}
      >
        {pending ? 'Adding…' : 'Add chore'}
      </button>
    </div>
  );
}
