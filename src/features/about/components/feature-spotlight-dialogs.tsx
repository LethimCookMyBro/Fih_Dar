'use client';

import { Icons, type Icon } from '@/components/icons';
import SpotlightCard from '@/components/reactbits/spotlight-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

type Feature = {
  icon: Icon;
  title: string;
  subtitle: string;
  facts: string[];
  experimental?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: Icons.mapPinPlus,
    title: 'Citizen Reports',
    subtitle: 'รับข้อมูลจากประชาชน',
    facts: ['รายงานพร้อมรายละเอียด', 'พิกัดตำแหน่งจริง', 'ภาพถ่ายหลักฐาน']
  },
  {
    icon: Icons.layers,
    title: 'Event Intelligence',
    subtitle: 'เชื่อมรายงานที่เกี่ยวข้อง',
    facts: ['รายงานที่เกี่ยวข้องกัน', 'จัดกลุ่มเป็นเหตุการณ์เดียว', 'บริบทจากแหล่งข่าว']
  },
  {
    icon: Icons.map,
    title: 'Geospatial Map',
    subtitle: 'สำรวจข้อมูลเชิงพื้นที่',
    facts: ['มุมมองเชิงพื้นที่บนแผนที่จริง', 'เชื่อมกับเส้นทางน้ำ', 'บริบทของเหตุการณ์ใกล้เคียง']
  },
  {
    icon: Icons.target,
    title: 'Priority',
    subtitle: 'ช่วยมองพื้นที่ที่ควรตรวจสอบก่อน',
    facts: ['ความใหม่ของข่าว', 'จำนวนสำนักข่าวที่รายงาน', 'ความชัดเจนของตำแหน่ง'],
    experimental: true
  }
];

export function FeatureSpotlightDialogs() {
  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8'>
      <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
        สำรวจระบบ
      </p>
      <h2 className='mt-3 text-2xl font-semibold tracking-tight md:text-3xl'>สี่ส่วนหลักของ FihDar</h2>

      <ul className='mt-8 grid gap-4 sm:grid-cols-2'>
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Dialog>
              <DialogTrigger
                className='w-full text-start focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none'
                aria-haspopup='dialog'
              >
                <SpotlightCard className='h-full'>
                  <div className='flex items-start gap-4'>
                    <span className='bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-xl'>
                      <f.icon className='size-(--nav-icon-lg)' aria-hidden />
                    </span>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='text-[0.9375rem] font-semibold'>{f.subtitle}</h3>
                        {f.experimental && (
                          <span className='bg-brand/10 text-brand rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium'>
                            ทดลอง (MVP)
                          </span>
                        )}
                      </div>
                      <p className='text-muted-foreground mt-1 text-[0.8125rem]'>{f.title}</p>
                    </div>
                  </div>
                </SpotlightCard>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <div className='bg-accent text-accent-foreground mb-1 flex size-11 items-center justify-center rounded-xl'>
                    <f.icon className='size-(--nav-icon-lg)' aria-hidden />
                  </div>
                  <DialogTitle className='flex flex-wrap items-center gap-2 text-lg'>
                    {f.subtitle}
                    {f.experimental && (
                      <span className='bg-brand/10 text-brand rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium'>
                        ทดลอง (MVP)
                      </span>
                    )}
                  </DialogTitle>
                </DialogHeader>
                <ul className='divide-border border-border divide-y border-t text-[0.9375rem]'>
                  {f.facts.map((fact) => (
                    <li key={fact} className='text-foreground py-2'>
                      {fact}
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </li>
        ))}
      </ul>
    </section>
  );
}
