'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className='flex min-h-dvh flex-col items-center justify-center px-6 text-center'>
      <span className='text-muted-foreground/40 text-[8rem] leading-none font-extrabold'>404</span>
      <h2 className='mt-2 text-2xl font-semibold'>ไม่พบหน้าที่คุณกำลังมองหา</h2>
      <p className='text-muted-foreground mt-2 text-sm'>หน้านี้อาจถูกย้ายหรือไม่มีอยู่แล้ว</p>
      <div className='mt-8 flex justify-center gap-2'>
        <Button onClick={() => router.back()} variant='outline'>
          ย้อนกลับ
        </Button>
        <Button onClick={() => router.push('/map')}>กลับไปที่แผนที่</Button>
      </div>
    </div>
  );
}
