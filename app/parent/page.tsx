import Link from 'next/link';
import ChildForm from '@/components/ChildForm';
import DayCorrector from '@/components/DayCorrector';
import ExtraChoreForm from '@/components/ExtraChoreForm';
import ExtraChoreList from '@/components/ExtraChoreList';
import ParentTabs from '@/components/ParentTabs';
import PinGate from '@/components/PinGate';
import TaskForm from '@/components/TaskForm';
import LockButton from '@/components/LockButton';
import { isParentUnlocked } from '@/lib/parentSession';
import { getAllChildren, getExtraChores, getSharedTasks } from '@/lib/queries';
import { todayInKarachi } from '@/lib/dates';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ParentPage() {
  // The gate is the cookie, checked on the server. Hiding the UI is not security -
  // every action underneath re-checks this independently.
  if (!(await isParentUnlocked())) {
    return <PinGate />;
  }

  const today = todayInKarachi();
  const [allChildren, sharedTasks] = await Promise.all([getAllChildren(), getSharedTasks()]);
  const activeChildren = allChildren.filter((c) => c.is_active);

  const extrasByChild: Record<string, Task[]> = {};
  await Promise.all(
    activeChildren.map(async (child) => {
      extrasByChild[child.id] = await getExtraChores(child.id, today);
    }),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 p-5">
      <header className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Back to the board"
          className="grid shrink-0 place-items-center rounded-2xl bg-surface text-2xl shadow-sm ring-1 ring-black/5 active:scale-95"
          style={{ width: 64, height: 64 }}
        >
          ←
        </Link>
        <h1 className="flex-1 text-3xl font-black">Parent zone</h1>
        <LockButton />
      </header>

      <ParentTabs
        tabs={[
          {
            id: 'extras',
            label: 'Extra chores',
            icon: '➕',
            content: (
              <div className="flex flex-col gap-8">
                <ExtraChoreForm kids={activeChildren} existingByChild={extrasByChild} />
                <div className="flex flex-col gap-4 border-t border-black/10 pt-6">
                  <h2 className="text-xl font-black">Extra chores right now</h2>
                  <ExtraChoreList
                    kids={activeChildren}
                    extrasByChild={extrasByChild}
                    today={today}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'tasks',
            label: 'Chore list',
            icon: '📋',
            content: <TaskForm tasks={sharedTasks} />,
          },
          {
            id: 'children',
            label: 'Children',
            icon: '🧒',
            content: <ChildForm kids={allChildren} />,
          },
          {
            id: 'fix',
            label: 'Fix a day',
            icon: '🗓️',
            content: <DayCorrector kids={activeChildren} today={today} />,
          },
        ]}
      />
    </main>
  );
}
