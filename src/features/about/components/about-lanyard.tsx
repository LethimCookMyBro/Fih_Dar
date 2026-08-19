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
    // Width alone says nothing about input: an iPad in landscape is 1024px
    // wide but touch-first. Physics + drag interaction is desktop-class
    // enhancement — require a real pointer, not just a wide viewport, so
    // iPad/Android tablets get the static card and its no-drag scroll safety.
    const capableMql = window.matchMedia(
      '(min-width: 768px) and (hover: hover) and (pointer: fine)'
    );
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
          // The strap's own texture (public/reactbits/lanyard/lanyard-strap.png) now
          // carries the Lava/charcoal base + Keppel mark + Eggplant piping directly, so
          // stripColor stays at the component's white default — meshLineMaterial
          // multiplies stripColor against the texture, and a colour override here would
          // just tint/darken that art instead of letting it render as authored.
          lanyardWidth={0.25}
          gravity={[0, -32, 0]}
          // Default camera (z=30, fov=20) frames a ~10.6-unit-tall window — huge
          // relative to the card, which is why the stock demo reads as a small
          // badge no matter how big its CSS container is (world-space framing,
          // not container size, controls how large the card renders). Moving the
          // camera to z=17 roughly halves that window so the card actually fills
          // the frame. The y offset places the window so its top edge sits a real
          // margin (~0.5 world units, not a hairline) below the fixed rope anchor
          // (world y=4) — the anchor stays out of frame with enough clearance that
          // normal sway can't expose it, so what's visible is the strap already
          // descending from the top edge, with headroom below for the card and
          // its swing.
          position={[0, 0.5, 17]}
          onContextLost={() => setContextLost(true)}
        />
      ) : (
        <StaticLanyardCard />
      )}
    </div>
  );
}

/**
 * Motion-free stand-in: the same card art, gently tilted, no physics/WebGL at all —
 * shown for reduced motion, small phones, while the 3D chunk loads, or if the WebGL
 * context is lost. Pinned near the container's top edge with a short CSS "strap" above
 * it, not vertically centered, so it still reads as hanging from the top boundary even
 * without the interactive version's camera framing (this container can be up to ~860px
 * tall on desktop — a small centered card in that much empty space would read as
 * "lost", not "hero object").
 */
function StaticLanyardCard() {
  return (
    <div className='flex h-full w-full flex-col items-center pt-[5%]'>
      <div
        aria-hidden
        className='h-[6%] min-h-4 w-[3px] shrink-0 rounded-full lg:min-h-7'
        style={{ background: 'linear-gradient(180deg, #70405f, #4b2142)' }}
      />
      <div
        className='relative mt-[-1px] aspect-[2/3] w-[54%] max-w-[220px] shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:max-w-[260px] lg:max-w-[340px]'
        style={{ transform: 'rotate(-3deg)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG badge art, not an optimizable photo */}
        <img src={CARD_FRONT} alt='บัตร FihDar' className='h-full w-full object-cover' />
      </div>
    </div>
  );
}
