'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeExtraChore } from '@/app/actions/manageExtraChores';
import { SLOT_META, type Child, type Task } from '@/lib/types';

/** The extra chores currently assigned to each child, each removable. */
type Props = {
  kids: Child[];
  extrasByChild: Record<string, Task[]>;
  today: string;
};

export default function ExtraChoreList({ kids, extrasByChild, today }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remove = (taskId: string) => {
    startTransition(async () => {
      await removeExtraChore(taskId);
      router.refresh();
    });
  };

  const anyExtras = kids.some((c) => (extrasByChild[c.id] ?? []).length > 0);

  if (!anyExtras) {
    return (
      <p className="rounded-2xl bg-black/[0.03] p-5 font-semibold text-muted">
        No extra chores right now. Everyone is on the normal chore list.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {kids.map((child) => {
        const extras = extrasByChild[child.id] ?? [];
        if (extras.length === 0) return null;

        return (
          <div key={child.id} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-lg font-black">
              <span aria-hidden="true">{child.avatar}</span>
              <span style={{ color: child.color }}>{child.name}</span>
            </h3>

            {extras.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-black/5"
                style={{ minHeight: 64 }}
              >
                <span className="text-3xl" aria-hidden="true">
                  {task.icon}
                </span>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{task.title}</span>
                  <span className="text-sm font-semibold text-muted">
                    {SLOT_META[task.slot].label} · +{task.points} ·{' '}
                    {task.on_date
                      ? task.on_date === today
                        ? 'today only'
                        : `just on ${task.on_date}`
                      : 'every day'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => remove(task.id)}
                  disabled={pending}
                  className="grid shrink-0 place-items-center rounded-xl bg-black/[0.04] px-4 font-bold text-muted active:scale-95 disabled:opacity-40"
                  style={{ height: 48 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
