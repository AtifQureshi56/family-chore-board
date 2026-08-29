import Link from 'next/link';
import ChildCard from '@/components/ChildCard';
import { getActiveChildren, getDayTotals } from '@/lib/queries';
import { requireFamily } from '@/lib/session';
import { formatLongDate, todayInKarachi } from '@/lib/dates';

// Every visit must reflect the live board; nothing here may be cached.
export const dynamic = 'force-dynamic';

export default async function PickerPage() {
  const { familyId } = await requireFamily();
  const today = todayInKarachi();
  const [children, totals] = await Promise.all([
    getActiveChildren(familyId),
    getDayTotals(familyId, today),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 p-6">
      <header className="flex flex-col items-center gap-1 pt-6 text-center">
        <h1 className="text-4xl font-black tracking-tight">Who&apos;s here?</h1>
        <p className="text-lg font-semibold text-muted">{formatLongDate(today)}</p>
      </header>

      {children.length === 0 ? (
        <div className="rounded-3xl bg-surface p-10 text-center shadow-sm ring-1 ring-black/5">
          <p className="text-2xl font-bold">No children yet</p>
          <p className="mt-2 text-muted">Add the first one in the parent zone.</p>
          <Link
            href="/parent"
            className="mt-6 inline-grid h-16 place-items-center rounded-2xl bg-surface px-6 text-lg font-bold shadow-sm ring-1 ring-black/10 active:scale-[0.98]"
          >
            🔒 Open the parent zone
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <ChildCard key={child.id} child={child} today={totals[child.id]} />
          ))}
        </div>
      )}

      <nav className="mt-auto flex justify-center gap-4 pb-4">
        <Link
          href="/scoreboard"
          className="grid h-16 place-items-center rounded-2xl bg-surface px-6 text-lg font-bold shadow-sm ring-1 ring-black/5 active:scale-[0.98]"
        >
          🏆 Scoreboard
        </Link>
        <Link
          href="/parent"
          className="grid h-16 place-items-center rounded-2xl bg-surface px-6 text-lg font-bold text-muted shadow-sm ring-1 ring-black/5 active:scale-[0.98]"
        >
          🔒 Parents
        </Link>
      </nav>
    </main>
  );
}
