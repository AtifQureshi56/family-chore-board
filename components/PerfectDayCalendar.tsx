import { addDays } from '@/lib/dates';

/**
 * One month, with perfect days marked in the child's colour.
 *
 * Deliberately binary, not a heat ramp: a day either was perfect or it wasn't, and
 * a ramp would invent a magnitude the data does not have. Days that have not
 * happened yet are blank rather than styled as misses - the board rewards, it does
 * not scold.
 */
type Props = {
  year: number;
  month: number;
  perfectDays: string[];
  color: string;
  today: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function PerfectDayCalendar({ year, month, perfectDays, color, today }: Props) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // getUTCDay: 0 = Sunday. Shift so Monday starts the week.
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const perfect = new Set(perfectDays);

  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 0; d < daysInMonth; d += 1) cells.push(addDays(first, d));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="text-center text-xs font-bold uppercase text-muted"
          >
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;

          const dayNumber = Number(date.slice(8, 10));
          const isPerfect = perfect.has(date);
          const isFuture = date > today;
          const isToday = date === today;

          return (
            <span
              key={date}
              title={isPerfect ? `${date} — perfect day` : date}
              className={`grid aspect-square place-items-center rounded-lg text-sm font-bold tabular-nums ${
                isFuture ? 'text-black/20' : isPerfect ? 'text-white' : 'text-muted'
              }`}
              style={{
                backgroundColor: isPerfect ? color : isFuture ? 'transparent' : 'rgba(0,0,0,0.04)',
                boxShadow: isToday ? 'inset 0 0 0 2px rgba(0,0,0,0.35)' : undefined,
              }}
            >
              {isPerfect ? '★' : dayNumber}
            </span>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-muted">
        <span aria-hidden="true">★</span> = every chore done that day
      </p>
    </div>
  );
}
