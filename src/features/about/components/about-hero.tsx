import Link from 'next/link';

import { Icons } from '@/components/icons';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { AboutLanyard } from './about-lanyard';

/**
 * About's hero is deliberately NOT Auth's hero: a light, editorial layout instead of a
 * full-bleed dark WebGL panel, so the two pages read as related (palette, type, radii)
 * rather than copy-pasted. The signature visual here is the interactive FihDar lanyard
 * badge, not a shader field. Text comes first in document order (and visually first on
 * mobile) — the hero's job is "what is this, who made it", not a game.
 *
 * The lanyard wrapper below is a single `<AboutLanyard />` mount whose size/position
 * change entirely via responsive Tailwind classes (a modest in-flow accent under the
 * copy below `lg`, a large object pinned to the section's top edge at `lg`+) rather
 * than two separately-hidden instances — toggling visibility with `hidden`/`lg:hidden`
 * on two copies would still mount two WebGL canvases at once, just with one invisible.
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
      <div className='relative mx-auto w-full max-w-7xl px-4 pt-16 pb-6 sm:px-6 md:pt-20 md:pb-8 lg:px-8 lg:py-0'>
        <div className='flex flex-col items-center text-center lg:min-h-[84vh] lg:max-w-[47%] lg:items-start lg:justify-center lg:text-start'>
          <LogoMark className='size-12 rounded-xl md:size-14' priority />
          <p className='text-muted-foreground mt-5 font-mono text-[0.75rem] tracking-[0.3em] uppercase'>
            FihDar • EEC
          </p>
          <h1 className='mt-2 text-5xl font-semibold tracking-tight text-balance md:text-6xl'>
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
      </div>

      {/* Capped on mobile so the badge is a visual accent below the copy, never a
          near-100vh block the user has to scroll past to reach any information.
          At `lg`, becomes large and absolutely positioned top-right, pinned to the
          section's own top edge (top-0) rather than vertically centered, so the
          strap reads as hanging from the top boundary — see about-lanyard.tsx for
          the camera framing that crops the fixed rope anchor above the visible
          canvas, so what's on screen is the strap descending from off-frame. */}
      <div className='relative z-10 mx-auto h-[320px] w-full max-w-sm px-4 pb-16 sm:h-[380px] sm:px-6 md:pb-20 lg:absolute lg:top-0 lg:right-[4%] lg:mx-0 lg:h-[clamp(600px,78vh,860px)] lg:w-[clamp(480px,40vw,760px)] lg:max-w-none lg:p-0'>
        <AboutLanyard />
      </div>
    </section>
  );
}
