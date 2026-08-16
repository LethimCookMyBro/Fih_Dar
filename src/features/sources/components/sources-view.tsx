'use client';

import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { IntelligenceJourney } from './intelligence-journey';
import { OperationsPanel } from './operations-panel';
import { SignalTrace } from './signal-trace';
import { SourceObservatory } from './source-observatory';
import { SourcesHero } from './sources-hero';

function TransparencyCta() {
  return (
    <section
      aria-labelledby='transparency-heading'
      className='border-border bg-card overflow-hidden rounded-2xl border'
    >
      <div className='grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12'>
        <div>
          <p className='text-primary text-[0.8125rem] font-semibold tracking-wide uppercase'>
            ความโปร่งใส
          </p>
          <h2
            id='transparency-heading'
            className='mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl'
          >
            ทุกอย่างบนหน้านี้ตรวจสอบย้อนกลับได้
          </h2>
          <p className='text-muted-foreground mt-3 max-w-xl text-[0.9375rem] leading-relaxed'>
            ตัวเลข สถานะ และหลักฐานทุกขั้นตอนมาจากฐานข้อมูลจริง — ไม่มีข้อมูลจำลอง
            ข้อมูลจากข่าวและแหล่งสาธารณะเป็นสัญญาณสำหรับการเฝ้าระวัง ไม่ใช่การยืนยันการพบทางชีววิทยาโดยอัตโนมัติ
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3 lg:justify-end'>
          <Button
            nativeButton={false}
            className='h-11 px-5 text-[0.9375rem]'
            render={<Link href='/map' aria-label='สำรวจพื้นที่ที่ควรได้รับความสนใจบนแผนที่' />}
          >
            <Icons.map />
            สำรวจบนแผนที่
          </Button>
          <Button
            nativeButton={false}
            variant='outline'
            className='h-11 px-5 text-[0.9375rem]'
            render={<Link href='#journey' aria-label='ดูสายงานการประมวลผลอีกครั้ง' />}
          >
            ดูสายงานการประมวลผล
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * The flagship /sources screen. One product story, in order:
 * 01 WHY — signal-to-action hero with real live numbers
 * 02 HOW — the interactive intelligence journey
 * 03 PROOF — trace one real signal through the pipeline
 * 04 WHERE — the source observatory (searchable, scalable)
 * 05 HEALTH — operations / bounded run history
 * 06 CTA — transparency + map invitation
 */
export function SourcesView() {
  return (
    <div className='flex flex-col'>
      <SourcesHero />

      <div className='mt-16 sm:mt-24'>
        <IntelligenceJourney />
      </div>

      <div className='mt-20 sm:mt-28'>
        <SignalTrace />
      </div>

      <div className='mt-20 sm:mt-28'>
        <SourceObservatory />
      </div>

      <div className='mt-16 sm:mt-24'>
        <OperationsPanel />
      </div>

      <div className='mt-20 sm:mt-28'>
        <TransparencyCta />
      </div>
    </div>
  );
}
