'use client';

// FihDar-native team card.
//
// Replaces a vendored React Bits holo-tilt demo that was costing the About page
// real performance: its tilt engine kept a requestAnimationFrame loop running
// forever while the tab had focus (`if (stillFar || document.hasFocus())`), a
// measured ~790 rAF callbacks/second at idle across four cards, plus an infinite
// 18s color-dodge holo sweep per card and a 50px-blur behind glow. Measured
// before the rewrite: 2378 rAF callbacks in 3s of idle on /about.
//
// The new card is CSS-first: a pointer spotlight is the only JS-driven effect,
// and it writes at most one CSS custom property pair per frame, only while the
// pointer is actually moving over the card. Nothing runs while idle, there are
// no infinite CSS animations, no blur, no color-dodge, no 3D tilt engine, and
// prefers-reduced-motion turns the spotlight and hover lift off entirely.
import React, { useCallback, useEffect, useRef } from 'react';

interface ProfileCardProps {
  avatarUrl: string;
  name: string;
  title: string;
  className?: string;
}

export default function ProfileCard({ avatarUrl, name, title, className = '' }: ProfileCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Latest pointer position, written to CSS vars at most once per frame. A
  // pointermove that arrives mid-frame just updates `latest`; the pending frame
  // write picks it up. When the pointer stops, no further frames are scheduled
  // and the card is fully idle.
  const latest = useRef({ x: 0, y: 0 });
  const framePending = useRef(false);

  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    const wrap = wrapRef.current;
    if (!wrap || reducedMotion.current) return;

    const rect = wrap.getBoundingClientRect();
    latest.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (framePending.current) return;

    framePending.current = true;
    requestAnimationFrame(() => {
      framePending.current = false;
      const el = wrapRef.current;
      if (!el) return;
      el.style.setProperty('--spot-x', `${latest.current.x}px`);
      el.style.setProperty('--spot-y', `${latest.current.y}px`);
    });
  }, []);

  return (
    <div
      ref={wrapRef}
      data-profile-card=''
      onPointerMove={handlePointerMove}
      className={`group relative flex min-h-[360px] w-full max-w-[300px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-(--ease-standard) hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg motion-reduce:translate-y-0 motion-reduce:transition-none ${className}`.trim()}
    >
      {/* Restrained Keppel → Eggplant accent bar — the only decorative sweep. */}
      <div
        aria-hidden='true'
        className='h-1 w-full shrink-0 bg-gradient-to-r from-primary via-primary/50 to-brand'
      />

      {/* Subtle pointer spotlight: position comes from the JS above (idle = no
          writes), visibility is pure CSS on hover. Zeroed under reduced motion. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:opacity-0 motion-reduce:group-hover:opacity-0'
        style={{
          background:
            'radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 30%), color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 70%)'
        }}
      />

      <div className='relative z-[1] flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center'>
        {/* Radar-ring initials mark — deterministic per member (see about-team.tsx). */}
        <div className='rounded-full border border-border p-1 shadow-xs'>
          <div className='overflow-hidden rounded-full ring-2 ring-primary/20'>
            {/* eslint-disable-next-line @next/next/no-img-element -- deterministic SVG
                data-URI initials mark, not a photograph; no next/image benefit */}
            <img
              src={avatarUrl}
              alt={`${name} avatar`}
              loading='lazy'
              className='block h-24 w-24'
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = 'none';
              }}
            />
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <h3 className='text-lg leading-snug font-semibold tracking-tight'>{name}</h3>
          <p className='text-muted-foreground text-[0.9375rem] leading-relaxed'>{title}</p>
        </div>
      </div>
    </div>
  );
}
