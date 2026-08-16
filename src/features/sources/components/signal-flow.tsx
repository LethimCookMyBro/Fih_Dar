'use client';

import * as React from 'react';

import { Icons } from '@/components/icons';

/**
 * SIGNAL FLOW — the one signature visual motif of /sources.
 *
 * PUBLIC SOURCES → SIGNAL CORE → EVENTS → PRIORITY/MAP, drawn as connected
 * SVG paths with small pulses travelling downstream. The motion communicates
 * "information is moving through the system"; it is a pipeline visualization,
 * never a claim of live ingestion. Pulses are SMIL <animateMotion> (native,
 * perfectly aligned at any scale) and are removed entirely under
 * prefers-reduced-motion.
 */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

const NODE_LABELS = [
  { y: 14, label: 'ข้อมูลจากหลายแหล่ง' },
  { y: 148, label: 'FihDar Signal Core' },
  { y: 282, label: 'เหตุการณ์' },
  { y: 404, label: 'พื้นที่ที่ควรได้รับความสนใจ' }
];

const PATHS = [
  'M210 74 C210 104 210 114 210 142',
  'M210 208 C210 238 210 248 210 276',
  'M210 342 C210 366 210 378 210 396'
];

function Pulse({ d, begin, color }: { d: string; begin: string; color: string }) {
  return (
    <circle r='3.5' fill={color} opacity='0.9'>
      <animateMotion
        dur='4.5s'
        begin={begin}
        repeatCount='indefinite'
        path={d}
        keyPoints='0;1'
        keyTimes='0;1'
      />
    </circle>
  );
}

export function SignalFlow() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className='relative'>
      <svg
        viewBox='0 0 420 452'
        role='img'
        aria-label='แผนภาพการไหลของข้อมูล: แหล่งข้อมูลสาธารณะ เข้าสู่ระบบประมวลผล เกิดเป็นเหตุการณ์ และจัดลำดับพื้นที่ที่ควรได้รับความสนใจ'
        className='h-auto w-full'
      >
        <defs>
          <marker
            id='sf-arrow'
            viewBox='0 0 10 10'
            refX='8'
            refY='5'
            markerWidth='7'
            markerHeight='7'
            orient='auto-start-reverse'
          >
            <path d='M 0 0 L 10 5 L 0 10 z' fill='var(--border)' />
          </marker>
        </defs>

        {/* connecting paths */}
        {PATHS.map((d) => (
          <path
            key={d}
            d={d}
            fill='none'
            stroke='var(--border)'
            strokeWidth='1.5'
            strokeDasharray='4 5'
            markerEnd='url(#sf-arrow)'
          />
        ))}

        {/* pulses — only when the user has not asked for reduced motion */}
        {!reduced && (
          <g>
            <Pulse d={PATHS[0]} begin='0s' color='var(--primary)' />
            <Pulse d={PATHS[0]} begin='1.8s' color='var(--primary)' />
            <Pulse d={PATHS[1]} begin='0.9s' color='var(--primary)' />
            <Pulse d={PATHS[1]} begin='2.7s' color='var(--primary)' />
            <Pulse d={PATHS[2]} begin='1.5s' color='var(--brand)' />
            <Pulse d={PATHS[2]} begin='3.3s' color='var(--brand)' />
          </g>
        )}

        {/* nodes */}
        {NODE_LABELS.map((node, index) => {
          const isFirst = index === 0;
          const isLast = index === NODE_LABELS.length - 1;
          const x = 110;
          const width = 200;
          return (
            <g key={node.label}>
              <rect
                x={x}
                y={node.y}
                width={width}
                height={isLast ? 40 : 60}
                rx='14'
                fill={isFirst ? 'var(--card)' : isLast ? 'var(--accent)' : 'var(--card)'}
                stroke={isLast ? 'var(--primary)' : 'var(--border)'}
                strokeWidth={isLast ? 1.5 : 1}
              />
              <text
                x={210}
                y={node.y + 26}
                textAnchor='middle'
                fontSize='14'
                fontWeight='600'
                fill='var(--foreground)'
              >
                {node.label}
              </text>
              {!isLast && index !== 2 && (
                <text
                  x={210}
                  y={node.y + 46}
                  textAnchor='middle'
                  fontSize='10.5'
                  fill='var(--muted-foreground)'
                >
                  {index === 0 ? 'ข่าว • ข้อมูลเปิด • ข้อมูลพลเมือง' : 'ตรวจสอบ • เชื่อมโยง • จัดลำดับ'}
                </text>
              )}
            </g>
          );
        })}

        {/* source mini-labels under the first node */}
        <text x={210} y={92} textAnchor='middle' fontSize='9' fill='var(--muted-foreground)'>
          Google News · data.go.th · iNaturalist
        </text>
        <text x={210} y={105} textAnchor='middle' fontSize='9' fill='var(--muted-foreground)'>
          มติชน · ข่าวสด · ประชาชาติธุรกิจ
        </text>

        {/* event glyph */}
        <g transform='translate(116, 300)' aria-hidden>
          <Icons.circlesRelation className='size-5 text-primary' />
        </g>
        {/* priority glyph */}
        <g transform='translate(116, 420)' aria-hidden>
          <Icons.flag className='size-5 text-brand' />
        </g>
      </svg>
    </div>
  );
}
