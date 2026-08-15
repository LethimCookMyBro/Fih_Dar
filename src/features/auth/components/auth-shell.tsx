import Link from 'next/link';

import { Icons } from '@/components/icons';

/**
 * Shared frame for the Clerk sign-in / sign-up widgets. Providers are whatever
 * Clerk is configured with — nothing is rendered here that Clerk does not offer.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='grid min-h-svh lg:grid-cols-2'>
      <div className='bg-sidebar relative hidden flex-col justify-between overflow-hidden p-10 lg:flex'>
        <svg
          aria-hidden
          viewBox='0 0 500 500'
          className='text-primary/20 absolute -bottom-24 -start-16 size-[36rem]'
        >
          {[80, 140, 200, 260].map((r) => (
            <circle
              key={r}
              cx='250'
              cy='250'
              r={r}
              fill='none'
              stroke='currentColor'
              strokeWidth='1'
            />
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
        </svg>

        <Link
          href='/map'
          className='relative z-10 flex items-center gap-3 rounded-(--nav-radius) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none'
        >
          <span className='bg-primary text-primary-foreground flex size-(--brand-mark) items-center justify-center rounded-lg'>
            <Icons.radar className='size-(--nav-icon-lg)' aria-hidden />
          </span>
          <span className='text-sidebar-foreground text-xl font-semibold tracking-tight'>
            FihDar
          </span>
        </Link>

        <div className='text-sidebar-foreground relative z-10 max-w-md'>
          <p className='text-2xl leading-snug font-medium text-balance'>
            เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น
          </p>
          <p className='text-muted-foreground mt-4 text-[0.9375rem] leading-relaxed'>
            ระบบเฝ้าระวังทางน้ำภาคตะวันออก — ฉะเชิงเทรา ชลบุรี ระยอง
          </p>
        </div>
      </div>

      <div className='flex items-center justify-center px-4 py-10 sm:px-6 lg:p-10'>
        <div className='flex w-full max-w-md flex-col items-center gap-8'>
          <Link
            href='/map'
            className='flex items-center gap-2.5 rounded-(--nav-radius) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none lg:hidden'
          >
            <span className='bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg'>
              <Icons.radar className='size-(--nav-icon)' aria-hidden />
            </span>
            <span className='text-lg font-semibold tracking-tight'>FihDar</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
