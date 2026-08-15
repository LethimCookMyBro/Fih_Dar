import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

const SOURCES = ['ข่าวออนไลน์', 'รายงานประชาชน', 'ข้อมูลภาคสนาม', 'ข้อมูลสาธารณะ'];

const STAGES = ['ตรวจหลักฐานชนิดพันธุ์', 'สกัดสถานที่', 'เชื่อมโยงรายงาน', 'จัดกลุ่มเหตุการณ์', 'จัดลำดับพื้นที่'];

/**
 * Left-panel storytelling visual: multi-source input → FihDar → structured
 * intelligence output. Static/CSS-only — no fabricated metrics, no per-frame
 * animation library.
 */
export function AuthVisual() {
  return (
    <div className='bg-sidebar relative hidden flex-col justify-between overflow-hidden p-10 lg:flex'>
      <RadarMotif />

      <Link
        href='/map'
        className='relative z-10 flex items-center gap-3 rounded-(--nav-radius) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none'
      >
        <span className='bg-primary text-primary-foreground flex size-(--brand-mark) items-center justify-center rounded-lg'>
          <Icons.radar className='size-(--nav-icon-lg)' aria-hidden />
        </span>
        <span className='text-sidebar-foreground text-xl font-semibold tracking-tight'>FihDar</span>
      </Link>

      <div className='relative z-10 flex flex-col items-center gap-5 py-6'>
        <ChipRow items={SOURCES} />

        <FlowArrow />

        <div className='relative flex items-center justify-center'>
          <span
            aria-hidden
            className='bg-primary/15 motion-safe:animate-pulse absolute size-20 rounded-full'
          />
          <span className='bg-primary text-primary-foreground relative flex size-14 items-center justify-center rounded-full shadow-lg'>
            <Icons.radar className='size-6' aria-hidden />
          </span>
        </div>

        <FlowArrow />

        <ChipRow items={STAGES} variant='outline' className='max-w-md' />
      </div>

      <div className='text-sidebar-foreground relative z-10 max-w-md'>
        <p className='text-2xl leading-snug font-medium text-balance'>
          FihDar — ระบบสารสนเทศเชิงพื้นที่เพื่อการเฝ้าระวังปลาหมอคางดำ
        </p>
        <p className='text-muted-foreground mt-4 text-[0.9375rem] leading-relaxed'>
          เปลี่ยนข้อมูลการพบที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจเชิงพื้นที่ได้ง่ายขึ้น
        </p>
      </div>
    </div>
  );
}

function ChipRow({
  items,
  variant = 'secondary',
  className
}: {
  items: string[];
  variant?: 'secondary' | 'outline';
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className ?? ''}`}>
      {items.map((item) => (
        <Badge
          key={item}
          variant={variant}
          className='h-auto px-3 py-1 text-[0.8125rem] font-normal'
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function FlowArrow() {
  return <Icons.chevronDown aria-hidden className='text-border size-4' strokeWidth={2.5} />;
}

/** Faint concentric rings + a slow sweep line. Purely decorative (aria-hidden). */
function RadarMotif() {
  return (
    <svg
      aria-hidden
      viewBox='0 0 500 500'
      className='text-primary/[0.08] pointer-events-none absolute -bottom-24 -start-16 size-[36rem]'
    >
      {[80, 140, 200, 260].map((r) => (
        <circle key={r} cx='250' cy='250' r={r} fill='none' stroke='currentColor' strokeWidth='1' />
      ))}
      <path
        d='M-20 330c90-28 140 22 220-6s150 18 320-16'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
      />
      <path
        d='M-20 390c110-30 160 20 250-8s160 16 300-18'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
      />
      <g className='motion-safe:animate-[spin_16s_linear_infinite] [transform-origin:250px_250px]'>
        <line x1='250' y1='250' x2='250' y2='10' stroke='currentColor' strokeWidth='1.5' />
      </g>
    </svg>
  );
}
