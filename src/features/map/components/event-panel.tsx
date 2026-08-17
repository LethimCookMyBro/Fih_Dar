'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { formatAge, scoreTier } from '@/features/priority/components/priority-panel';
import type { PriorityArea } from '@/features/priority/api/types';
import { PRECISION_LABELS } from '@/features/sources/lib/format';
import { formatThaiDate } from '@/features/reports/lib/format';

interface EventPanelProps {
  event: PriorityArea | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[8rem_1fr] items-baseline gap-3 py-2.5'>
      <dt className='text-muted-foreground text-[0.8125rem]'>{label}</dt>
      <dd className='min-w-0 text-[0.9375rem] break-words'>{value}</dd>
    </div>
  );
}

export function EventPanel({ event, onClose }: EventPanelProps) {
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (!event) return;
    const onKey = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  const tier = event ? scoreTier(event.score) : null;

  return (
    <AnimatePresence>
      {event && tier && (
        <motion.aside
          key={event.slug}
          role='dialog'
          aria-modal='false'
          aria-label={`รายละเอียดเหตุการณ์ ${event.areaLabel}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className={[
            'bg-background absolute inset-x-0 bottom-0 z-20 flex max-h-[68svh] flex-col',
            'overflow-hidden rounded-t-2xl border-t shadow-lg',
            'md:inset-y-0 md:end-0 md:start-auto md:max-h-none md:w-96',
            'md:rounded-none md:rounded-s-2xl md:border-t-0 md:border-s'
          ].join(' ')}
        >
          <div className='flex shrink-0 justify-center pt-2 pb-1 md:hidden'>
            <span className='bg-border h-1 w-9 rounded-full' aria-hidden />
          </div>

          <header className='flex shrink-0 items-start justify-between gap-3 px-4 pt-2 pb-3 md:px-5 md:pt-5'>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-[0.8125rem]'>เหตุการณ์ที่เชื่อมโยง (ทดลอง)</p>
              <p className='truncate text-[0.9375rem] font-semibold'>{event.areaLabel}</p>
            </div>
            <Button
              variant='ghost'
              size='icon'
              aria-label='ปิดรายละเอียดเหตุการณ์'
              onClick={onClose}
              className='-me-1 size-11 shrink-0 rounded-(--nav-radius) md:size-9'
            >
              <Icons.close />
            </Button>
          </header>

          <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-5'>
            <div className='flex flex-wrap items-center gap-2'>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.75rem] font-semibold tabular-nums ${tier.badgeClass}`}
              >
                {tier.label} · {event.score}
              </span>
              <span className='bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[0.75rem]'>
                {PRECISION_LABELS[event.locationPrecision] ?? event.locationPrecision}
              </span>
            </div>

            <dl className='divide-border mt-4 divide-y'>
              {event.province && <Row label='จังหวัด' value={event.province} />}
              <Row
                label='ตรวจพบเมื่อ'
                value={event.eventDate ? formatThaiDate(event.eventDate) : 'ไม่ทราบวันที่'}
              />
              <Row label='อายุของสัญญาณ' value={formatAge(event.breakdown.recency.ageDays)} />
              <Row
                label='พิกัด'
                value={
                  <span className='font-mono text-[0.8125rem] tabular-nums'>
                    {event.coordinate?.latitude.toFixed(4)},{' '}
                    {event.coordinate?.longitude.toFixed(4)}
                  </span>
                }
              />
              <Row
                label='แหล่งอิสระยืนยัน'
                value={`${event.independentSourceCount} แหล่ง (${event.sources.join(', ')})`}
              />
            </dl>

            <div className='mt-4'>
              <p className='text-muted-foreground text-[0.8125rem] font-medium'>
                สัญญาณที่ประกอบเป็นเหตุการณ์นี้ ({event.members.length})
              </p>
              <ul className='mt-2 space-y-2'>
                {event.members.map((member) => (
                  <li key={member.sourceUrl} className='border-border rounded-lg border p-2.5'>
                    <a
                      href={member.sourceUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-start gap-1.5 text-[0.8125rem] leading-snug hover:underline'
                    >
                      <Icons.externalLink className='mt-0.5 size-3.5 shrink-0' aria-hidden />
                      <span>
                        <span className='font-medium'>{member.sourceName}</span>
                        {': '}
                        {member.title}
                        {member.isDuplicate && (
                          <span className='text-muted-foreground'> (ซ้ำ — เชื่อมกับรายการหลัก)</span>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <p className='text-muted-foreground bg-muted/50 mt-5 rounded-xl p-3 text-[0.8125rem] leading-relaxed'>
              เหตุการณ์นี้จัดกลุ่มมาจากสัญญาณข่าว/ข้อมูลภายนอกที่ผ่านการประมวลผลข่าวกรอง —
              เป็นสถานะทดลองสำหรับการเฝ้าระวัง ไม่ใช่การยืนยันการพบทางชีววิทยา
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
