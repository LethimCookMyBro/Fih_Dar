'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import SoftAurora from '@/components/reactbits/soft-aurora';
import { CoordinateTicks, TopographicLines } from '@/components/visuals/geospatial-texture';

const PANEL_BG = '#14181a';
const KEPPEL = '#2a9d8f';
const EGGPLANT = '#70405f';

/**
 * Full-bleed product hero, fixed dark like the auth panel (a brand moment, not
 * app chrome — the rest of the page stays theme-aware). Same SoftAurora engine
 * as auth, different placement/scale so the two don't read as copy-pasted.
 */
export function AboutHero() {
  return (
    <section
      className='relative flex min-h-[74vh] items-center overflow-hidden'
      style={{ backgroundColor: PANEL_BG }}
    >
      <HeroBackground />
      <div className='relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8'>
        <p className='font-mono text-[0.75rem] tracking-[0.3em] text-white/50 uppercase'>
          FihDar • EEC
        </p>
        <h1 className='mt-5 text-6xl font-semibold tracking-tight text-balance text-white md:text-8xl'>
          FihDar
        </h1>
        <p className='mt-6 max-w-2xl text-xl leading-relaxed text-balance text-white/80 md:text-2xl'>
          เห็นสัญญาณให้ชัดขึ้น ก่อนตัดสินใจลงพื้นที่
        </p>
        <div className='mt-10 flex flex-wrap items-center justify-center gap-3'>
          <Button
            nativeButton={false}
            className='h-12 px-7 text-base'
            style={{ backgroundColor: KEPPEL }}
            render={<Link href='/map' aria-label='สำรวจแผนที่' />}
          >
            <Icons.map />
            สำรวจแผนที่
          </Button>
          <Button
            nativeButton={false}
            variant='outline'
            className='h-12 border-white/25 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white'
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
  // Unlike the auth panel (CSS-hidden below `lg`), this hero is always visible, so the
  // WebGL field itself is gated on viewport width to keep phones off the shader cost.
  const [env, setEnv] = useState<{ reduceMotion: boolean; wide: boolean } | null>(null);

  useEffect(() => {
    const reduceMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wideMql = window.matchMedia('(min-width: 640px)');
    const update = () => setEnv({ reduceMotion: reduceMql.matches, wide: wideMql.matches });
    update();
    reduceMql.addEventListener('change', update);
    wideMql.addEventListener('change', update);
    return () => {
      reduceMql.removeEventListener('change', update);
      wideMql.removeEventListener('change', update);
    };
  }, []);

  const runAurora = env !== null && env.wide && !env.reduceMotion;

  return (
    <div aria-hidden className='absolute inset-0'>
      {runAurora && (
        <SoftAurora
          speed={0.55}
          scale={1.85}
          brightness={1.05}
          color1={KEPPEL}
          color2={EGGPLANT}
          noiseFrequency={1.4}
          noiseAmplitude={1.3}
          bandHeight={0.58}
          bandSpread={1.1}
          octaveDecay={0.22}
          layerOffset={0.5}
          colorSpeed={0.4}
          enableMouseInteraction
          mouseInfluence={0.05}
        />
      )}
      {!runAurora && (
        <div
          className='absolute inset-0'
          style={{
            background: `radial-gradient(65% 55% at 32% 30%, rgba(42,157,143,0.34), transparent 62%),
              radial-gradient(60% 50% at 72% 65%, rgba(112,64,95,0.3), transparent 65%)`,
            filter: 'blur(52px)'
          }}
        />
      )}
      <TopographicLines opacity={0.07} />
      <CoordinateTicks opacity={0.16} />
      <div
        className='absolute inset-0'
        style={{
          background: `radial-gradient(90% 75% at 50% 38%, transparent 45%, ${PANEL_BG} 96%)`
        }}
      />
    </div>
  );
}
