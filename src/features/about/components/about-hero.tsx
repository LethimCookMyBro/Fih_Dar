import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { AboutLanyard } from './about-lanyard';

/**
 * About's hero is deliberately NOT Auth's hero: a light, editorial layout instead of a
 * full-bleed dark WebGL panel, so the two pages read as related (palette, type, radii)
 * rather than copy-pasted. The signature visual here is the interactive FihDar lanyard
 * badge, not a shader field. Text comes first in document order (and visually first on
 * mobile) — the hero's job is "what is this, who made it", not a game.
 */
export function AboutHero() {
  return (
    <section className='relative overflow-hidden border-b'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(60% 55% at 85% 15%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 70%)'
        }}
      />
      <div className='relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[55fr_45fr] lg:gap-8 lg:py-28 lg:px-8'>
        <div className='flex flex-col items-center text-center lg:items-start lg:text-start'>
          <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.3em] uppercase'>
            FihDar • EEC
          </p>
          <h1 className='mt-5 text-5xl font-semibold tracking-tight text-balance md:text-6xl'>
            FihDar
          </h1>
          <p className='text-muted-foreground mt-5 max-w-md text-lg leading-relaxed text-balance md:text-xl'>
            ระบบเฝ้าระวังเชิงพื้นที่
            <br />
            เพื่อช่วยให้เห็นว่าควรเริ่มตรวจสอบตรงไหนก่อน
          </p>
          <div className='mt-8'>
            <Button
              nativeButton={false}
              className='h-12 px-7 text-base'
              render={<Link href='/map' aria-label='สำรวจแผนที่' />}
            >
              <Icons.map />
              สำรวจแผนที่
            </Button>
          </div>
        </div>

        {/* Capped on mobile so the badge is a visual accent below the copy, never a
            near-100vh block the user has to scroll past to reach any information. */}
        <div className='h-[320px] w-full sm:h-[380px] lg:h-[520px]'>
          <AboutLanyard />
        </div>
      </div>
    </section>
  );
}
