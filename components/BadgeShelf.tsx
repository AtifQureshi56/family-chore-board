import type { Badge } from '@/lib/badges';

/**
 * Earned badges, plus the next one within reach.
 *
 * A child with nothing yet still sees a goal rather than an empty shelf - the
 * board never shows an absence as a failure.
 */
type Props = {
  badges: Badge[];
  next: { icon: string; label: string; remaining: number; unit: string } | null;
  color: string;
  compact?: boolean;
};

export default function BadgeShelf({ badges, next, color, compact = false }: Props) {
  if (badges.length === 0 && !next) return null;

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-sm"
          style={{ backgroundColor: color, minHeight: compact ? 56 : 64 }}
        >
          <span className={compact ? 'text-2xl' : 'text-3xl'} aria-hidden="true">
            {badge.icon}
          </span>
          <span className="flex flex-col">
            <span className="font-black leading-tight">{badge.label}</span>
            {!compact && (
              <span className="text-sm font-semibold text-white/80">{badge.detail}</span>
            )}
          </span>
        </div>
      ))}

      {next && (
        <div
          className="flex items-center gap-3 rounded-2xl bg-black/[0.04] px-4 py-3"
          style={{ minHeight: compact ? 56 : 64 }}
        >
          <span
            className={`${compact ? 'text-2xl' : 'text-3xl'} opacity-40 grayscale`}
            aria-hidden="true"
          >
            {next.icon}
          </span>
          <span className="flex flex-col">
            <span className="font-black leading-tight text-muted">{next.label}</span>
            <span className="text-sm font-semibold text-muted">
              {next.remaining} {next.unit}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
