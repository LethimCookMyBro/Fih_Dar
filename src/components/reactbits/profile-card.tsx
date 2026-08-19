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
import Image from 'next/image';

interface ProfileCardProps {
  /** '' when the image is shared team branding, not an actual portrait of `name`. */
  avatarUrl: string;
  avatarAlt: string;
  name: string;
  title: string;
  /** Per-member accent (existing Keppel/Eggplant palette) for the divider and hover border — the only source of card-to-card variation; the image itself is never recolored. */
  accent: string;
  className?: string;
}

export default function ProfileCard({
  avatarUrl,
  avatarAlt,
  name,
  title,
  accent,
  className = ''
}: ProfileCardProps) {
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
      style={{ '--card-accent': accent } as React.CSSProperties}
      className={`group relative flex w-full max-w-[300px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-(--ease-standard) hover:-translate-y-1 hover:border-(--card-accent) hover:shadow-lg motion-reduce:translate-y-0 motion-reduce:transition-none ${className}`.trim()}
    >
      {/* Image anchor — ~45-55% of the card height. A shared mascot image, never
          an individual portrait, so alt stays on the caller (see about-team.tsx). */}
      <div className='relative h-36 w-full shrink-0 overflow-hidden'>
        <Image
          src={avatarUrl}
          alt={avatarAlt}
          fill
          sizes='300px'
          className='object-cover object-top transition-transform duration-300 ease-(--ease-standard) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100'
        />
      </div>

      {/* Per-member accent divider — the only card-to-card variation; the photo itself is identical and never recolored. */}
      <div aria-hidden='true' className='h-[3px] w-full shrink-0 bg-(--card-accent)' />

      {/* Subtle pointer spotlight, full card: position comes from the JS above
          (idle = no writes), visibility is pure CSS on hover. Zeroed under
          reduced motion. --spot-x/--spot-y are card-relative, so this overlay
          must span the whole card (not just the text area) to stay aligned. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-[1] opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:opacity-0 motion-reduce:group-hover:opacity-0'
        style={{
          background:
            'radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 30%), color-mix(in srgb, var(--card-accent) 10%, transparent) 0%, transparent 70%)'
        }}
      />

      <div className='relative z-[1] flex flex-1 flex-col gap-1 px-5 py-4 text-center'>
        <h3 className='text-[0.9375rem] leading-snug font-semibold tracking-tight text-balance'>
          {name}
        </h3>
        <p className='text-muted-foreground text-[0.8125rem] leading-relaxed'>{title}</p>
      </div>
    </div>
  );
}
