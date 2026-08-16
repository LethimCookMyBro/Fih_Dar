'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const CARD_FRONT = '/reactbits/lanyard/card-front.svg';
const CARD_BACK = '/reactbits/lanyard/card-back.svg';

// Lanyard pulls in @react-three/fiber + drei + rapier (WASM physics) + meshline + three —
// a much heavier bundle than Dither's. Only the About page's hero section pays that cost,
// and only once it has actually decided to render the interactive version (see
// runInteractive below), never during SSR.
const Lanyard = dynamic(() => import('@/components/reactbits/lanyard'), {
  ssr: false,
  loading: StaticLanyardCard
});

/**
 * About's signature visual: the FIHDAR lanyard badge. Full physics + drag interaction
 * from `md` up when motion is allowed; a static tilted card image everywhere else
 * (small phones, reduced motion, or while the 3D chunk is still loading) — real
 * Rapier/Three physics on a low-end phone is exactly the case the brief calls out as
 * an acceptable place to fall back rather than force it.
 */
export function AboutLanyard() {
  const [env, setEnv] = useState<{ reduceMotion: boolean; capable: boolean } | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const reduceMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const capableMql = window.matchMedia('(min-width: 768px)');
    const update = () => setEnv({ reduceMotion: reduceMql.matches, capable: capableMql.matches });
    update();
    reduceMql.addEventListener('change', update);
    capableMql.addEventListener('change', update);
    return () => {
      reduceMql.removeEventListener('change', update);
      capableMql.removeEventListener('change', update);
    };
  }, []);

  const runInteractive = env !== null && env.capable && !env.reduceMotion && !contextLost;

  return (
    <div className='relative h-full w-full'>
      {runInteractive ? (
        <Lanyard
          frontImage={CARD_FRONT}
          backImage={CARD_BACK}
          imageFit='cover'
          stripColor='#4b2142'
          gravity={[0, -32, 0]}
          onContextLost={() => setContextLost(true)}
        />
      ) : (
        <StaticLanyardCard />
      )}
    </div>
  );
}

/** Motion-free stand-in: the same card art, gently tilted, no physics/WebGL at all. */
function StaticLanyardCard() {
  return (
    <div className='flex h-full w-full items-center justify-center'>
      <div
        className='relative aspect-[2/3] w-[62%] max-w-[280px] overflow-hidden rounded-2xl shadow-2xl'
        style={{ transform: 'rotate(-4deg)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG badge art, not an optimizable photo */}
        <img src={CARD_FRONT} alt='บัตร FihDar' className='h-full w-full object-cover' />
      </div>
    </div>
  );
}
