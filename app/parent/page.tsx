import Link from 'next/link';
import ChildForm from '@/components/ChildForm';
import DayCorrector from '@/components/DayCorrector';
import ExtraChoreForm from '@/components/ExtraChoreForm';
import ExtraChoreList from '@/components/ExtraChoreList';
import ParentTabs from '@/components/ParentTabs';
import PinGate from '@/components/PinGate';
import SignOutButton from '@/components/SignOutButton';
import TaskForm from '@/components/TaskForm';
import LockButton from '@/components/LockButton';
import { isParentUnlocked } from '@/lib/parentSession';
import { requireFamily } from '@/lib/session';
import { getAllChildren, getExtraChores, getSharedTasks, hasParentPin } from '@/lib/queries';
import { todayInKarachi } from '@/lib/dates';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ParentPage() {
  // Two gates, in order. Signing in decides *whose* board this is; the PIN
  // decides whether the person holding the tablet may edit it. Hiding the UI is
  // not security - every action underneath re-checks both independently.
  const { familyId, email } = await requireFamily();

  if (!(await isParentUnlocked(familyId))) {
    return <PinGate mode={(await hasParentPin(familyId)) ? 'enter' : 'create'} />;
  }

  const today = todayInKarachi();
  const [allChildren, sharedTasks] = await Promise.all([
    getAllChildren(familyId),
    getSharedTasks(familyId),
  ]);
  const activeChildren = allChildren.filter((c) => c.is_active);

  const extrasByChild: Record<string, Task[]> = {};
  await Promise.all(
    activeChildren.map(async (child) => {
      extrasByChild[child.id] = await getExtraChores(familyId, child.id, today);
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
          {
            id: 'account',
            label: 'Account',
            icon: '👤',
            content: (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-black/5">
                  <h2 className="text-xl font-black">This family&apos;s account</h2>
                  <p className="font-semibold text-muted">{email ?? 'Signed in with Google'}</p>
                  <p className="text-sm font-semibold text-muted">
                    Your children, their chores and their stars belong to this account. No other
                    family can see them, and you cannot see theirs.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <h2 className="text-xl font-black">Sign out</h2>
                  <p className="font-semibold text-muted">
                    Only do this if the tablet is leaving the house. Signing back in brings the
                    whole board back exactly as it was.
                  </p>
                  <SignOutButton />
                </div>
              </div>
            ),
          },
        ]}
      />
    </main>
  );
}
