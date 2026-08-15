import Image from 'next/image';

import CardSwap, { Card } from '@/components/reactbits/card-swap';

const VIEWS = [
  { label: 'แผนที่', image: '/about/waterway-detail.jpg', alt: 'มุมมองแผนที่ทางน้ำแบบซูมเข้าของ FihDar' },
  { label: 'เหตุการณ์', image: '/about/event-detail.jpg', alt: 'การ์ดรายละเอียดรายงานการพบบนแผนที่' },
  { label: 'อันดับพื้นที่', image: '/about/priority-panel.jpg', alt: 'แผงอันดับพื้นที่ที่ควรลงพื้นที่ก่อน' },
  { label: 'เส้นทางน้ำ', image: '/about/waterway-map.jpg', alt: 'แผนที่ทางน้ำภาคตะวันออกแบบเต็มพื้นที่' }
];

/**
 * The free CardSwap source positions itself `absolute bottom-0 right-0` assuming
 * it owns a full hero — here it's bounded to an explicit-size container so it
 * can't escape into the next section. Desktop only: the swap animation reads as
 * fiddly at phone width, so mobile gets a plain static grid of the same views.
 */
export function ProductCardSwap() {
  return (
    <section className='bg-muted/30 border-y'>
      <div className='mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-20 lg:px-8'>
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
            renders below (see spec: "must not overlap the next section"). */}
        <div className='relative hidden h-[420px] w-full overflow-hidden md:block'>
          <CardSwap
            width={440}
            height={320}
            cardDistance={46}
            verticalDistance={50}
            delay={5000}
            pauseOnHover
          >
            {VIEWS.map((v) => (
              <Card key={v.label}>
                <div className='relative h-full w-full'>
                  <Image src={v.image} alt={v.alt} fill className='object-cover' sizes='440px' />
                  <span className='bg-background/85 text-foreground absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[0.75rem] font-medium'>
                    {v.label}
                  </span>
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>

        <ul className='grid grid-cols-2 gap-3 md:hidden'>
          {VIEWS.map((v) => (
            <li
              key={v.label}
              className='border-border relative aspect-video overflow-hidden rounded-xl border'
            >
              <Image src={v.image} alt={v.alt} fill className='object-cover' sizes='50vw' />
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
