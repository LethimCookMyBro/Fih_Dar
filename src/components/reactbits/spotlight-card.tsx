'use client';

// Source: React Bits (@react-bits/SpotlightCard-TS-TW), https://reactbits.dev/components/spotlight-card
// Vendored from the free registry JSON (https://reactbits.dev/r/SpotlightCard-TS-TW.json).
// Adapted: the demo's fixed `neutral-900`/white-spotlight surface is replaced with FihDar's
// theme tokens so the card follows light/dark mode, and the spotlight defaults to a subtle
// Keppel tint rather than a bright white flashlight.
import { useRef, useState } from 'react';

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
  asChild?: boolean;
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(42, 157, 143, 0.18)'
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => setOpacity(1)}
      onBlur={() => setOpacity(0)}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`bg-card border-border relative overflow-hidden rounded-2xl border p-6 ${className}`}
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out'
        style={{
          opacity,
          background: `radial-gradient(circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`
        }}
      />
      <div className='relative'>{children}</div>
    </div>
  );
}
