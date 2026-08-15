import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'เกี่ยวกับ FihDar',
  description: 'FihDar เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น'
};

const STEPS = [
  {
    icon: 'mapPinPlus' as const,
    title: 'รับข้อมูล',
    body: 'ประชาชนแจ้งการพบพร้อมภาพถ่ายและรายละเอียดสถานที่ผ่านแบบฟอร์มเดียว'
  },
  {
    icon: 'target' as const,
    title: 'จัดเก็บพิกัด',
    body: 'ระบบบันทึกละติจูด/ลองจิจูดจริงของจุดที่พบ พร้อมวันเวลาที่สังเกตเห็น'
  },
  {
    icon: 'flask' as const,
    title: 'ตรวจสอบ',
    body: 'รายงานทุกฉบับเริ่มต้นที่สถานะ “กำลังตรวจสอบ” จนกว่าทีมงานจะยืนยัน'
  },
  {
    icon: 'map' as const,
    title: 'แสดงผลบนแผนที่',
    body: 'เฉพาะรายงานที่ยืนยันแล้วจึงถูกนำขึ้นแผนที่สาธารณะพร้อมพิกัดโดยประมาณ'
  }
];

/** Editorial section: a heading and prose, no card wrapper. Hierarchy comes
 *  from type scale and whitespace rather than from a border around everything. */
function Section({
  title,
  children,
  className
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className='text-xl font-semibold tracking-tight'>{title}</h2>
      <div className='mt-3 space-y-3'>{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className='mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14 lg:px-8'>
      {/* Masthead — typographic, not a hero card. Title sits at 30/36px:
          confident on an app screen without becoming landing-page scale. */}
      <header>
        <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
          Fish + Radar
        </p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl'>
          เกี่ยวกับ FihDar
        </h1>
        <p className='mt-4 text-lg leading-relaxed text-pretty'>
          เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น
        </p>
        <p className='text-muted-foreground mt-2 text-[0.9375rem] leading-relaxed'>
          เริ่มต้นเฝ้าระวังในพื้นที่ภาคตะวันออก — ฉะเชิงเทรา ชลบุรี และระยอง
        </p>

        <div className='mt-7 flex flex-wrap gap-3'>
          <Button
            nativeButton={false}
            className='h-11 px-5 text-[0.9375rem]'
            render={<Link href='/map' aria-label='ดูแผนที่' />}
          >
            <Icons.map />
            ดูแผนที่
          </Button>
          {/* Secondary action stays ghost — not every action needs a filled button. */}
          <Button
            nativeButton={false}
            variant='ghost'
            className='h-11 px-5 text-[0.9375rem]'
            render={<Link href='/report' aria-label='แจ้งการพบ' />}
          >
            <Icons.mapPinPlus />
            แจ้งการพบ
          </Button>
        </div>
      </header>

      <hr className='border-border my-10 md:my-12' />

      <Section title='ปัญหา'>
        <p className='text-muted-foreground leading-relaxed'>
          ข้อมูลการพบปลาต่างถิ่นมักกระจายอยู่ในหลายช่องทาง — โพสต์ในโซเชียล ข้อความในกลุ่มไลน์ รายงานปากเปล่า
          หรือแบบฟอร์มของแต่ละหน่วยงาน แต่ละแหล่งใช้รูปแบบต่างกัน ไม่มีพิกัดที่ชัดเจน
          และไม่สามารถนำมาต่อกันเป็นภาพเชิงพื้นที่ได้ ทำให้ยากที่จะเห็นว่าเรื่องเกิดขึ้นที่ไหน ใกล้แหล่งน้ำใด
          และควรลงพื้นที่ตรงจุดใดก่อน
        </p>
      </Section>

      <Section title='FihDar ทำงานอย่างไร' className='mt-10 md:mt-12'>
        {/* Numbered process, not metric cards. A single hairline separates the
            steps; the numeral carries the sequence. */}
        <ol className='divide-border border-border divide-y border-t'>
          {STEPS.map((step, index) => {
            const Icon = Icons[step.icon];
            return (
              <li key={step.title} className='flex gap-4 py-5'>
                <div className='flex shrink-0 flex-col items-center gap-2'>
                  <span className='bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-xl'>
                    <Icon className='size-(--nav-icon)' aria-hidden />
                  </span>
                  <span className='text-muted-foreground/70 font-mono text-[0.6875rem] tabular-nums'>
                    0{index + 1}
                  </span>
                </div>
                <div className='min-w-0 pt-1.5'>
                  <h3 className='text-[0.9375rem] font-semibold'>{step.title}</h3>
                  <p className='text-muted-foreground mt-1 text-[0.9375rem] leading-relaxed'>
                    {step.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title='เป้าหมาย' className='mt-10 md:mt-12'>
        <p className='text-muted-foreground leading-relaxed'>
          FihDar ทำหน้าที่เป็นชั้นข้อมูลเชิงพื้นที่ให้กับงานเฝ้าระวัง — รวบรวมสิ่งที่ประชาชนพบเห็นให้อยู่ในรูปแบบเดียวกัน
          ผูกกับพิกัดและเส้นทางน้ำจริง เพื่อให้ทีมภาคสนามเห็นภาพรวมได้เร็วขึ้นและเลือกลำดับการตรวจสอบได้ดีขึ้น
        </p>
        {/* Scope limits are load-bearing for trust — kept visually distinct
            from the aspirational paragraph above rather than buried in it. */}
        <p className='text-muted-foreground border-border border-s-2 ps-4 text-[0.9375rem] leading-relaxed'>
          ระบบนี้ไม่ได้ทำนายการแพร่กระจาย ไม่ได้ระบุชนิดปลาโดยอัตโนมัติ และไม่ได้สรุปข้อสรุปทางชีววิทยาใด ๆ —
          การยืนยันทุกกรณียังคงทำโดยผู้ตรวจสอบ
        </p>
      </Section>

      <Section title='ทีมงาน' className='mt-10 md:mt-12'>
        <p className='text-muted-foreground text-[0.9375rem] leading-relaxed'>
          ข้อมูลทีมงานจะเผยแพร่เมื่อพร้อม
        </p>
      </Section>
    </main>
  );
}
