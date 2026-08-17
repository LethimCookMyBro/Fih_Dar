'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sourcesSummaryQueryOptions } from '@/features/sources/api/queries';
import { formatDateTime, formatNumber } from '@/features/sources/lib/format';
import { scrollToJourney } from '@/features/sources/lib/scroll-to-journey';

import { SignalFlow } from './signal-flow';

const CHANNELS = ['ข่าวสาธารณะ', 'ข้อมูลเปิดภาครัฐ', 'ข้อมูลพลเมือง', 'รายงานจากประชาชน'];

function HeroMetric({
  label,
  value,
  accent = false
}: {
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div className='flex flex-col gap-1'>
      <span
        className={`text-2xl font-semibold tracking-tight tabular-nums sm:text-[2rem] ${
          accent ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value === null ? '—' : formatNumber(value)}
      </span>
      <span className='text-muted-foreground text-[0.8125rem] font-medium'>{label}</span>
    </div>
  );
}

function HeroMetrics() {
  const { data, isPending } = useQuery(sourcesSummaryQueryOptions());

  if (isPending || !data) {
    return (
      <div className='grid grid-cols-2 gap-x-8 gap-y-5 border-t pt-6 sm:grid-cols-4'>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className='flex flex-col gap-2'>
            <Skeleton className='h-8 w-16' />
            <Skeleton className='h-4 w-24' />
          </div>
        ))}
      </div>
    );
  }

  const degradedCount = data.sources.filter((source) => source.status === 'DEGRADED').length;
  const healthyCount = data.sources.filter((source) => source.status === 'OK').length;
  const hasRun = data.latestRun !== null;
  const statusOk = data.latestRun?.status === 'SUCCEEDED' || data.latestRun?.status === 'PARTIAL';

  return (
    <div className='border-t pt-6'>
      <div className='grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4'>
        <HeroMetric label='ข้อมูลที่รับเข้า' value={data.pipeline.externalObservations} />
        <HeroMetric label='เกี่ยวข้องกับระบบ' value={data.pipeline.relevant} accent />
        <HeroMetric label='เหตุการณ์ที่เชื่อมโยง' value={data.pipeline.eventCandidates} accent />
        <HeroMetric label='รายงานจากประชาชน' value={data.pipeline.citizenReports} />
      </div>

      <div className='text-muted-foreground mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.8125rem]'>
        {hasRun && statusOk ? (
          <span className='inline-flex items-center gap-1.5 font-medium text-status-verified'>
            <Icons.check className='size-3.5' aria-hidden />
            ระบบรับข้อมูลทำงาน
          </span>
        ) : (
          <span className='inline-flex items-center gap-1.5 font-medium text-status-pending'>
            <Icons.clock className='size-3.5' aria-hidden />
            ยังไม่มีการอัปเดตอัตโนมัติ
          </span>
        )}
        {hasRun && (
          <span>
            อัปเดตล่าสุด{' '}
            {formatDateTime(data.latestRun?.finishedAt ?? data.latestRun?.startedAt ?? null)}
          </span>
        )}
        <span>อัตโนมัติประมาณทุก 6 ชั่วโมง</span>
        {degradedCount > 0 && healthyCount > 0 && (
          <span className='inline-flex items-center gap-1.5 text-status-pending'>
            <Icons.warning className='size-3.5' aria-hidden />
            {degradedCount} แหล่งมีข้อจำกัด — ระบบยังทำงานตามปกติ
          </span>
        )}
      </div>
    </div>
  );
}

export function SourcesHero() {
  return (
    <section aria-labelledby='sources-hero-heading' className='pt-6 sm:pt-10'>
      <div className='grid items-start gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14'>
        {/* Left — message */}
        <div>
          <p className='text-primary inline-flex items-center gap-2 text-[0.8125rem] font-semibold tracking-wide uppercase'>
            <Icons.radar className='size-4' aria-hidden />
            ระบบข้อมูลข่าวกรองเชิงพื้นที่
          </p>
          <h1
            id='sources-hero-heading'
            className='mt-4 max-w-xl text-[2.1rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-[2.75rem]'
          >
            จากข้อมูลสาธารณะ
            <br />
            สู่พื้นที่ที่ควรได้รับความสนใจ
          </h1>
          <p className='text-muted-foreground mt-5 max-w-md text-[0.9375rem] leading-relaxed sm:text-base'>
            FihDar รับข้อมูลจากหลายแหล่ง ตรวจสอบความเกี่ยวข้อง เชื่อมโยงสถานที่และเหตุการณ์
            ก่อนช่วยจัดลำดับพื้นที่สำหรับการเฝ้าระวังปลาหมอคางดำ
          </p>

          <ul className='mt-6 flex flex-wrap gap-2'>
            {CHANNELS.map((channel) => (
              <li
                key={channel}
                className='border-border text-muted-foreground rounded-full border bg-card px-3 py-1.5 text-[0.8125rem] font-medium'
              >
                {channel}
              </li>
            ))}
          </ul>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <Button
              nativeButton={false}
              className='h-11 px-5 text-[0.9375rem]'
              render={<Link href='/map' aria-label='สำรวจบนแผนที่' />}
            >
              <Icons.map />
              สำรวจบนแผนที่
            </Button>
            <Button
              type='button'
              variant='outline'
              className='h-11 px-5 text-[0.9375rem]'
              aria-label='ดูสายงานการประมวลผล เลื่อนลงไปที่ขั้นตอนการประมวลผลด้านล่าง'
              onClick={scrollToJourney}
            >
              ดูสายงานการประมวลผล
              <Icons.arrowRight className='size-4' aria-hidden />
            </Button>
          </div>
        </div>

        {/* Right — signal flow motif */}
        <div className='border-border rounded-2xl border bg-card p-5 shadow-xs sm:p-6'>
          <div className='mb-2 flex items-center justify-between gap-3'>
            <h2 className='text-[0.9375rem] font-semibold tracking-tight'>เส้นทางของสัญญาณ</h2>
            <span className='text-muted-foreground text-[0.75rem]'>ตัวเลขจากฐานข้อมูลจริง</span>
          </div>
          <SignalFlow />
        </div>
      </div>

      <HeroMetrics />
    </section>
  );
}
