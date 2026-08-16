import Link from 'next/link';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

export function AboutStory() {
  return (
    <section className='mx-auto w-full max-w-4xl px-4 py-24 text-center sm:px-6 md:py-32 lg:px-8'>
      <p className='text-4xl leading-snug font-semibold tracking-tight text-balance md:text-6xl'>
        จาก <span className='text-muted-foreground'>&ldquo;พบที่ไหน&rdquo;</span>
        <br />
        ไปสู่ <span className='text-primary'>&ldquo;ควรเริ่มตรวจสอบตรงไหนก่อน&rdquo;</span>
      </p>
    </section>
  );
}

export function AboutTeam() {
  return (
    <section className='border-t'>
      <div className='mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6 md:py-24 lg:px-8'>
        <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
          ทีมผู้พัฒนา
        </p>
        <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-4xl'>ทีมนกพิราบก้าวร้าว</h2>
      </div>
    </section>
  );
}

export function AboutCta() {
  return (
    <section className='bg-muted/30 border-t'>
      <div className='mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8'>
        <h2 className='text-4xl font-semibold tracking-tight md:text-5xl'>สำรวจข้อมูลบนแผนที่</h2>
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <Button
            nativeButton={false}
            className='h-12 px-7 text-base'
            render={<Link href='/map' aria-label='สำรวจแผนที่' />}
          >
            <Icons.map />
            สำรวจแผนที่
          </Button>
          <Button
            nativeButton={false}
            variant='outline'
            className='h-12 px-7 text-base'
            render={<Link href='/report' aria-label='แจ้งการพบ' />}
          >
            <Icons.mapPinPlus />
            แจ้งการพบ
          </Button>
        </div>
        <a
          href='https://github.com/LethimCookMyBro/Fih_Dar/blob/main/docs/AI_USAGE_DISCLOSURE.md'
          target='_blank'
          rel='noopener noreferrer'
          className='text-muted-foreground mt-4 text-[0.8125rem] underline underline-offset-4 hover:text-foreground'
        >
          ข้อมูลการพัฒนาและความโปร่งใส
        </a>
      </div>
    </section>
  );
}
