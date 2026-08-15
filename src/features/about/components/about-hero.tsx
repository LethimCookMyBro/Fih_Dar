'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Waves from '@/components/reactbits/waves';

/**
 * Same Waves field as auth, different composition: lighter, larger-scale,
 * theme-aware (not fixed dark) — a spacious opening statement rather than a
 * quiet login backdrop.
 */
export function AboutHero() {
  return (
    <section className='relative overflow-hidden border-b'>
      <HeroBackground />
      <div className='relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8'>
        <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.2em] uppercase'>
          FihDar
        </p>
        <h1 className='mt-4 text-5xl font-semibold tracking-tight text-balance md:text-6xl'>
          FihDar
        </h1>
        <p className='mt-5 max-w-xl text-xl leading-relaxed text-balance md:text-2xl'>
          เห็นสัญญาณให้ชัดขึ้น
          <br />
          ก่อนตัดสินใจลงพื้นที่
        </p>
        <div className='mt-9 flex flex-wrap items-center justify-center gap-3'>
          <Button
            nativeButton={false}
            className='h-11 px-6 text-[0.9375rem]'
            render={<Link href='/map' aria-label='สำรวจแผนที่' />}
          >
            <Icons.map />
            สำรวจแผนที่
          </Button>
          <Button
            nativeButton={false}
            variant='outline'
            className='h-11 px-6 text-[0.9375rem]'
            render={<Link href='/report' aria-label='แจ้งการพบ' />}
          >
            <Icons.mapPinPlus />
            แจ้งการพบ
          </Button>
        </div>
      </div>
    </section>
  );
}

function HeroBackground() {
  // See auth-visual.tsx's AuthBackground: matchMedia is read in an effect (not
  // motion/react's useReducedMotion) so the first client render matches the server.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <div aria-hidden className='absolute inset-0'>
      <div className='from-accent/40 absolute inset-0 bg-gradient-to-b to-transparent' />
      {reduceMotion === false && (
        <Waves
          lineColor='color-mix(in oklch, var(--primary) 45%, transparent)'
          backgroundColor='transparent'
          waveSpeedX={0.006}
          waveSpeedY={0.0025}
          waveAmpX={44}
          waveAmpY={22}
          xGap={26}
          yGap={44}
          friction={0.92}
          tension={0.006}
          maxCursorMove={70}
          mouseInteraction
          className='opacity-70'
        />
      )}
      <div
        className='absolute inset-0'
        style={{
          background: 'radial-gradient(80% 60% at 50% 0%, transparent 40%, var(--background) 95%)'
        }}
      />
    </div>
  );
}
