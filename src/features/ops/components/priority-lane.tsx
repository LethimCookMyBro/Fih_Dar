'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatAge, scoreTier } from '@/features/priority/components/priority-panel';
import type { ConfidenceLevel, PriorityArea } from '@/features/priority/api/types';
import { priorityAreasQueryOptions } from '../api/queries';

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: 'สูง',
  MEDIUM: 'ปานกลาง',
  LOW: 'ต่ำ',
  UNKNOWN: 'ไม่ทราบ'
};

const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-muted-foreground',
  UNKNOWN: 'bg-border'
};

// Thai labels describe what each dimension actually measures — deliberately
// NOT "แหล่งที่มา" (provenance/origin) for sourceCorroboration, since that
// dimension is independent-source COUNT, not a chain-of-custody signal.
const DIMENSION_LABELS: Record<keyof PriorityArea['confidence'], string> = {
  species: 'หลักฐานชนิดปลา (heuristic)',
  location: 'ความแม่นยำตำแหน่ง',
  time: 'ความสดใหม่ของเวลา',
  sourceCorroboration: 'จำนวนแหล่งข่าวอิสระ'
};

function ConfidenceRow({ area }: { area: PriorityArea }) {
  const dims = Object.keys(DIMENSION_LABELS) as (keyof PriorityArea['confidence'])[];
  return (
    <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-[0.8125rem] sm:grid-cols-4'>
      {dims.map((dim) => (
        <div key={dim} className='flex items-center gap-1.5'>
          <span
            className={cn('size-2 shrink-0 rounded-full', CONFIDENCE_DOT[area.confidence[dim]])}
            aria-hidden
          />
          <dt className='text-muted-foreground'>{DIMENSION_LABELS[dim]}</dt>
          <dd className='font-medium'>{CONFIDENCE_LABELS[area.confidence[dim]]}</dd>
        </div>
      ))}
    </dl>
  );
}

function AreaRow({ area }: { area: PriorityArea }) {
  const tier = scoreTier(area.score);
  return (
    <li className='border-border rounded-xl border p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-[0.9375rem] font-semibold'>{area.areaLabel}</p>
          <p className='text-muted-foreground mt-0.5 text-[0.8125rem]'>
            {area.province ? `จ.${area.province} · ` : ''}
            {formatAge(area.breakdown.recency.ageDays)} · {area.independentSourceCount}{' '}
            กลุ่มหลักฐานต้นทาง
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold tabular-nums',
            tier.badgeClass
          )}
        >
          {tier.label} · {area.score}
        </span>
      </div>

      <div className='mt-3'>
        <ConfidenceRow area={area} />
      </div>

      <p className='text-muted-foreground mt-3 text-[0.8125rem] leading-relaxed'>
        เหตุผล: ความใหม่ {area.breakdown.recency.score}/100 · หลักฐานจากหลายแหล่ง{' '}
        {area.breakdown.corroboration.score}/100 ({area.independentSourceCount} กลุ่มหลักฐานต้นทาง —
        ข่าวที่คัดลอก/ Google News ไม่นับซ้ำ) · ตำแหน่ง {area.breakdown.location.score}/100 (
        {area.locationPrecision})
      </p>

      <Link
        href={`/map?event=${encodeURIComponent(area.slug)}`}
        className='text-brand mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium hover:underline'
      >
        <Icons.mapPin className='size-3.5' aria-hidden />
        ดูบนแผนที่
      </Link>
    </li>
  );
}

/**
 * Read-only intelligence-derived priority ranking (EventCandidate) — a
 * SEPARATE evidence lane from the citizen-report queue below. Citizen reports
 * are never linked into EventCandidate (docs/intelligence.md §18: "deliberately
 * deferred"), so this lane must never be presented as the same operational
 * entity as a citizen report — it is its own, independently-traceable
 * recommendation surface (RECOMMENDATION → EventCandidate → member
 * observations → source, all visible here and on /map).
 */
export function PriorityLane() {
  const { data, isPending, isError } = useQuery(priorityAreasQueryOptions());
  const areas = (data?.areas ?? []).slice(0, 15);

  return (
    <section className='space-y-3'>
      <div>
        <h2 className='text-[1.0625rem] font-semibold'>พื้นที่ที่ระบบข่าวกรองให้ความสำคัญ</h2>
        <p className='text-muted-foreground text-[0.8125rem]'>
          <span className='bg-brand/10 text-brand rounded-full px-1.5 py-0.5 font-medium'>
            ทดลอง (MVP)
          </span>{' '}
          จัดอันดับจากข่าว/ข้อมูลภายนอกที่ผ่านการประมวลผลข่าวกรองเท่านั้น — ยังไม่เชื่อมโยงกับรายงานจากประชาชนด้านล่าง
          จึงไม่มีปุ่มตัดสินใจปฏิบัติการที่นี่ — ใช้เพื่อประกอบการพิจารณาเท่านั้น
          <span className='mt-1 block'>
            ระดับหลักฐานด้านล่าง (สูง/ปานกลาง/ต่ำ/ไม่ทราบ) มาจากกฎที่กำหนดไว้แน่นอน —
            ไม่ใช่ความน่าจะเป็นทางสถิติที่ผ่านการปรับเทียบ และ &ldquo;หลักฐานชนิดปลา&rdquo;
            ไม่ใช่การยืนยันชนิดพันธุ์ในภาคสนาม
          </span>
        </p>
      </div>

      {isPending && (
        <div className='space-y-2'>
          <Skeleton className='h-32 w-full rounded-xl' />
          <Skeleton className='h-32 w-full rounded-xl' />
        </div>
      )}
      {isError && <p className='text-muted-foreground text-[0.8125rem]'>โหลดอันดับพื้นที่ไม่สำเร็จ</p>}
      {!isPending && !isError && areas.length === 0 && (
        <p className='text-muted-foreground border-border rounded-xl border border-dashed p-4 text-[0.8125rem]'>
          ยังไม่มีเหตุการณ์ที่ผ่านการประมวลผลข่าวกรองในระบบ
        </p>
      )}
      {areas.length > 0 && (
        <ul className='space-y-3'>
          {areas.map((area) => (
            <AreaRow key={area.slug} area={area} />
          ))}
        </ul>
      )}
    </section>
  );
}
