import Link from 'next/link';
import BadgeShelf from '@/components/BadgeShelf';
import MonthChart from '@/components/MonthChart';
import PerfectDayCalendar from '@/components/PerfectDayCalendar';
import {
  getActiveChildren,
  getMonthTotals,
  getPerfectDaysByChild,
  getStreaksByChild,
} from '@/lib/queries';
import { requireFamily } from '@/lib/session';
import { currentMonthInKarachi, formatMonth, monthRange, todayInKarachi } from '@/lib/dates';
import { earnedBadges, nextGoal } from '@/lib/badges';

export const dynamic = 'force-dynamic';

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { familyId } = await requireFamily();
  const params = await searchParams;
  const today = todayInKarachi();
  const currentMonth = currentMonthInKarachi();

  // Fall back to the current Karachi month for anything unparseable.
  const year = Number(params.y) || currentMonth.year;
  const month = Math.min(Math.max(Number(params.m) || currentMonth.month, 1), 12);

  const { start, end } = monthRange(year, month);

  const [children, totals, perfectByChild, streaks] = await Promise.all([
    getActiveChildren(familyId),
    getMonthTotals(familyId, year, month),
    getPerfectDaysByChild(familyId, start, end),
    getStreaksByChild(familyId, today),
  ]);

  const rows = children
    .map((child) => ({
      child,
      points: totals[child.id]?.points ?? 0,
      perfectDays: totals[child.id]?.perfectDays ?? 0,
      streak: streaks[child.id] ?? 0,
    }))
    .sort((a, b) => b.points - a.points);

  const isCurrentMonth = year === currentMonth.year && month === currentMonth.month;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const familyTotal = rows.reduce((sum, r) => sum + r.points, 0);

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
        <h1 className="flex-1 text-3xl font-black">Scoreboard</h1>
      </header>

      <nav className="flex items-center gap-3">
        <Link
          href={`/scoreboard?y=${prev.y}&m=${prev.m}`}
          aria-label="Previous month"
          className="grid place-items-center rounded-2xl bg-surface px-5 text-xl font-bold shadow-sm ring-1 ring-black/5 active:scale-95"
          style={{ height: 64 }}
        >
          ←
        </Link>

        <span className="flex-1 text-center text-xl font-black">{formatMonth(year, month)}</span>

        {isCurrentMonth ? (
          <span
            className="grid place-items-center rounded-2xl px-5 text-xl text-black/20"
            style={{ height: 64 }}
            aria-hidden="true"
          >
            →
          </span>
        ) : (
          <Link
            href={`/scoreboard?y=${next.y}&m=${next.m}`}
            aria-label="Next month"
            className="grid place-items-center rounded-2xl bg-surface px-5 text-xl font-bold shadow-sm ring-1 ring-black/5 active:scale-95"
            style={{ height: 64 }}
          >
            →
          </Link>
        )}
      </nav>

      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-5 text-xl font-black">Stars this month</h2>
        <MonthChart rows={rows} />
        {familyTotal > 0 && (
          <p className="mt-6 border-t border-black/10 pt-4 font-semibold text-muted">
            {familyTotal.toLocaleString()} stars earned by the whole family.
          </p>
        )}
      </section>

      {/* The table is the accessible companion to the chart: four of the eight
          child colours fall below 3:1 against the surface, so the numbers must be
          readable without relying on the bars at all. */}
      <section className="rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-xl font-black">Month at a glance</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-black/10 text-sm uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-bold">Child</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Stars</th>
                <th scope="col" className="py-2 pr-3 text-right font-bold">Perfect days</th>
                <th scope="col" className="py-2 text-right font-bold">Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ child, points, perfectDays, streak }) => (
                <tr key={child.id} className="border-b border-black/5 last:border-0">
                  <th scope="row" className="py-3 pr-3 font-bold">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: child.color }}
                      />
                      {child.avatar} {child.name}
                    </span>
                  </th>
                  <td className="py-3 pr-3 text-right font-bold tabular-nums">
                    {points.toLocaleString()}
                  </td>
                  <td className="py-3 pr-3 text-right font-semibold tabular-nums">{perfectDays}</td>
                  <td className="py-3 text-right font-semibold tabular-nums">
                    {streak > 0 ? `🔥 ${streak}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-black">Perfect days</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {rows.map(({ child, streak }) => (
            <div
              key={child.id}
              className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  {child.avatar}
                </span>
                <span className="font-black" style={{ color: child.color }}>
                  {child.name}
                </span>
                {streak > 0 && (
                  <span className="ml-auto rounded-full bg-black/[0.05] px-3 py-1 text-sm font-bold">
                    🔥 {streak} day{streak === 1 ? '' : 's'} in a row
                  </span>
                )}
              </div>

              <PerfectDayCalendar
                year={year}
                month={month}
                perfectDays={perfectByChild[child.id] ?? []}
                color={child.color}
                today={today}
              />

              <BadgeShelf
                badges={earnedBadges({
                  streak,
                  monthPoints: totals[child.id]?.points ?? 0,
                  monthPerfectDays: totals[child.id]?.perfectDays ?? 0,
                })}
                next={nextGoal({
                  streak,
                  monthPoints: totals[child.id]?.points ?? 0,
                  monthPerfectDays: totals[child.id]?.perfectDays ?? 0,
                })}
                color={child.color}
                compact
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
