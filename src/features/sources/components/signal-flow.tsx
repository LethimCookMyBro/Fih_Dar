'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { sourcesSummaryQueryOptions } from '@/features/sources/api/queries';
import { priorityAreasQueryOptions } from '@/features/priority/api/queries';
import { formatNumber } from '@/features/sources/lib/format';

/**
 * SIGNAL FLOW — the /sources hero's compact pipeline summary. Every count is
 * read live from the same DB-backed endpoints as the rest of the page
 * (React Query cache-shared with IntelligenceJourney/HeroMetrics — no extra
 * fetch). Height comes from flexbox, not hand-placed coordinates, so the
 * connector between stages always meets the icon it points at regardless of
 * how many lines a label wraps to. Each row links to where that stage is
 * actually explorable.
 */

interface FlowStage {
  icon: keyof typeof Icons;
  label: string;
  metric: number | null;
  metricLabel: string;
  href: string;
}

export function SignalFlow() {
  const { data: summary, isPending: summaryPending } = useQuery(sourcesSummaryQueryOptions());
  const { data: priority, isPending: priorityPending } = useQuery(priorityAreasQueryOptions());

  if (summaryPending || priorityPending || !summary) {
    return (
      <div className='space-y-5 py-1'>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className='flex items-center gap-3'>
            <Skeleton className='size-9 shrink-0 rounded-full' />
            <Skeleton className='h-8 flex-1' />
          </div>
        ))}
      </div>
    );
  }

  const stages: FlowStage[] = [
    {
      icon: 'database',
      label: 'แหล่งข้อมูล',
      metric: summary.sources.length,
      metricLabel: `${formatNumber(summary.pipeline.externalObservations)} รายการที่รับเข้า`,
      href: '#sources'
    },
    {
      icon: 'filter',
      label: 'สัญญาณที่เกี่ยวข้อง',
      metric: summary.pipeline.relevant,
      metricLabel: 'ผ่านการตรวจสอบความเกี่ยวข้องแล้ว',
      href: '#journey'
    },
    {
      icon: 'circlesRelation',
      label: 'เหตุการณ์',
      metric: summary.pipeline.eventCandidates,
      metricLabel: 'เชื่อมโยงจากสัญญาณที่เกี่ยวข้อง (ทดลอง)',
      href: '#journey'
    },
    {
      icon: 'flag',
      label: 'พื้นที่ที่ควรได้รับความสนใจ',
      metric: priority?.areas.length ?? null,
      metricLabel: 'จัดลำดับจากเหตุการณ์ (ทดลอง)',
      href: '/map'
    }
  ];

  return (
    <ol aria-label='ภาพรวมสายข้อมูล พร้อมตัวเลขจริงจากฐานข้อมูล'>
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const Icon = Icons[stage.icon];
        return (
          <li key={stage.label} className='flex gap-3'>
            <div className='flex flex-col items-center'>
              <span
                className='border-border bg-card text-primary flex size-9 shrink-0 items-center justify-center rounded-full border'
                aria-hidden
              >
                <Icon className='size-4' />
              </span>
              {!isLast && (
                <span
                  aria-hidden
                  className='border-border my-1 w-px flex-1 border-l border-dashed'
                />
              )}
            </div>
            <Link
              href={stage.href}
              className={cn(
                'group -ms-1 flex flex-1 items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                isLast ? 'pb-1.5' : 'pb-5'
              )}
            >
              <span className='min-w-0'>
                <span className='block text-[0.875rem] font-semibold'>{stage.label}</span>
                <span className='text-muted-foreground block text-[0.75rem] leading-snug'>
                  {stage.metricLabel}
                </span>
              </span>
              <span className='text-primary shrink-0 text-lg font-semibold tabular-nums'>
                {stage.metric === null ? '—' : formatNumber(stage.metric)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
