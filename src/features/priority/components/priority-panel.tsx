'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { priorityAreasQueryOptions } from '@/features/priority/api/queries';
import type { PriorityArea } from '@/features/priority/api/types';

const FLOATING_SURFACE = 'border border-border bg-background shadow-sm dark:bg-background';

/** verified/high = destructive red, medium = amber, low/no-data = neutral — never the brand color as a risk signal. */
function scoreTier(score: number): { label: string; badgeClass: string } {
  if (score >= 70)
    return { label: 'ความสำคัญสูง', badgeClass: 'bg-destructive text-destructive-foreground' };
  if (score >= 40) return { label: 'ความสำคัญปานกลาง', badgeClass: 'bg-amber-500 text-white' };
  return { label: 'ความสำคัญต่ำ', badgeClass: 'bg-muted text-muted-foreground' };
}

function formatAge(ageDays: number | null): string {
  if (ageDays === null) return 'ไม่ทราบวันที่';
  if (ageDays < 1) return 'วันนี้';
  return `${Math.round(ageDays)} วันก่อน`;
}

function AreaCard({ area, onFly }: { area: PriorityArea; onFly: (area: PriorityArea) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const tier = scoreTier(area.score);

  return (
    <li className='border-border rounded-xl border p-3'>
      <button
        type='button'
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className='flex w-full items-start justify-between gap-2 text-start'
      >
        <div className='min-w-0'>
          <p className='truncate text-[0.9375rem] font-semibold'>{area.areaLabel}</p>
          {area.province && area.place && area.province !== area.areaLabel && (
            <p className='text-muted-foreground text-[0.8125rem]'>จ.{area.province}</p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold tabular-nums',
            tier.badgeClass
          )}
        >
          {area.score}
        </span>
      </button>

      <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]'>
        <span className='inline-flex items-center gap-1'>
          <Icons.clock className='size-3.5' aria-hidden />
          {formatAge(area.breakdown.recency.ageDays)}
        </span>
        <span className='inline-flex items-center gap-1'>
          <Icons.checks className='size-3.5' aria-hidden />
          {area.independentSourceCount} แหล่งข่าวอิสระ
        </span>
        {!area.coordinate && (
          <span className='inline-flex items-center gap-1'>
            <Icons.mapPin className='size-3.5' aria-hidden />
            ไม่มีพิกัดบนแผนที่
          </span>
        )}
      </div>

      {expanded && (
        <div className='border-border mt-3 space-y-2 border-t pt-3 text-[0.8125rem]'>
          <p className='text-muted-foreground'>เหตุผลของคะแนน (การให้น้ำหนักที่ใช้อยู่ในขั้นทดลอง)</p>
          <dl className='space-y-1'>
            <div className='flex justify-between'>
              <dt>ความใหม่ของข่าว</dt>
              <dd className='tabular-nums'>{area.breakdown.recency.score}/100</dd>
            </div>
            <div className='flex justify-between'>
              <dt>จำนวนแหล่งข่าวอิสระยืนยัน</dt>
              <dd className='tabular-nums'>{area.breakdown.corroboration.score}/100</dd>
            </div>
            <div className='flex justify-between'>
              <dt>ความชัดเจนของตำแหน่ง ({area.locationPrecision})</dt>
              <dd className='tabular-nums'>{area.breakdown.location.score}/100</dd>
            </div>
          </dl>
          <ul className='space-y-1 pt-1'>
            {area.members.slice(0, 5).map((member) => (
              <li key={member.sourceUrl} className='truncate'>
                <a
                  href={member.sourceUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='hover:underline'
                >
                  {member.sourceName}: {member.title}
                </a>
                {member.isDuplicate && <span className='text-muted-foreground'> (ซ้ำ)</span>}
              </li>
            ))}
          </ul>
          {area.coordinate ? (
            <Button
              variant='outline'
              size='sm'
              className='mt-1 h-8 text-[0.8125rem]'
              onClick={() => onFly(area)}
            >
              <Icons.locate className='size-3.5' aria-hidden />
              ไปที่ตำแหน่งบนแผนที่
            </Button>
          ) : (
            <p className='text-muted-foreground pt-1'>
              ระบุพื้นที่ได้: {area.areaLabel} — ไม่มีพิกัดสำหรับแสดงบนแผนที่
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function PriorityPanel({ onFly }: { onFly: (area: PriorityArea) => void }) {
  const [open, setOpen] = React.useState(false);
  const reduceMotion = useReducedMotion();
  const { data, isPending, isError } = useQuery(priorityAreasQueryOptions());
  const areas = data?.areas ?? [];

  return (
    <>
      <Button
        variant='outline'
        aria-label={open ? 'ซ่อนอันดับพื้นที่ที่ควรลงพื้นที่ก่อน' : 'แสดงอันดับพื้นที่ที่ควรลงพื้นที่ก่อน'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pointer-events-auto absolute top-3 end-3 z-10 h-11 gap-2 rounded-(--nav-radius) px-3 text-[0.9375rem] md:top-4 md:end-4',
          FLOATING_SURFACE
        )}
      >
        <Icons.target aria-hidden />
        <span className='hidden sm:inline'>อันดับพื้นที่</span>
        {areas.length > 0 && (
          <span className='bg-brand text-brand-foreground flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums'>
            {areas.length}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.aside
            role='dialog'
            aria-label='อันดับพื้นที่ที่ควรลงพื้นที่ก่อน (ทดลอง)'
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className={cn(
              'absolute inset-x-0 bottom-0 z-20 flex max-h-[72svh] flex-col overflow-hidden rounded-t-2xl border-t shadow-lg',
              'md:inset-x-auto md:top-16 md:end-3 md:bottom-auto md:max-h-[calc(100%-5.5rem)] md:w-96 md:rounded-2xl md:border md:border-t',
              'bg-background'
            )}
          >
            <header className='flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3'>
              <div>
                <p className='text-[0.9375rem] font-semibold'>อันดับพื้นที่ควรลงพื้นที่ก่อน</p>
                <p className='text-muted-foreground text-[0.75rem]'>
                  <span className='bg-brand/10 text-brand rounded-full px-1.5 py-0.5 font-medium'>
                    ทดลอง (MVP)
                  </span>{' '}
                  จัดอันดับจากหลักฐานรายงานที่ผ่านการตรวจสอบเท่านั้น
                </p>
              </div>
              <Button
                variant='ghost'
                size='icon'
                aria-label='ปิด'
                onClick={() => setOpen(false)}
                className='-me-1 size-9 shrink-0 rounded-(--nav-radius)'
              >
                <Icons.close />
              </Button>
            </header>

            <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4'>
              {isPending && (
                <div className='space-y-2'>
                  <Skeleton className='h-20 w-full rounded-xl' />
                  <Skeleton className='h-20 w-full rounded-xl' />
                </div>
              )}
              {isError && (
                <p className='text-muted-foreground text-[0.8125rem]'>โหลดข้อมูลอันดับพื้นที่ไม่สำเร็จ</p>
              )}
              {!isPending && !isError && areas.length === 0 && (
                <p className='text-muted-foreground text-[0.8125rem]'>
                  ยังไม่มีเหตุการณ์ที่ผ่านการประมวลผลข่าวกรองในระบบ
                </p>
              )}
              <ul className='space-y-2'>
                {areas.map((area) => (
                  <AreaCard key={area.slug} area={area} onFly={onFly} />
                ))}
              </ul>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
