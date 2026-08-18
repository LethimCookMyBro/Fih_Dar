'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { LogoMark } from '@/components/brand/logo-mark';
import { CoordinateTicks, TopographicLines } from '@/components/visuals/geospatial-texture';
import { TextLoop } from '@/components/visuals/text-loop';

const PANEL_BG = '#14181a';

// Dither pulls in the full @react-three/fiber + postprocessing + three stack — only Auth
// pays that bundle cost, and only once the panel has actually decided to render it (see
// runDither below), never during SSR (a WebGL canvas has nothing to render server-side).
const Dither = dynamic(() => import('@/components/reactbits/dither'), {
  ssr: false,
  loading: StaticDitherGlow
});

/**
 * Left-panel brand moment: logo, a live Dither field, and a large ambient TextLoop
 * ribbon. Deliberately fixed dark (not theme-driven) — this is a brand panel, not app
 * chrome. WebGL only mounts at `lg` and up (matches the `hidden lg:flex` below) and
 * never under prefers-reduced-motion.
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
        <LogoMark className='size-(--brand-mark) rounded-lg' />
        <span className='text-xl font-semibold tracking-tight text-white'>FihDar</span>
      </Link>

      <AuthBackground />

      {/* A real visual element, not a footer label: wide, overflowing the panel edges so
          the curve reads as part of the atmosphere rather than a line of UI copy. */}
      <div
        aria-hidden
        className='pointer-events-none absolute bottom-[5%] left-[-12%] z-10 h-[140px] w-[126%] opacity-80'
      >
        <TextLoop
          text='FIHDAR • FISH + RADAR • EEC • GEOSPATIAL INTELLIGENCE'
          shape='wave'
          speed={55}
          direction='forward'
          separator='•'
          curviness={52}
          fontSize={28}
          fontWeight={650}
          letterSpacing={2.5}
          uppercase
          color='rgba(255,255,255,0.62)'
          ribbon
          ribbonColor='rgba(42,157,143,0.16)'
          ribbonWidth={54}
          pauseOnHover={false}
          className='h-full w-full overflow-visible'
        />
      </div>
    </div>
  );
}

/** Live Dither field with topographic structure, replaced by a static blend when
 *  reduced motion is on or the panel isn't actually visible (below `lg`). */
function AuthBackground() {
  // Not motion/react's useReducedMotion: it reads matchMedia synchronously on the
  // client during the very first render (no window on the server), which mismatches
  // the SSR pass since this component branches its actual DOM on the value. Deferring
  // to useEffect keeps the first client render identical to the server's.
  const [env, setEnv] = useState<{ reduceMotion: boolean; desktop: boolean } | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const reduceMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopMql = window.matchMedia('(min-width: 1024px)');
    const update = () => setEnv({ reduceMotion: reduceMql.matches, desktop: desktopMql.matches });
    update();
    reduceMql.addEventListener('change', update);
    desktopMql.addEventListener('change', update);
    return () => {
      reduceMql.removeEventListener('change', update);
      desktopMql.removeEventListener('change', update);
    };
  }, []);

  // Avoid a flash of the wrong variant: render nothing until it resolves. Also keeps
  // the costly WebGL context from ever mounting on a panel that's CSS-hidden below `lg`.
  if (env === null) return <div aria-hidden className='absolute inset-0' />;

  const runDither = env.desktop && !env.reduceMotion && !contextLost;

  return (
    <div aria-hidden className='absolute inset-0'>
      {runDither ? (
        <Dither
          waveSpeed={0.3}
          waveFrequency={2.5}
          waveAmplitude={0.33}
          waveColor={[0.16, 0.61, 0.56]}
          colorNum={5}
          pixelSize={2.5}
          enableMouseInteraction
          mouseRadius={0.48}
          onContextLost={() => setContextLost(true)}
        />
      ) : (
        <StaticDitherGlow />
      )}
      {/* pointer-events-none on every decorative layer below: without it, each one sits
          in the hit-test path above the Dither canvas and silently eats mouse-move events
          before they ever reach the WebGL element, killing the interaction entirely. */}
      {/* Restrained Eggplant interference, per the brand palette — the shader itself
          only carries one wave colour, so the second brand colour lives here instead. */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background: 'radial-gradient(38% 32% at 78% 74%, rgba(112,64,95,0.22), transparent 70%)'
        }}
      />
      <TopographicLines />
      <CoordinateTicks />
      {/* Soft center illumination, above the field, below the vignette. */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background: 'radial-gradient(42% 38% at 50% 30%, rgba(42,157,143,0.14), transparent 72%)'
        }}
      />
      {/* Dark edge vignette so the field never competes with the brand mark or the ribbon. */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background: `radial-gradient(130% 100% at 50% 42%, transparent 38%, ${PANEL_BG} 94%)`
        }}
      />
    </div>
  );
}

/** Motion-free stand-in for the WebGL field: a blurred two-tone blend, same palette.
 *  Also the first-paint fallback while the Dither chunk itself is still loading. */
function StaticDitherGlow() {
  return (
    <div
      className='absolute inset-0'
      style={{
        background: `radial-gradient(60% 50% at 28% 22%, rgba(42,157,143,0.34), transparent 62%),
          radial-gradient(55% 45% at 74% 62%, rgba(112,64,95,0.3), transparent 65%)`,
        filter: 'blur(48px)'
      }}
    />
  );
}
