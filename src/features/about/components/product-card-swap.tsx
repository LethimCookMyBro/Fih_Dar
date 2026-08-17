'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import CardSwap, { Card } from '@/components/reactbits/card-swap';

/**
 * True while the swap stack is (at least partly) inside the viewport. The
 * auto-rotate is a deliberate showcase, but running GSAP's 60fps ticker for
 * a section the user has scrolled past is pure waste — pause it off-screen.
 */
function useInView(ref: React.RefObject<HTMLDivElement | null>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      // A generous rootMargin keeps the swap from stopping the moment the
      // section's edge touches the viewport edge.
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

const VIEWS = [
  { label: 'แผนที่', image: '/about/waterway-detail.jpg', alt: 'มุมมองแผนที่ทางน้ำแบบซูมเข้าของ FihDar' },
  { label: 'เหตุการณ์', image: '/about/event-detail.jpg', alt: 'การ์ดรายละเอียดรายงานการพบบนแผนที่' },
  { label: 'อันดับพื้นที่', image: '/about/priority-panel.jpg', alt: 'แผงอันดับพื้นที่ที่ควรลงพื้นที่ก่อน' },
  { label: 'เส้นทางน้ำ', image: '/about/waterway-map.jpg', alt: 'แผนที่ทางน้ำภาคตะวันออกแบบเต็มพื้นที่' }
];

// Full size at rest — actually used only once the wrapper genuinely has this much
// room (see useFittedCardSwapSize below).
const MAX_WIDTH = 680;
const MAX_HEIGHT = 460;

/**
 * Scales CardSwap to whatever width its wrapper actually has, up to MAX_WIDTH.
 * The app shell's sidebar width isn't a fixed fraction of the viewport (it's a
 * persistent 280px from `lg` up, an icon rail below that), so no static Tailwind
 * breakpoint reliably predicts how much room this column gets — measuring it
 * directly is the only fix that isn't just guessing another magic number.
 */
function useFittedCardSwapSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MAX_WIDTH);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const available = entries[0]?.contentRect.width;
      if (available > 0) setWidth(Math.min(MAX_WIDTH, available));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / MAX_WIDTH;
  return {
    ref,
    width,
    height: MAX_HEIGHT * scale,
    cardDistance: 66 * scale,
    verticalDistance: 64 * scale
  };
}

/**
 * The free CardSwap source positions itself `absolute bottom-0 right-0` assuming
 * it owns a full hero — here it's bounded to an explicit-size container so it
 * can't escape into the next section. Desktop only (`lg`+): the swap animation
 * reads as fiddly at phone width. Mobile/tablet get a plain static grid of the
 * same views instead.
 */
export function ProductCardSwap() {
  const fitted = useFittedCardSwapSize();
  const inView = useInView(fitted.ref);

  return (
    <section className='bg-muted/30 border-y'>
      <div className='mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[340px_1fr] lg:gap-12 lg:py-28 lg:px-8'>
        <div>
          <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
            มุมมองจริงจากระบบ
          </p>
          <h2 className='mt-3 text-2xl font-semibold tracking-tight md:text-3xl'>
            ทุกมุมมองอยู่ในที่เดียว
          </h2>
          <p className='text-muted-foreground mt-3 max-w-md text-[0.9375rem] leading-relaxed'>
            ภาพจริงจากระบบ FihDar — ไม่ใช่ภาพจำลอง
          </p>
        </div>

        {/* overflow-hidden is load-bearing: CardSwap's stack moves via CSS transform, which
            doesn't affect layout bounds, so without clipping it visually escapes into whatever
            renders below (see spec: "must not overlap the next section"). min-w-0 is also
            load-bearing: without it, a wide CardSwap child stops this grid column from ever
            shrinking, and the whole grid overflows the page horizontally instead of being
            measured and fitted by useFittedCardSwapSize. */}
        <div
          ref={fitted.ref}
          className='relative hidden w-full min-w-0 items-center justify-center overflow-hidden lg:flex'
          style={{ height: Math.max(360, fitted.height * 1.35) }}
        >
          <CardSwap
            width={fitted.width}
            height={fitted.height}
            cardDistance={fitted.cardDistance}
            verticalDistance={fitted.verticalDistance}
            skewAmount={3}
            easing='linear'
            delay={5000}
            pauseOnHover
            paused={!inView}
          >
            {VIEWS.map((v) => (
              <Card key={v.label}>
                <div className='relative h-full w-full'>
                  <Image src={v.image} alt={v.alt} fill className='object-cover' sizes='680px' />
                  <span className='bg-background/85 text-foreground absolute bottom-4 left-4 rounded-full px-3 py-1.5 text-sm font-medium'>
                    {v.label}
                  </span>
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>

        <ul className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden'>
          {VIEWS.map((v) => (
            <li
              key={v.label}
              className='border-border relative aspect-video overflow-hidden rounded-xl border'
            >
              <Image
                src={v.image}
                alt={v.alt}
                fill
                className='object-cover'
                sizes='(min-width: 640px) 25vw, 50vw'
              />
              <span className='bg-background/85 text-foreground absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium'>
                {v.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
