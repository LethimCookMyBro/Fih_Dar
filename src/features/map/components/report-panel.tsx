'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ReportStatusBadge } from '@/features/reports/components/report-status-badge';
import {
  LOCATION_PRECISION_LABELS,
  REPORT_QUANTITY_RANGE_LABELS,
  type Report
} from '@/features/reports/api/types';
import { formatThaiDate } from '@/features/reports/lib/format';

interface ReportPanelProps {
  report: Report | null;
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

export function ReportPanel({ report, onClose }: ReportPanelProps) {
  const reduceMotion = useReducedMotion();

  // Escape at the document level. The previous onKeyDown lived on the panel, so
  // it only fired while focus was inside it — pressing Escape after clicking the
  // map (the normal case) did nothing.
  React.useEffect(() => {
    if (!report) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [report, onClose]);

  return (
    <AnimatePresence>
      {report && (
        <motion.aside
          key={report.id}
          role='dialog'
          aria-modal='false'
          aria-label={`รายละเอียดรายงาน ${report.publicReference}`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className={[
            // Mobile: bottom sheet, scrollable, capped so the map stays usable.
            'bg-background absolute inset-x-0 bottom-0 z-20 flex max-h-[68svh] flex-col',
            'overflow-hidden rounded-t-2xl border-t shadow-lg',
            // Desktop: right-hand drawer, full height.
            'md:inset-y-0 md:end-0 md:start-auto md:max-h-none md:w-96',
            'md:rounded-none md:rounded-s-2xl md:border-t-0 md:border-s'
          ].join(' ')}
        >
          {/* Grab affordance — mobile only; signals the sheet is dismissible. */}
          <div className='flex shrink-0 justify-center pt-2 pb-1 md:hidden'>
            <span className='bg-border h-1 w-9 rounded-full' aria-hidden />
          </div>

          <header className='flex shrink-0 items-start justify-between gap-3 px-4 pt-2 pb-3 md:px-5 md:pt-5'>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-[0.8125rem]'>เลขอ้างอิง</p>
              <p className='truncate font-mono text-[0.9375rem] font-medium'>
                {report.publicReference}
              </p>
            </div>
            <Button
              variant='ghost'
              size='icon'
              aria-label='ปิดรายละเอียดรายงาน'
              onClick={onClose}
              className='-me-1 size-11 shrink-0 rounded-(--nav-radius) md:size-9'
            >
              <Icons.close />
            </Button>
          </header>

          <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-5'>
            <div className='flex flex-wrap items-center gap-2'>
              <ReportStatusBadge status={report.status} />
              {report.isSeedData && (
                <span className='bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[0.75rem]'>
                  ข้อมูลทดสอบระบบ
                </span>
              )}
            </div>

            <dl className='divide-border mt-4 divide-y'>
              <Row label='จังหวัด' value={report.province} />
              {report.district && <Row label='อำเภอ' value={report.district} />}
              {report.locationPrecision && report.locationPrecision !== 'EXACT' && (
                <Row
                  label='ความแม่นยำ'
                  value={
                    <span className='inline-flex items-center gap-1.5'>
                      <Icons.info className='size-3.5' aria-hidden />
                      {LOCATION_PRECISION_LABELS[report.locationPrecision] ??
                        report.locationPrecision}
                    </span>
                  }
                />
              )}
              <Row label='วันที่พบ' value={formatThaiDate(report.observedAt)} />
              <Row
                label='จำนวนโดยประมาณ'
                value={REPORT_QUANTITY_RANGE_LABELS[report.quantityRange] ?? report.quantityRange}
              />
              <Row
                label='พิกัดโดยประมาณ'
                value={
                  <span className='font-mono text-[0.8125rem] tabular-nums'>
                    {report.latitude.toFixed(3)}, {report.longitude.toFixed(3)}
                  </span>
                }
              />
            </dl>

            <p className='text-muted-foreground bg-muted/50 mt-5 rounded-xl p-3 text-[0.8125rem] leading-relaxed'>
              พิกัดที่แสดงต่อสาธารณะถูกลดความละเอียดลงเพื่อคุ้มครองความเป็นส่วนตัวของผู้แจ้ง และไม่มีการเปิดเผยตัวตนผู้แจ้ง
            </p>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
