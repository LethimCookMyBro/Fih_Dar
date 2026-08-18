'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { myReportsQueryOptions } from '@/features/reports/api/queries';
import {
  FIELD_OUTCOME_LABELS,
  REPORT_STATUS_LABELS,
  type Report,
  type ReportStatus
} from '@/features/reports/api/types';
import { formatThaiDate } from '@/features/reports/lib/format';
import { ReportStatusBadge } from './report-status-badge';

const COUNT_ORDER: { key: 'total' | ReportStatus; label: string }[] = [
  { key: 'total', label: 'รายงานทั้งหมด' },
  { key: 'PENDING', label: REPORT_STATUS_LABELS.PENDING },
  { key: 'VERIFIED', label: REPORT_STATUS_LABELS.VERIFIED },
  { key: 'REJECTED', label: REPORT_STATUS_LABELS.REJECTED }
];

function ReportCard({ report }: { report: Report }) {
  return (
    // Row in a bordered list, not a free-floating card — one border for the
    // whole list rather than one per item.
    <li className='hover:bg-muted/40 flex gap-4 p-3 transition-colors first:rounded-t-xl last:rounded-b-xl sm:p-4'>
      {report.imageUrl && (
        // Served through the authorised image route, never a filesystem path.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={report.imageUrl}
          alt={`ภาพประกอบรายงาน ${report.publicReference}`}
          loading='lazy'
          className='bg-muted size-20 shrink-0 rounded-xl object-cover'
        />
      )}
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex min-w-0 items-center gap-2'>
            <p className='truncate font-mono text-[0.9375rem] font-medium'>
              {report.publicReference}
            </p>
            {report.isSeedData && (
              <span className='bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem]'>
                ข้อมูลทดสอบระบบ
              </span>
            )}
          </div>
          <ReportStatusBadge status={report.status} />
        </div>
        <p className='text-muted-foreground mt-1.5 truncate text-[0.9375rem]'>
          {report.province}
          {report.district ? ` · ${report.district}` : ''}
        </p>
        <p className='text-muted-foreground mt-0.5 text-[0.8125rem]'>
          พบเมื่อ {formatThaiDate(report.observedAt)}
        </p>
        {/* Field-operation feedback — how the reporter learns what happened.
            Raw enum names are never shown; the outcome label + date are. */}
        {report.latestFieldAction && (
          <p className='text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[0.8125rem]'>
            <Icons.flag className='size-3.5 shrink-0' aria-hidden />
            เจ้าหน้าที่:{' '}
            {FIELD_OUTCOME_LABELS[report.latestFieldAction.outcome] ??
              report.latestFieldAction.outcome}
            <span aria-hidden>·</span>
            {formatThaiDate(report.latestFieldAction.createdAt)}
          </p>
        )}
      </div>
    </li>
  );
}

export function MyReports() {
  const { data, isPending, isError, refetch } = useQuery(myReportsQueryOptions());

  if (isPending) {
    return (
      <div role='status' aria-label='กำลังโหลดรายงานของฉัน' className='space-y-6'>
        <Skeleton className='h-[4.5rem] w-full rounded-xl' />
        <Skeleton className='h-40 w-full rounded-xl' />
        <span className='sr-only'>กำลังโหลด…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role='alert' className='border-border rounded-xl border px-6 py-10 text-center'>
        <span className='bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full'>
          <Icons.alertCircle className='size-6' aria-hidden />
        </span>
        <p className='mt-4 text-[1.0625rem] font-semibold'>โหลดรายงานของคุณไม่สำเร็จ</p>
        <Button
          variant='outline'
          className='mt-5 h-11 px-5 text-[0.9375rem]'
          onClick={() => void refetch()}
        >
          ลองอีกครั้ง
        </Button>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Counts are real values from /api/reports/me. Presented as one divided
          strip rather than four bordered metric cards — same information,
          without the dashboard-template silhouette. */}
      <dl className='border-border divide-border flex divide-x overflow-hidden rounded-xl border'>
        {COUNT_ORDER.map(({ key, label }) => (
          <div key={key} className='min-w-0 flex-1 px-3 py-3 text-center sm:px-4'>
            <dd className='text-xl font-semibold tabular-nums sm:text-2xl'>{data.counts[key]}</dd>
            <dt className='text-muted-foreground mt-0.5 truncate text-[0.75rem] sm:text-[0.8125rem]'>
              {label}
            </dt>
          </div>
        ))}
      </dl>

      {data.reports.length === 0 ? (
        <div className='border-border rounded-xl border border-dashed px-6 py-12 text-center'>
          <span className='bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full'>
            <Icons.fish className='size-6' aria-hidden />
          </span>
          <p className='mt-4 text-[1.0625rem] font-semibold'>คุณยังไม่มีรายงาน</p>
          <p className='text-muted-foreground mx-auto mt-1 max-w-xs text-[0.9375rem] leading-relaxed'>
            เมื่อพบปลาที่น่าสงสัย สามารถแจ้งเข้ามาได้ทันที
          </p>
          <Button
            nativeButton={false}
            className='mt-5 h-11 px-5 text-[0.9375rem]'
            render={<Link href='/report' aria-label='แจ้งการพบ' />}
          >
            <Icons.mapPinPlus />
            แจ้งการพบ
          </Button>
        </div>
      ) : (
        <ul className='divide-border border-border divide-y rounded-xl border'>
          {data.reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  );
}
