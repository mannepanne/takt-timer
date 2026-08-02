// ABOUT: Presentational circular progress ring — decorative only, not informational.
// ABOUT: `progress` is 0–1; the ring has no notion of what a full revolution represents,
// ABOUT: that meaning belongs to whoever computes the prop (e.g. one hour per lap here).

type Props = {
  progress: number;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({ progress, size = 240, strokeWidth = 8 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <svg
      className="progress-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <circle
        className="progress-ring-track"
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        className="progress-ring-fill"
        cx={center}
        cy={center}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
}
