import type { Child } from '@/lib/types';

/**
 * Month totals, one horizontal bar per child.
 *
 * Colour choices are NOT free here: each child owns a colour (spec section 7) and
 * that ownership is a large part of the motivation, so the bar wears the child's
 * colour rather than a palette slot. Colour therefore follows the entity, never
 * its rank - filtering or reordering never repaints anyone.
 *
 * Four of the eight selectable child colours sit below 3:1 contrast against the
 * surface, so identity is never left to colour alone: every bar carries its
 * avatar, name and value as text, and the table underneath repeats the numbers.
 *
 * Horizontal because names are long and the count is small.
 */
type Row = { child: Child; points: number; perfectDays: number };

export default function MonthChart({ rows }: { rows: Row[] }) {
  const max = Math.max(...rows.map((r) => r.points), 1);
  const leader = Math.max(...rows.map((r) => r.points));

  if (rows.length === 0) {
    return <p className="font-semibold text-muted">No children on the board yet.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {rows.map(({ child, points }) => {
        const pct = (points / max) * 100;
        const isLeader = points === leader && points > 0;

        return (
          <div key={child.id} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl" aria-hidden="true">
                {child.avatar}
              </span>
              <span className="font-bold">{child.name}</span>
              <span className="ml-auto text-lg font-black tabular-nums">
                {points.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-muted">stars</span>
            </div>

            {/* 20px bar, rounded only at the data end, square at the baseline. */}
            <div className="h-5 w-full overflow-hidden rounded-l-sm bg-black/[0.06]">
              <div
                className="h-full rounded-r"
                style={{
                  width: `${Math.max(pct, points > 0 ? 2 : 0)}%`,
                  backgroundColor: child.color,
                  transition: 'width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>

            {isLeader && rows.length > 1 && (
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                Most stars this month
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
