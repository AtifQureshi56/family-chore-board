import Link from 'next/link';
import type { Child, DayTotal } from '@/lib/types';

/**
 * Big coloured tile in the picker: avatar, name, and today's stars.
 * The whole tile is the tap target - a child aiming at a small link will miss.
 */
type Props = {
  child: Child;
  today?: DayTotal;
};

export default function ChildCard({ child, today }: Props) {
  const points = today?.points ?? 0;
  const done = today?.completedCount ?? 0;
  const total = today?.taskCount ?? 0;
  const isPerfect = total > 0 && done === total;

  return (
    <Link
      href={`/child/${child.id}`}
      className="group flex flex-col items-center justify-center gap-3 rounded-[2rem] p-8 text-white shadow-lg transition-transform active:scale-[0.97]"
      style={{ backgroundColor: child.color, minHeight: 260 }}
    >
      <span className="text-7xl leading-none drop-shadow-sm" aria-hidden="true">
        {child.avatar}
      </span>

      <span className="text-3xl font-extrabold tracking-tight">{child.name}</span>

      <span className="flex items-center gap-2 rounded-full bg-black/20 px-4 py-2 text-xl font-bold">
        <span aria-hidden="true">⭐</span>
        {points}
      </span>

      <span className="text-base font-semibold text-white/85">
        {isPerfect ? '🎉 All done!' : total === 0 ? 'No chores yet' : `${done} of ${total} done`}
      </span>
    </Link>
  );
}
