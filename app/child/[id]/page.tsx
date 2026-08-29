import Link from 'next/link';
import { notFound } from 'next/navigation';
import BadgeShelf from '@/components/BadgeShelf';
import DayBoard from '@/components/DayBoard';
import { getDayForChild, getMonthTotals, getPerfectDayStreak } from '@/lib/queries';
import { requireFamily } from '@/lib/session';
import { currentMonthInKarachi, formatLongDate, todayInKarachi } from '@/lib/dates';
import { earnedBadges, nextGoal } from '@/lib/badges';

export const dynamic = 'force-dynamic';

export default async function ChildDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A child id belonging to another family falls through to notFound() below:
  // every query here is scoped to this family, so getDayForChild returns null.
  const { familyId } = await requireFamily();
  const today = todayInKarachi();
  const { year, month } = currentMonthInKarachi();

  const [day, streak, monthTotals] = await Promise.all([
    getDayForChild(familyId, id, today),
    getPerfectDayStreak(familyId, id, today),
    getMonthTotals(familyId, year, month),
  ]);

  if (!day) notFound();

  const { child } = day;
  const badgeInput = {
    streak,
    monthPoints: monthTotals[id]?.points ?? 0,
    monthPerfectDays: monthTotals[id]?.perfectDays ?? 0,
  };

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-5"
      style={{ ['--child-color' as string]: child.color }}
    >
      <header className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Back to everyone"
          className="grid shrink-0 place-items-center rounded-2xl bg-surface text-2xl shadow-sm ring-1 ring-black/5 active:scale-95"
          style={{ width: 64, height: 64 }}
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="flex items-center gap-2 truncate text-3xl font-black">
            <span aria-hidden="true">{child.avatar}</span>
            {child.name}
          </h1>
          <p className="text-sm font-semibold text-muted">{formatLongDate(day.date)}</p>
        </div>
      </header>

      <DayBoard day={day} />

      <BadgeShelf
        badges={earnedBadges(badgeInput)}
        next={nextGoal(badgeInput)}
        color={child.color}
        compact
      />
    </main>
  );
}
