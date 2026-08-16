'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { sourceRunsQueryOptions, sourcesSummaryQueryOptions } from '@/features/sources/api/queries';
import { formatClock, formatDuration, formatNumber } from '@/features/sources/lib/format';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/features/sources/api/types';

const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  RUNNING: 'กำลังทำงาน',
  SUCCEEDED: 'สำเร็จ',
  PARTIAL: 'บางส่วนไม่สำเร็จ',
  FAILED: 'ไม่สำเร็จ'
};

function RunStatusDot({ status, isStale }: { status: RunStatus; isStale?: boolean }) {
  const tone =
    isStale || status === 'RUNNING'
      ? 'bg-status-pending'
      : status === 'SUCCEEDED'
        ? 'bg-status-verified'
        : status === 'PARTIAL'
          ? 'bg-status-pending'
          : 'bg-status-rejected';
  return <span className={cn('size-1.5 shrink-0 rounded-full', tone)} aria-hidden />;
}

function RunStatusBadge({ status, isStale }: { status: RunStatus; isStale?: boolean }) {
  return (
    <span className='inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap'>
      <RunStatusDot status={status} isStale={isStale} />
      {isStale ? 'สถานะไม่สมบูรณ์' : RUN_STATUS_LABELS[status]}
    </span>
  );
}

// --- Recent runs rail (bounded, from the summary) ----------------------------
function RecentRunsRail() {
  const { data } = useQuery(sourcesSummaryQueryOptions());
  const runs = data?.recentRuns ?? [];
  const [historyOpen, setHistoryOpen] = React.useState(false);

  return (
    <div className='border-border rounded-2xl border bg-card'>
      <div className='border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4'>
        <div>
          <h3 className='text-[0.9375rem] font-semibold tracking-tight'>รอบการอัปเดตล่าสุด</h3>
          <p className='text-muted-foreground mt-0.5 text-[0.75rem]'>
            {data?.latestRun
              ? `อัปเดตล่าสุด ${formatClock(data.latestRun.finishedAt ?? data.latestRun.startedAt)} — ประมวลผลอัตโนมัติประมาณทุก 6 ชั่วโมง`
              : 'ยังไม่มีประวัติการอัปเดตอัตโนมัติ'}
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setHistoryOpen(true)}
          className='h-9 px-3.5 text-[0.875rem]'
        >
          <Icons.clock />
          ดูประวัติทั้งหมด
        </Button>
      </div>

      {runs.length === 0 ? (
        <p className='text-muted-foreground px-5 py-8 text-center text-[0.875rem]'>
          ยังไม่มีรอบการอัปเดต — รอรอบแรกจากระบบอัตโนมัติ
        </p>
      ) : (
        <ul className='divide-border divide-y'>
          {runs.map((run) => (
            <li key={run.id} className='flex items-center gap-4 px-5 py-3'>
              <span className='text-muted-foreground w-14 shrink-0 text-[0.8125rem] tabular-nums'>
                {formatClock(run.startedAt)}
              </span>
              <RunStatusBadge status={run.status} isStale={run.isStale} />
              <span className='text-muted-foreground hidden text-[0.8125rem] sm:inline'>
                {run.trigger === 'SCHEDULED' ? 'อัตโนมัติ' : 'ด้วยมือ'}
              </span>
              <span className='ml-auto flex items-center gap-4 text-[0.8125rem] tabular-nums whitespace-nowrap'>
                <span className='text-status-verified font-medium'>
                  +{formatNumber(run.createdCount)} ใหม่
                </span>
                <span className='text-muted-foreground'>{formatNumber(run.skippedCount)} ซ้ำ</span>
                <span className='text-muted-foreground hidden sm:inline'>
                  {formatDuration(run.durationMs)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <RunHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

// --- Full history (paginated, server-side) -----------------------------------
function RunHistorySheet({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');

  // Reset to the first page whenever the drawer reopens.
  React.useEffect(() => {
    if (open) {
      setPage(1);
      setStatus('');
    }
  }, [open]);

  const { data, isPending } = useQuery(
    sourceRunsQueryOptions({
      page,
      pageSize: 10,
      status: status || undefined
    })
  );

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='flex min-h-0 flex-col overflow-hidden'>
        <SheetHeader className='border-border border-b'>
          <SheetTitle>ประวัติรอบการอัปเดต</SheetTitle>
          <SheetDescription>ประวัติทั้งหมดแบบแบ่งหน้า — ระบบไม่โหลดทุกครั้งในคราวเดียว</SheetDescription>
        </SheetHeader>

        <div className='px-4 pt-3'>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? '');
              setPage(1);
            }}
          >
            <SelectTrigger size='sm' aria-label='กรองตามสถานะรอบ'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='start'>
              <SelectItem value=''>ทุกสถานะ</SelectItem>
              <SelectItem value='SUCCEEDED'>สำเร็จ</SelectItem>
              <SelectItem value='PARTIAL'>บางส่วนไม่สำเร็จ</SelectItem>
              <SelectItem value='FAILED'>ไม่สำเร็จ</SelectItem>
              <SelectItem value='RUNNING'>กำลังทำงาน</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4'>
          {isPending ? (
            <div role='status' aria-label='กำลังโหลดประวัติรอบ' className='space-y-3 pt-4'>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className='h-12 w-full rounded-xl' />
              ))}
              <span className='sr-only'>กำลังโหลด…</span>
            </div>
          ) : data && data.runs.length === 0 ? (
            <p className='text-muted-foreground py-10 text-center text-[0.875rem]'>
              ไม่มีรอบที่ตรงกับเงื่อนไข
            </p>
          ) : (
            <ul className='divide-border divide-y'>
              {data?.runs.map((run) => (
                <li key={run.id} className='py-3'>
                  <div className='flex items-center justify-between gap-3'>
                    <span className='text-[0.8125rem] font-medium tabular-nums'>
                      {formatClock(run.startedAt)}
                    </span>
                    <RunStatusBadge status={run.status} isStale={run.isStale} />
                  </div>
                  <div className='text-muted-foreground mt-1 flex items-center gap-3 text-[0.75rem] tabular-nums'>
                    <span>{run.trigger === 'SCHEDULED' ? 'อัตโนมัติ' : 'ด้วยมือ'}</span>
                    <span className='text-status-verified font-medium'>
                      +{formatNumber(run.createdCount)} ใหม่
                    </span>
                    <span>{formatNumber(run.skippedCount)} ซ้ำ</span>
                    <span>{formatDuration(run.durationMs)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className='border-border flex items-center justify-between gap-3 border-t px-4 py-3'>
          <p className='text-muted-foreground text-[0.8125rem] tabular-nums'>
            {formatNumber(data?.pagination.total ?? 0)} รอบทั้งหมด
          </p>
          <div className='flex items-center gap-1.5'>
            <Button
              variant='outline'
              size='icon-sm'
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label='หน้าก่อนหน้า'
            >
              <Icons.chevronLeft />
            </Button>
            <span className='text-muted-foreground px-1.5 text-[0.8125rem] tabular-nums'>
              หน้า {formatNumber(page)} / {formatNumber(totalPages)}
            </span>
            <Button
              variant='outline'
              size='icon-sm'
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              aria-label='หน้าถัดไป'
            >
              <Icons.chevronRight />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function OperationsPanel() {
  return (
    <section id='operations' aria-labelledby='operations-heading' className='scroll-mt-24'>
      <div className='max-w-2xl'>
        <p className='text-primary text-[0.8125rem] font-semibold tracking-wide uppercase'>
          ปฏิบัติการ
        </p>
        <h2
          id='operations-heading'
          className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'
        >
          ระบบทำงานอย่างโปร่งใส
        </h2>
        <p className='text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed'>
          ทุกรอบการอัปเดตบันทึกผลลัพธ์ต่อแหล่งข้อมูล — ว่ากันตามข้อมูลจริง ไม่มีตัวเลขแต่ง
        </p>
      </div>
      <div className='mt-6'>
        <RecentRunsRail />
      </div>
    </section>
  );
}
