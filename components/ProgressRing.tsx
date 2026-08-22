/**
 * Progress shown as a filling ring, never a percentage (spec section 7).
 * The ring is filled with the child's own colour.
 */
type Props = {
  completed: number;
  total: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
};

export default function ProgressRing({
  completed,
  total,
  color,
  size = 160,
  stroke = 14,
  children,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total === 0 ? 0 : Math.min(completed / total, 1);
  const offset = circumference * (1 - fraction);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--waiting)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 450ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
