'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sourcesSummaryQueryOptions } from '@/features/sources/api/queries';
import type { LatestRun, RecentRun, SourceStatus } from '@/features/sources/api/types';

const THAI_DATETIME = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const THAI_TIME = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_DATETIME.format(date);
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : THAI_TIME.format(date);
}

function RunStatusBadge({ status, isStale }: { status: LatestRun['status']; isStale?: boolean }) {
  if (isStale || status === 'RUNNING') {
    return (
      <span className='bg-status-pending/10 text-status-pending inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
        <span className='size-1.5 rounded-full bg-current' aria-hidden />
        {isStale ? 'สถานะไม่สมบูรณ์' : 'กำลังทำงาน'}
      </span>
    );
  }
  if (status === 'SUCCEEDED') {
    return (
      <span className='bg-status-verified/10 text-status-verified inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
        <span className='size-1.5 rounded-full bg-current' aria-hidden />
        ทำงานปกติ
      </span>
    );
  }
  return (
    <span className='bg-status-rejected/10 text-status-rejected inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
      <span className='size-1.5 rounded-full bg-current' aria-hidden />
      {status === 'PARTIAL' ? 'บางส่วนไม่สำเร็จ' : 'ไม่สำเร็จ'}
    </span>
  );
}

function SourceStatusPill({ status }: { status: SourceStatus['status'] }) {
  if (status === 'OK') {
    return (
      <span className='bg-status-verified/10 text-status-verified inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
        <Icons.check className='size-3.5' aria-hidden />
        ตรวจสอบแล้ว
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span className='bg-status-rejected/10 text-status-rejected inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
        <Icons.alertCircle className='size-3.5' aria-hidden />
        อัปเดตล่าสุดไม่สำเร็จ
      </span>
    );
  }
  return (
    <span className='text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium'>
      ยังไม่มีการตรวจสอบ
    </span>
  );
}

// --- Latest refresh status ---------------------------------------------------
function LatestRefresh({ latestRun }: { latestRun: LatestRun | null }) {
  if (!latestRun) {
    return (
      <section className='border-border rounded-xl border px-5 py-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-[1.0625rem] font-semibold tracking-tight'>อัปเดตล่าสุด</h2>
            <p className='text-muted-foreground mt-1 text-[0.875rem]'>ยังไม่มีประวัติการอัปเดตอัตโนมัติ</p>
          </div>
          <p className='text-muted-foreground text-[0.8125rem]'>อัปเดตอัตโนมัติประมาณทุก 6 ชั่วโมง</p>
        </div>
      </section>
    );
  }

  return (
    <section className='border-border rounded-xl border px-5 py-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <div className='flex flex-wrap items-center gap-2.5'>
            <h2 className='text-[1.0625rem] font-semibold tracking-tight'>อัปเดตล่าสุด</h2>
            <RunStatusBadge status={latestRun.status} isStale={latestRun.isStale} />
          </div>
          <p className='text-muted-foreground mt-1.5 text-[0.9375rem]'>
            {formatDateTime(latestRun.finishedAt ?? latestRun.startedAt)}
          </p>
        </div>
        <p className='text-muted-foreground text-[0.8125rem]'>อัปเดตอัตโนมัติประมาณทุก 6 ชั่วโมง</p>
      </div>

      <dl className='mt-5 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4'>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ข้อมูลใหม่</dt>
          <dd className='mt-0.5 text-lg font-semibold tabular-nums'>{latestRun.createdCount}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ข้ามข้อมูลซ้ำ</dt>
          <dd className='mt-0.5 text-lg font-semibold tabular-nums'>{latestRun.skippedCount}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ประมวลผลแล้ว</dt>
          <dd className='mt-0.5 text-lg font-semibold tabular-nums'>{latestRun.processedCount}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ใช้เวลาทั้งหมด</dt>
          <dd className='mt-0.5 text-lg font-semibold tabular-nums'>
            {latestRun.durationMs !== null
              ? `${(latestRun.durationMs / 1000).toFixed(1)} วินาที`
              : '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// --- Source cards -------------------------------------------------------------
function SourceCard({ source }: { source: SourceStatus }) {
  return (
    <article className='border-border flex flex-col gap-4 rounded-xl border p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h3 className='text-[1.0625rem] font-semibold tracking-tight'>{source.label}</h3>
          <p className='text-muted-foreground mt-0.5 text-[0.8125rem]'>{source.category}</p>
        </div>
        <SourceStatusPill status={source.status} />
      </div>

      <dl className='grid grid-cols-2 gap-x-4 gap-y-4 text-[0.875rem]'>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ตรวจสอบล่าสุด</dt>
          <dd className='mt-0.5'>{formatTime(source.lastCheckedAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-[0.8125rem]'>ข้อมูลล่าสุด</dt>
          <dd className='mt-0.5'>{formatTime(source.lastNewObservationAt)}</dd>
        </div>
        <div className='col-span-2'>
          <dt className='text-muted-foreground text-[0.8125rem]'>จำนวนรายการในระบบ</dt>
          <dd className='mt-0.5 text-[1.0625rem] font-semibold tabular-nums'>
            {source.totalObservations.toLocaleString('th-TH')} รายการ
          </dd>
        </div>
      </dl>

      <p className='text-muted-foreground text-[0.8125rem] leading-relaxed'>
        {source.id === 'google-news-th'
          ? 'ข่าวสาธารณะภาษาไทยที่กล่าวถึงปลาหมอคางดำในฉะเชิงเทรา ชลบุรี และระยอง ผ่าน RSS Feed ของ Google News'
          : 'ชุดข้อมูลเปิดของภาครัฐที่เผยแพร่ผ่านพอร์ทัลข้อมูลเปิด data.go.th (CKAN API)'}
      </p>
    </article>
  );
}

// --- Pipeline visual ----------------------------------------------------------
const PIPELINE_STEPS = [
  { label: 'รับข้อมูล' },
  { label: 'ตรวจความเกี่ยวข้อง/ชนิดพันธุ์' },
  { label: 'ระบุตำแหน่ง' },
  { label: 'ตัดข้อมูลซ้ำ' },
  { label: 'เชื่อมโยงเหตุการณ์' },
  { label: 'จัดลำดับพื้นที่' }
];

function PipelineVisual() {
  return (
    <section>
      <h2 className='text-[1.0625rem] font-semibold tracking-tight'>ขั้นตอนการประมวลผล</h2>
      <p className='text-muted-foreground mt-1 text-[0.875rem]'>
        ข้อมูลจากแหล่งสาธารณะถูกนำมาประมวลผลเป็นลำดับขั้น ตามกฎที่ตรวจสอบย้อนกลับได้
      </p>
      <ol className='mt-5 grid gap-2 md:grid-cols-6'>
        {PIPELINE_STEPS.map((step, index) => (
          <li key={step.label} className='flex items-start gap-3 md:flex-col md:gap-0'>
            <div className='flex items-center gap-2 md:flex-col md:gap-1.5'>
              <span className='bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold tabular-nums'>
                {index + 1}
              </span>
              {index < PIPELINE_STEPS.length - 1 && (
                <Icons.chevronDown
                  className='text-muted-foreground/50 size-4 md:rotate-90'
                  aria-hidden
                />
              )}
            </div>
            <p className='pt-1.5 text-[0.8125rem] leading-snug font-medium md:text-center'>
              {step.label}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- Pipeline metrics ---------------------------------------------------------
function PipelineMetrics({
  pipeline
}: {
  pipeline: {
    externalObservations: number;
    processed: number;
    relevant: number;
    eventCandidates: number;
  };
}) {
  const metrics = [
    { label: 'ข้อมูลภายนอกทั้งหมด', value: pipeline.externalObservations },
    { label: 'ประมวลผลแล้ว', value: pipeline.processed },
    { label: 'เกี่ยวข้องกับระบบ', value: pipeline.relevant },
    { label: 'เหตุการณ์ที่เชื่อมโยงได้', value: pipeline.eventCandidates }
  ];
  return (
    <section>
      <h2 className='text-[1.0625rem] font-semibold tracking-tight'>ภาพรวมข้อมูล</h2>
      <dl className='mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {metrics.map((metric) => (
          <div key={metric.label} className='border-border rounded-xl border px-4 py-5'>
            <dt className='text-muted-foreground text-[0.8125rem]'>{metric.label}</dt>
            <dd className='mt-1 text-2xl font-semibold tabular-nums tracking-tight'>
              {metric.value.toLocaleString('th-TH')}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// --- Recent runs --------------------------------------------------------------
function RecentRuns({ runs }: { runs: RecentRun[] }) {
  return (
    <section>
      <h2 className='text-[1.0625rem] font-semibold tracking-tight'>รอบการอัปเดตล่าสุด</h2>
      {runs.length === 0 ? (
        <p className='text-muted-foreground mt-3 text-[0.875rem]'>ยังไม่มีประวัติการอัปเดตอัตโนมัติ</p>
      ) : (
        <div className='mt-4 overflow-x-auto'>
          <table className='w-full min-w-125 border-collapse text-[0.875rem]'>
            <thead>
              <tr className='border-border border-b text-start'>
                <th className='text-muted-foreground py-2.5 pr-4 text-start font-medium text-[0.8125rem]'>
                  เวลา
                </th>
                <th className='text-muted-foreground py-2.5 pr-4 text-start font-medium text-[0.8125rem]'>
                  สถานะ
                </th>
                <th className='text-muted-foreground py-2.5 pr-4 text-end font-medium text-[0.8125rem]'>
                  ข้อมูลใหม่
                </th>
                <th className='text-muted-foreground py-2.5 pr-4 text-end font-medium text-[0.8125rem]'>
                  ข้ามข้อมูลซ้ำ
                </th>
                <th className='text-muted-foreground py-2.5 text-end font-medium text-[0.8125rem]'>
                  ประมวลผล
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className='border-border border-b last:border-0'>
                  <td className='py-3 pr-4 whitespace-nowrap'>{formatTime(run.startedAt)}</td>
                  <td className='py-3 pr-4'>
                    <RunStatusBadge status={run.status} isStale={run.isStale} />
                  </td>
                  <td className='py-3 pr-4 text-end tabular-nums'>{run.createdCount}</td>
                  <td className='py-3 pr-4 text-end tabular-nums'>{run.skippedCount}</td>
                  <td className='py-3 text-end tabular-nums'>{run.processedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// --- Page shell ---------------------------------------------------------------
function SourcesSkeleton() {
  return (
    <div role='status' aria-label='กำลังโหลดสถานะแหล่งข้อมูล' className='space-y-10'>
      <Skeleton className='h-40 w-full rounded-xl' />
      <div className='grid gap-4 md:grid-cols-2'>
        <Skeleton className='h-52 w-full rounded-xl' />
        <Skeleton className='h-52 w-full rounded-xl' />
      </div>
      <Skeleton className='h-40 w-full rounded-xl' />
      <span className='sr-only'>กำลังโหลด…</span>
    </div>
  );
}

function SourcesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role='alert' className='border-border rounded-xl border px-6 py-12 text-center'>
      <span className='bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full'>
        <Icons.alertCircle className='size-6' aria-hidden />
      </span>
      <p className='mt-4 text-[1.0625rem] font-semibold'>ไม่สามารถโหลดสถานะแหล่งข้อมูลได้</p>
      <p className='text-muted-foreground mx-auto mt-1 max-w-sm text-[0.9375rem] leading-relaxed'>
        อาจเกิดจากการเชื่อมต่อขัดข้องชั่วคราว
      </p>
      <Button variant='outline' className='mt-5 h-11 px-5 text-[0.9375rem]' onClick={onRetry}>
        ลองอีกครั้ง
      </Button>
    </div>
  );
}

export function SourcesView() {
  const { data, isPending, isError, refetch } = useQuery(sourcesSummaryQueryOptions());

  if (isPending) return <SourcesSkeleton />;
  if (isError || !data) return <SourcesError onRetry={() => void refetch()} />;

  return (
    <div className='space-y-10'>
      <LatestRefresh latestRun={data.latestRun} />

      <section>
        <h2 className='text-[1.0625rem] font-semibold tracking-tight'>แหล่งข้อมูลที่ใช้ในปัจจุบัน</h2>
        <div className='mt-5 grid gap-4 md:grid-cols-2'>
          {data.sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))}
        </div>
      </section>

      <PipelineVisual />
      <PipelineMetrics pipeline={data.pipeline} />
      <RecentRuns runs={data.recentRuns} />

      <p className='text-muted-foreground max-w-2xl text-[0.8125rem] leading-relaxed'>
        ข้อมูลจากข่าวและแหล่งสาธารณะเป็นสัญญาณสำหรับการเฝ้าระวัง ไม่ใช่การยืนยันการพบทางชีววิทยาโดยอัตโนมัติ
      </p>

      <Button
        nativeButton={false}
        className='h-11 px-5 text-[0.9375rem]'
        render={<Link href='/map' aria-label='สำรวจบนแผนที่' />}
      >
        <Icons.map />
        สำรวจบนแผนที่
      </Button>
    </div>
  );
}
