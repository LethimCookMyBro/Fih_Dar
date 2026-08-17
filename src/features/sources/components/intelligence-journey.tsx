'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { sourcesSummaryQueryOptions } from '@/features/sources/api/queries';
import { formatNumber } from '@/features/sources/lib/format';
import type { PipelineStats } from '@/features/sources/api/types';

type StageId = 'source' | 'relevance' | 'location' | 'dedupe' | 'event' | 'priority';

interface Stage {
  id: StageId;
  icon: keyof typeof Icons;
  label: string;
  description: string;
  metric?: (pipeline: PipelineStats) => number | null;
  metricLabel?: string;
  input: string;
  process: string;
  output: string;
}

const STAGES: Stage[] = [
  {
    id: 'source',
    icon: 'database',
    label: 'รับข้อมูล',
    description: 'ดึงข้อมูลจากแหล่งสาธารณะที่ลงทะเบียนไว้',
    metric: (p) => p.externalObservations,
    metricLabel: 'รายการที่รับเข้า',
    input: 'รายการจากฟีดข่าว / ข้อมูลเปิด / บันทึกจากพลเมือง',
    process: 'อ่านและเก็บข้อมูลดิบ พร้อมแหล่งที่มา เวลา และลิงก์ต้นทาง',
    output: 'ข้อมูลภายนอก (ExternalObservation) — ยังไม่ผ่านการตีความ'
  },
  {
    id: 'relevance',
    icon: 'filter',
    label: 'ตรวจความเกี่ยวข้อง',
    description: 'ตรวจชนิดพันธุ์และความเกี่ยวข้องของเนื้อหา',
    metric: (p) => p.relevant,
    metricLabel: 'รายการที่เกี่ยวข้อง',
    input: 'ข้อความจากแหล่งข้อมูล (หัวข้อ + รายละเอียด)',
    process: 'Species Gate (ปลาหมอคางดำ / S. melanotheron) + คะแนนความเกี่ยวข้อง',
    output: 'เกี่ยวข้อง / ไม่เกี่ยวข้อง / ไม่แน่ใจ — พร้อมเหตุผลที่ตรวจสอบได้'
  },
  {
    id: 'location',
    icon: 'mapPin',
    label: 'ระบุตำแหน่ง',
    description: 'จังหวัด / อำเภอ / ตำบล / แหล่งน้ำ',
    input: 'ชื่อสถานที่ที่ปรากฏในแหล่งข้อมูล',
    process: 'จับคู่ชื่อสถานที่กับฐานข้อมูลที่อยู่ของไทยอย่างกำหนดตายตัว',
    output: 'จังหวัด / อำเภอ / ตำบล / แหล่งน้ำ — ไม่สร้างพิกัดขึ้นเอง'
  },
  {
    id: 'dedupe',
    icon: 'copy',
    label: 'ตัดข้อมูลซ้ำ',
    description: 'ข่าวหลายชิ้นไม่จำเป็นต้องหมายถึงหลายเหตุการณ์',
    input: 'รายการที่เนื้อหาหรือสถานที่ใกล้เคียงกัน',
    process: 'Near-duplicate (MinHash/LSH + fuzzy) — ไม่ลบข้อมูลเดิม',
    output: 'รายการซ้ำชี้ไปยังรายการหลัก (canonical) เพื่อไม่ให้นับซ้ำ'
  },
  {
    id: 'event',
    icon: 'circlesRelation',
    label: 'เชื่อมเหตุการณ์',
    description: 'หลาย observations อาจอ้างถึงเหตุการณ์เดียวกัน',
    metric: (p) => p.eventCandidates,
    metricLabel: 'เหตุการณ์ที่เชื่อมโยง',
    input: 'observations ที่เกี่ยวข้องทั้งหมด',
    process: 'จับกลุ่มตามเวลา สถานที่ และเนื้อหา',
    output: 'EventCandidate — สถานะทดลอง ไม่ใช่การยืนยันการพบ'
  },
  {
    id: 'priority',
    icon: 'route',
    label: 'จัดลำดับพื้นที่',
    description: 'Experimental Priority — ประเมินพื้นที่ที่ควรได้รับความสนใจ',
    input: 'เหตุการณ์ที่เชื่อมโยงได้',
    process: 'คะแนนจากความใหม่ + แหล่งอิสระยืนยัน + ความชัดเจนของตำแหน่ง',
    output: 'คะแนนพร้อมเหตุผลประกอบ — ไม่ใช่การยืนยันทางชีววิทยา'
  }
];

function StageDetail({ stage, pipeline }: { stage: Stage; pipeline: PipelineStats }) {
  const rows: { title: string; body: string }[] = [
    { title: 'INPUT', body: stage.input },
    { title: 'PROCESS', body: stage.process },
    { title: 'OUTPUT', body: stage.output }
  ];
  const metric = stage.metric?.(pipeline) ?? null;
  return (
    <motion.div
      key={stage.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className='border-border mt-8 grid gap-6 rounded-2xl border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_1fr_1fr]'
    >
      {rows.map((row) => (
        <div key={row.title}>
          <p className='text-muted-foreground text-[0.6875rem] font-semibold tracking-widest uppercase'>
            {row.title}
          </p>
          <p className='mt-1.5 text-[0.9375rem] leading-relaxed'>{row.body}</p>
        </div>
      ))}
      {metric !== null && (
        <div className='border-border border-t pt-3 lg:col-span-3 lg:border-t-0 lg:pt-0'>
          <p className='text-muted-foreground text-[0.75rem] font-medium'>
            สถานะปัจจุบัน: {stage.metricLabel} {formatNumber(metric)}
          </p>
        </div>
      )}
    </motion.div>
  );
}

export function IntelligenceJourney() {
  const { data } = useQuery(sourcesSummaryQueryOptions());
  const [selected, setSelected] = React.useState<StageId>('relevance');
  const [highlight, setHighlight] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const pipeline = data?.pipeline ?? null;

  // Fired by the "ดูสายงานการประมวลผล" CTAs so a click always produces an
  // unmistakable result even when the URL is already at #journey (scrolling
  // there is otherwise silent — see scrollToJourney's doc comment).
  React.useEffect(() => {
    let timer: number | undefined;
    const onFocusRequest = () => {
      window.clearTimeout(timer);
      setHighlight(true);
      headingRef.current?.focus();
      timer = window.setTimeout(() => setHighlight(false), 1400);
    };
    window.addEventListener('fihdar:journey-focus', onFocusRequest);
    return () => {
      window.removeEventListener('fihdar:journey-focus', onFocusRequest);
      window.clearTimeout(timer);
    };
  }, []);

  const selectedStage = STAGES.find((stage) => stage.id === selected) ?? STAGES[0];

  return (
    <section id='journey' aria-labelledby='journey-heading' className='scroll-mt-24'>
      <div
        className={cn(
          '-m-3 max-w-2xl rounded-2xl p-3 transition-colors duration-700',
          highlight ? 'bg-primary/8' : 'bg-transparent'
        )}
      >
        <p className='text-primary text-[0.8125rem] font-semibold tracking-wide uppercase'>
          สายงานการประมวลผล
        </p>
        <h2
          id='journey-heading'
          ref={headingRef}
          tabIndex={-1}
          className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'
        >
          FihDar เปลี่ยนข้อมูลให้เป็นสัญญาณได้อย่างไร
        </h2>
        <p className='text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed'>
          ข้อมูลจากแหล่งสาธารณะถูกนำมาประมวลผลเป็นลำดับขั้นตามกฎที่ตรวจสอบย้อนกลับได้ —
          กดแต่ละขั้นเพื่อดูรายละเอียดว่าเกิดอะไรขึ้นจริง
        </p>
      </div>

      {/* Desktop — connected horizontal pipeline */}
      <ol
        className='mt-10 hidden items-start md:grid md:grid-cols-6 md:gap-3'
        aria-label='ขั้นตอนการประมวลผลทั้งหกขั้น'
      >
        {STAGES.map((stage, index) => {
          const active = stage.id === selected;
          const metric = pipeline && stage.metric ? stage.metric(pipeline) : null;
          const Icon = Icons[stage.icon];
          return (
            <li key={stage.id} className='relative'>
              {/* connecting line */}
              {index < STAGES.length - 1 && (
                <span
                  aria-hidden
                  className='border-border absolute top-5 left-[calc(50%+22px)] w-[calc(100%-44px)] border-t border-dashed'
                />
              )}
              <button
                type='button'
                onClick={() => setSelected(stage.id)}
                aria-pressed={active}
                className={cn(
                  'group flex w-full flex-col items-center gap-2 rounded-xl px-2 pt-1 pb-3 text-center transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                  active ? 'bg-accent/60' : 'hover:bg-muted/50'
                )}
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground group-hover:border-primary/40 group-hover:text-primary'
                  )}
                >
                  <Icon className='size-5' aria-hidden />
                </span>
                <span className='text-[0.8125rem] leading-snug font-semibold'>{stage.label}</span>
                <span className='text-muted-foreground text-[0.6875rem] leading-snug'>
                  {stage.description}
                </span>
                {metric !== null && (
                  <span className='text-primary text-[0.75rem] font-semibold tabular-nums'>
                    {formatNumber(metric)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile — vertical timeline */}
      <ol className='mt-8 space-y-1 md:hidden' aria-label='ขั้นตอนการประมวลผลทั้งหกขั้น'>
        {STAGES.map((stage) => {
          const active = stage.id === selected;
          const metric = pipeline && stage.metric ? stage.metric(pipeline) : null;
          return (
            <li key={stage.id} className='relative pl-9'>
              <span
                aria-hidden
                className='border-border absolute top-3 bottom-[-4px] left-4 w-px border-l border-dashed last:hidden'
              />
              <button
                type='button'
                onClick={() => setSelected(stage.id)}
                aria-pressed={active}
                aria-label={stage.label}
                className={cn(
                  'w-full rounded-xl py-2.5 pr-3 text-start transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                  active ? 'bg-accent/60' : 'hover:bg-muted/50'
                )}
              >
                <span className='flex items-center gap-3'>
                  <span
                    className={cn(
                      'absolute top-2 left-2.5 flex size-3.5 items-center justify-center rounded-full border',
                      active ? 'border-primary bg-primary' : 'border-border bg-card'
                    )}
                    aria-hidden
                  />
                  <span className='flex-1'>
                    <span className='flex items-baseline gap-2'>
                      <span className='text-[0.9375rem] font-semibold'>{stage.label}</span>
                      {metric !== null && (
                        <span className='text-primary text-[0.8125rem] font-semibold tabular-nums'>
                          {formatNumber(metric)}
                        </span>
                      )}
                    </span>
                    <span className='text-muted-foreground mt-0.5 block text-[0.8125rem] leading-snug'>
                      {stage.description}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode='wait' initial={false}>
        {pipeline && (
          <StageDetail key={selectedStage.id} stage={selectedStage} pipeline={pipeline} />
        )}
      </AnimatePresence>

      <p className='text-muted-foreground mt-4 text-[0.8125rem] leading-relaxed'>
        ตัวเลขทั้งหมดมาจากฐานข้อมูลจริงในรอบล่าสุด — ไม่มีตัวเลขจำลอง
      </p>
    </section>
  );
}
