'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import Waves from '@/components/reactbits/waves';
import { TextLoop } from '@/components/visuals/text-loop';

const PANEL_BG = '#191c1e';
const KEPPEL = '#2a9d8f';

/**
 * Left-panel brand moment: logo + a quiet Waves field + an ambient TextLoop.
 * Deliberately fixed dark (not theme-driven) — this is a brand panel, not app chrome.
 */
export function AuthVisual() {
  return (
    <div
      className='relative hidden flex-col justify-between overflow-hidden p-10 lg:flex'
      style={{ backgroundColor: PANEL_BG }}
    >
      <Link
        href='/map'
        className='relative z-10 flex w-fit items-center gap-3 rounded-(--nav-radius) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none'
      >
        <span
          className='flex size-(--brand-mark) items-center justify-center rounded-lg'
          style={{ backgroundColor: KEPPEL }}
        >
          <Icons.radar className='size-(--nav-icon-lg) text-white' aria-hidden />
        </span>
        <span className='text-xl font-semibold tracking-tight text-white'>FihDar</span>
      </Link>

      <AuthBackground />

      {/* Ambient, not the hero — kept to the bottom band so it never competes with the form. */}
      <div className='relative z-10 mt-auto flex flex-col gap-3'>
        <p className='font-mono text-[0.6875rem] tracking-[0.22em] text-white/40 uppercase'>
          EEC • Geospatial Intelligence
        </p>
        <div aria-hidden className='h-10 w-full max-w-md opacity-60'>
          <TextLoop
            text='FIHDAR • FISH + RADAR'
            shape='wave'
            speed={24}
            direction='forward'
            separator='•'
            curviness={36}
            fontSize={20}
            fontWeight={600}
            letterSpacing={1.5}
            color='rgba(255,255,255,0.42)'
            pauseOnHover={false}
            className='h-full w-full'
          />
        </div>
      </div>
    </div>
  );
}

/** Quiet Waves field, replaced by static lines when reduced motion is on. */
function AuthBackground() {
  // Not motion/react's useReducedMotion: it reads matchMedia synchronously on the
  // client during the very first render (no window on the server), which mismatches
  // the SSR pass since this component branches its actual DOM on the value. Deferring
  // to useEffect keeps the first client render identical to the server's.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Avoid a flash of the wrong variant: render nothing until motion preference resolves.
  if (reduceMotion === null) return <div aria-hidden className='absolute inset-0' />;

  return (
    <div aria-hidden className='absolute inset-0'>
      {reduceMotion ? (
        <StaticWaveLines />
      ) : (
        <Waves
          lineColor='rgba(42, 157, 143, 0.5)'
          backgroundColor='transparent'
          waveSpeedX={0.0025}
          waveSpeedY={0.001}
          waveAmpX={22}
          waveAmpY={10}
          xGap={22}
          yGap={38}
          friction={0.94}
          tension={0.004}
          maxCursorMove={40}
          mouseInteraction={false}
        />
      )}
      {/* Edge falloff so the field never competes with the brand mark or the ambient label. */}
      <div
        className='absolute inset-0'
        style={{
          background: `radial-gradient(120% 90% at 30% 15%, transparent 45%, ${PANEL_BG} 92%)`
        }}
      />
    </div>
  );
}

function StaticWaveLines() {
  return (
    <svg
      viewBox='0 0 500 500'
      className='absolute inset-0 size-full opacity-30'
      preserveAspectRatio='xMidYMid slice'
    >
      {[120, 200, 280, 360].map((y, i) => (
        <path
          key={y}
          d={`M -20 ${y} C 100 ${y - 30}, 150 ${y + 30}, 250 ${y} S 400 ${y - 30}, 520 ${y}`}
          fill='none'
          stroke={KEPPEL}
          strokeWidth={i === 1 ? 1.5 : 1}
        />
      ))}
    </svg>
  );
}
