/**
 * Shared decorative overlays for dark brand panels (auth, about hero): sparse
 * contour lines and crosshair ticks. Purely atmospheric — never sourced from
 * real waterway geometry or actual coordinates.
 */

export function TopographicLines({ opacity = 0.08 }: { opacity?: number }) {
  return (
    <svg
      viewBox='0 0 500 500'
      className='absolute inset-0 size-full'
      style={{ opacity }}
      preserveAspectRatio='xMidYMid slice'
    >
      {[70, 155, 240, 325, 410].map((y, i) => (
        <path
          key={y}
          d={`M -20 ${y} C 100 ${y - 28}, 150 ${y + 28}, 250 ${y} S 400 ${y - 28}, 520 ${y}`}
          fill='none'
          stroke='#ffffff'
          strokeWidth={i === 2 ? 1.25 : 0.75}
        />
      ))}
    </svg>
  );
}

const DEFAULT_TICKS: [number, number][] = [
  [70, 95],
  [430, 130],
  [120, 400],
  [370, 345],
  [250, 55]
];

export function CoordinateTicks({
  ticks = DEFAULT_TICKS,
  opacity = 0.2
}: {
  ticks?: [number, number][];
  opacity?: number;
}) {
  return (
    <svg viewBox='0 0 500 500' className='absolute inset-0 size-full' style={{ opacity }}>
      {ticks.map(([x, y]) => (
        <g key={`${x}-${y}`} stroke='#ffffff' strokeWidth={1}>
          <line x1={x - 7} y1={y} x2={x + 7} y2={y} />
          <line x1={x} y1={y - 7} x2={x} y2={y + 7} />
        </g>
      ))}
    </svg>
  );
}
