'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { signalTraceQueryOptions } from '@/features/sources/api/queries';
import { PRECISION_LABELS, formatDateTime } from '@/features/sources/lib/format';
import { cn } from '@/lib/utils';
import type { SignalTrace } from '@/features/sources/api/types';

const SOURCE_LABELS: Record<string, string> = {
  'google-news-th': 'Google News RSS',
  'data.go.th': 'data.go.th',
  inaturalist: 'iNaturalist',
  matichon: 'มติชน',
  khaosod: 'ข่าวสด',
  prachachat: 'ประชาชาติธุรกิจ'
};

const STAGES = [
  { id: 'source', icon: 'rss', label: 'แหล่งข้อมูล' },
  { id: 'species', icon: 'fish', label: 'ชนิดพันธุ์' },
  { id: 'relevance', icon: 'filter', label: 'ความเกี่ยวข้อง' },
  { id: 'location', icon: 'mapPin', label: 'ตำแหน่ง' },
  { id: 'dedupe', icon: 'copy', label: 'ข้อมูลซ้ำ' },
  { id: 'event', icon: 'circlesRelation', label: 'เหตุการณ์' },
  { id: 'priority', icon: 'route', label: 'ลำดับความสำคัญ' }
] as const;

type StageId = (typeof STAGES)[number]['id'];

function EvidenceRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='border-border grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4'>
      <dt className='text-muted-foreground text-[0.75rem] font-semibold tracking-wide uppercase'>
        {title}
      </dt>
      <dd className='text-[0.9375rem] leading-relaxed'>{children}</dd>
    </div>
  );
}

function KeywordScores({ scores }: { scores: Record<string, number> }) {
  const top = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  if (top.length === 0) return <span className='text-muted-foreground'>ไม่มีคะแนนคำสำคัญ</span>;
  return (
    <ul className='space-y-1'>
      {top.map(([term, score]) => (
        <li key={term} className='flex items-baseline justify-between gap-4'>
          <span>{term}</span>
          <span className='text-primary text-[0.8125rem] font-semibold tabular-nums'>
            {score.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StageEvidence({ stage, trace }: { stage: StageId; trace: SignalTrace }) {
  if (stage === 'source') {
    return (
      <dl>
        <EvidenceRow title='แหล่งที่มา'>
          {SOURCE_LABELS[trace.observation.sourceName] ?? trace.observation.sourceName}
        </EvidenceRow>
        <EvidenceRow title='เวลาที่เผยแพร่'>
          {formatDateTime(trace.observation.publishedAt)}
        </EvidenceRow>
        <EvidenceRow title='เวลาที่รับเข้า'>{formatDateTime(trace.observation.scrapedAt)}</EvidenceRow>
        <EvidenceRow title='หัวข้อดิบ'>
          <span className='font-medium'>{trace.observation.title}</span>
        </EvidenceRow>
        <EvidenceRow title='ลิงก์ต้นทาง'>
          <a
            href={trace.observation.sourceUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary inline-flex items-center gap-1.5 font-medium hover:underline'
          >
            เปิดแหล่งข้อมูลต้นทาง
            <Icons.externalLink className='size-3.5' aria-hidden />
          </a>
        </EvidenceRow>
      </dl>
    );
  }

  if (stage === 'species') {
    const terms = trace.species.terms;
    return (
      <dl>
        <EvidenceRow title='ผลตรวจชนิดพันธุ์'>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium',
              trace.species.evidence === 'RELEVANT'
                ? 'bg-status-verified/10 text-status-verified'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {trace.species.evidence === 'RELEVANT' ? 'พบชื่อชนิดพันธุ์เป้าหมาย' : trace.species.evidence}
          </span>
        </EvidenceRow>
        <EvidenceRow title='คำที่จับคู่ได้'>
          {terms.length > 0 ? terms.join(' · ') : <span className='text-muted-foreground'>—</span>}
        </EvidenceRow>
        <EvidenceRow title='ข้อควรเข้าใจ'>
          Species Gate เป็นการตรวจข้อความ ไม่ใช่การยืนยันทางชีววิทยา
        </EvidenceRow>
      </dl>
    );
  }

  if (stage === 'relevance') {
    const verdict = trace.relevance.finalVerdict ?? null;
    return (
      <dl>
        <EvidenceRow title='คำตัดสินสุดท้าย'>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium',
              verdict?.verdict === 'RELEVANT' || trace.relevance.verdict === 'RELEVANT'
                ? 'bg-status-verified/10 text-status-verified'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {verdict?.verdict ?? trace.relevance.verdict ?? '—'}
          </span>
        </EvidenceRow>
        {verdict?.reason && <EvidenceRow title='เหตุผล'>{verdict.reason}</EvidenceRow>}
        {trace.relevance.keywordScores && (
          <EvidenceRow title='คะแนนคำสำคัญ'>
            <KeywordScores scores={trace.relevance.keywordScores} />
          </EvidenceRow>
        )}
        {trace.relevance.semantic && (
          <EvidenceRow title='การจัดกลุ่มความหมาย'>
            {trace.relevance.semantic.bestKind ?? '—'} (
            {trace.relevance.semantic.bestScore !== undefined
              ? trace.relevance.semantic.bestScore.toFixed(2)
              : '—'}
            )
          </EvidenceRow>
        )}
        <EvidenceRow title='ข้อควรเข้าใจ'>
          “เกี่ยวข้อง” หมายถึงเกี่ยวข้องกับเรื่องปลาหมอคางดำ ไม่ได้ยืนยันการพบจริง
        </EvidenceRow>
      </dl>
    );
  }

  if (stage === 'location') {
    const loc = trace.location;
    const parts = [loc.province, loc.district, loc.subdistrict, loc.waterbody].filter(Boolean);
    return (
      <dl>
        <EvidenceRow title='สถานที่ที่ระบุ'>
          {parts.length > 0 ? (
            parts.join(' › ')
          ) : (
            <span className='text-muted-foreground'>ยังไม่ระบุ</span>
          )}
        </EvidenceRow>
        <EvidenceRow title='ความแม่นยำ'>
          {PRECISION_LABELS[loc.precision] ?? loc.precision}
        </EvidenceRow>
        <EvidenceRow title='พิกัด'>
          {loc.latitude !== null && loc.longitude !== null ? (
            <span className='tabular-nums'>
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </span>
          ) : (
            <span className='text-muted-foreground'>ไม่มีพิกัดจากแหล่งข้อมูล — FihDar ไม่สร้างพิกัดขึ้นเอง</span>
          )}
        </EvidenceRow>
        {loc.evidence.matched.length > 0 && (
          <EvidenceRow title='ชื่อที่จับคู่ได้'>{loc.evidence.matched.join(' · ')}</EvidenceRow>
        )}
        {loc.evidence.fuzzy.length > 0 && (
          <EvidenceRow title='ชื่อที่จับคู่แบบใกล้เคียง'>{loc.evidence.fuzzy.join(' · ')}</EvidenceRow>
        )}
      </dl>
    );
  }

  if (stage === 'dedupe') {
    return (
      <dl>
        <EvidenceRow title='สถานะในระบบ'>
          {trace.dedupe.isDuplicate ? (
            <span className='inline-flex items-center gap-1.5 font-medium text-status-pending'>
              <Icons.copy className='size-4' aria-hidden />
              รายการซ้ำของ {trace.dedupe.duplicateOfId}
            </span>
          ) : (
            <span className='inline-flex items-center gap-1.5 font-medium text-status-verified'>
              <Icons.check className='size-4' aria-hidden />
              เป็นรายการหลักของกลุ่มข้อมูลซ้ำ
            </span>
          )}
        </EvidenceRow>
        <EvidenceRow title='เหตุผลที่ต้องตรวจ'>
          ข่าวหลายชิ้นไม่จำเป็นต้องหมายถึงหลายเหตุการณ์ — ระบบจึงไม่นับข้อมูลซ้ำเป็นเหตุการณ์ใหม่
        </EvidenceRow>
      </dl>
    );
  }

  if (stage === 'event') {
    const event = trace.event;
    if (!event) {
      return (
        <dl>
          <EvidenceRow title='เหตุการณ์'>
            <span className='text-muted-foreground'>รายการนี้ยังไม่ถูกเชื่อมโยงเข้ากลุ่มเหตุการณ์</span>
          </EvidenceRow>
        </dl>
      );
    }
    return (
      <dl>
        <EvidenceRow title='รหัสเหตุการณ์'>
          <span className='font-mono text-[0.875rem]'>{event.slug}</span>
        </EvidenceRow>
        <EvidenceRow title='สถานะ'>{event.status}</EvidenceRow>
        <EvidenceRow title='ชนิด'>{event.kind ?? '—'}</EvidenceRow>
        <EvidenceRow title='จังหวัด'>{event.province ?? '—'}</EvidenceRow>
        <EvidenceRow title='วันที่เกิดเหตุการณ์'>{formatDateTime(event.eventDate)}</EvidenceRow>
        <EvidenceRow title='รายการที่ร่วมกลุ่ม'>
          {event.memberCount} รายการ (บทบาท: {event.role})
        </EvidenceRow>
        <EvidenceRow title='แหล่งข้อมูลที่ร่วมกันยืนยัน'>
          {event.sources.length > 0
            ? event.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' · ')
            : '—'}
        </EvidenceRow>
        <EvidenceRow title='ข้อควรเข้าใจ'>
          การเชื่อมกลุ่มเป็น “เหตุการณ์ที่อาจเชื่อมโยงกัน” ตามเวลากับสถานที่ — สถานะทดลอง ไม่ใช่การยืนยันการพบ
        </EvidenceRow>
      </dl>
    );
  }

  // priority
  const priority = trace.priority;
  if (!priority) {
    return (
      <dl>
        <EvidenceRow title='คะแนน'>
          <span className='text-muted-foreground'>ยังไม่มีคะแนนสำหรับรายการนี้</span>
        </EvidenceRow>
      </dl>
    );
  }
  const rows = [
    {
      label: 'ความใหม่ของข้อมูล',
      value: priority.breakdown.recency.score,
      detail:
        priority.breakdown.recency.ageDays === null
          ? 'ไม่มีวันที่เผยแพร่'
          : `ข้อมูลอายุ ${priority.breakdown.recency.ageDays.toFixed(1)} วัน`
    },
    {
      label: 'แหล่งอิสระยืนยัน',
      value: priority.breakdown.corroboration.score,
      detail: `${priority.independentSourceCount} แหล่งที่มาอิสระ`
    },
    {
      label: 'ความชัดเจนของตำแหน่ง',
      value: priority.breakdown.location.score,
      detail:
        PRECISION_LABELS[priority.breakdown.location.precision] ??
        priority.breakdown.location.precision
    }
  ];
  return (
    <dl>
      <EvidenceRow title='คะแนนรวม'>
        <span className='text-primary text-xl font-semibold tabular-nums'>
          {priority.score.toFixed(2)}
        </span>
        <span className='text-muted-foreground ml-2 text-[0.8125rem]'>
          Experimental Priority — เพื่อจัดลำดับพื้นที่ที่ควรได้รับความสนใจ
        </span>
      </EvidenceRow>
      {rows.map((row) => (
        <EvidenceRow key={row.label} title={row.label}>
          <span className='font-medium tabular-nums'>{row.value.toFixed(2)}</span>
          <span className='text-muted-foreground ml-2 text-[0.8125rem]'>{row.detail}</span>
        </EvidenceRow>
      ))}
      {priority.sources.length > 0 && (
        <EvidenceRow title='แหล่งข้อมูลในกลุ่ม'>
          {priority.sources.map((source) => SOURCE_LABELS[source] ?? source).join(' · ')}
        </EvidenceRow>
      )}
    </dl>
  );
}

function TraceSkeleton() {
  return (
    <div
      role='status'
      aria-label='กำลังโหลดหลักฐานสัญญาณ'
      className='grid gap-6 lg:grid-cols-[260px_1fr]'
    >
      <div className='space-y-2'>
        {STAGES.map((stage) => (
          <Skeleton key={stage.id} className='h-12 w-full rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-80 w-full rounded-2xl' />
      <span className='sr-only'>กำลังโหลด…</span>
    </div>
  );
}

function TraceEmpty() {
  return (
    <div className='border-border rounded-2xl border bg-card px-6 py-10 text-center'>
      <span className='bg-muted text-muted-foreground mx-auto flex size-11 items-center justify-center rounded-full'>
        <Icons.scan className='size-5' aria-hidden />
      </span>
      <h3 className='mt-4 text-[1.0625rem] font-semibold'>ยังไม่มีสัญญาณที่พร้อมแสดงหลักฐาน</h3>
      <p className='text-muted-foreground mx-auto mt-1 max-w-md text-[0.9375rem] leading-relaxed'>
        เมื่อรอบอัปเดตถัดไปประมวลผลข้อมูลที่เกี่ยวข้องเสร็จ จะแสดงรายการจริงรายการหนึ่ง พร้อมหลักฐานทุกขั้นตอนจากฐานข้อมูล
      </p>
    </div>
  );
}

export function SignalTrace() {
  const { data: trace, isPending } = useQuery(signalTraceQueryOptions());
  const [selected, setSelected] = React.useState<StageId>('source');

  return (
    <section id='trace' aria-labelledby='trace-heading' className='scroll-mt-24'>
      <div className='max-w-2xl'>
        <p className='text-primary text-[0.8125rem] font-semibold tracking-wide uppercase'>
          หลักฐานที่ตรวจสอบได้
        </p>
        <h2 id='trace-heading' className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'>
          จากข้อมูลหนึ่งรายการ ไปถึงเหตุการณ์บนแผนที่
        </h2>
        <p className='text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed'>
          ต่อไปนี้คือข้อมูลจริงจากฐานข้อมูลในรอบล่าสุด — กดแต่ละขั้นเพื่อดูหลักฐานที่บันทึกไว้ ไม่มีข้อมูลจำลอง
        </p>
      </div>

      {isPending ? (
        <div className='mt-10'>
          <TraceSkeleton />
        </div>
      ) : !trace ? (
        <div className='mt-10'>
          <TraceEmpty />
        </div>
      ) : (
        <div className='mt-10'>
          {/* Source document */}
          <article className='border-border relative overflow-hidden rounded-2xl border bg-card'>
            <div className='bg-primary/5 border-primary/20 border-l-2 p-5 sm:p-6'>
              <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem]'>
                <span className='inline-flex items-center gap-1.5 font-semibold'>
                  <Icons.rss className='text-primary size-4' aria-hidden />
                  {SOURCE_LABELS[trace.observation.sourceName] ?? trace.observation.sourceName}
                </span>
                <span className='text-muted-foreground'>
                  เผยแพร่ {formatDateTime(trace.observation.publishedAt)}
                </span>
                <span className='text-muted-foreground'>
                  รับเข้า {formatDateTime(trace.observation.scrapedAt)}
                </span>
              </div>
              <h3 className='mt-3 text-[1.125rem] leading-snug font-semibold tracking-tight text-balance'>
                {trace.observation.title}
              </h3>
              {trace.observation.description && (
                <p className='text-muted-foreground mt-2 max-w-3xl text-[0.875rem] leading-relaxed line-clamp-3'>
                  {trace.observation.description}
                </p>
              )}
              <div className='mt-4'>
                <a
                  href={trace.observation.sourceUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary inline-flex items-center gap-1.5 text-[0.8125rem] font-medium hover:underline'
                >
                  เปิดแหล่งข้อมูลต้นทาง
                  <Icons.externalLink className='size-3.5' aria-hidden />
                </a>
              </div>
            </div>
          </article>

          {/* Stages + evidence */}
          <div className='mt-8 grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10'>
            <ol className='relative space-y-1 lg:self-start' aria-label='ขั้นตอนของสัญญาณรายการนี้'>
              {STAGES.map((stage, index) => {
                const active = stage.id === selected;
                const Icon = Icons[stage.icon];
                return (
                  <li key={stage.id} className='relative'>
                    {index < STAGES.length - 1 && (
                      <span
                        aria-hidden
                        className='border-border absolute top-9 bottom-[-4px] left-[1.0625rem] border-l border-dashed'
                      />
                    )}
                    <button
                      type='button'
                      onClick={() => setSelected(stage.id)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl py-2.5 pr-3 pl-2 text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                        active ? 'bg-accent/70' : 'hover:bg-muted/50'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground'
                        )}
                      >
                        <Icon className='size-4' aria-hidden />
                      </span>
                      <span
                        className={cn(
                          'text-[0.9375rem] font-medium',
                          active ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {stage.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div
              className='border-border min-h-64 rounded-2xl border bg-card px-5 py-4 sm:px-6'
              aria-live='polite'
            >
              <AnimatePresence mode='wait' initial={false}>
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                >
                  <StageEvidence stage={selected} trace={trace} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <Button
              nativeButton={false}
              className='h-11 px-5 text-[0.9375rem]'
              render={<Link href='/map' aria-label='ดูเหตุการณ์บนแผนที่' />}
            >
              <Icons.map />
              ดูเหตุการณ์บนแผนที่
            </Button>
            <p className='text-muted-foreground max-w-md text-[0.8125rem] leading-relaxed'>
              ทุกขั้นตอนข้างต้นบันทึกเป็นข้อมูลจริง — ตรวจสอบย้อนกลับได้จากลิงก์แหล่งข้อมูลต้นทาง
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
