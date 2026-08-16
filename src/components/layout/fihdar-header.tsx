'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { navGroups } from '@/config/nav-config';

const EXTRA_TITLES: Record<string, string> = { '/profile': 'โปรไฟล์' };

export function FihDarHeader() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const navTitle = navGroups
    .flatMap((group) => group.items)
    .find((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))?.title;
  const title = navTitle ?? EXTRA_TITLES[pathname] ?? 'FihDar';

  return (
    <header className='bg-background/85 sticky top-0 z-20 flex h-(--header-h) shrink-0 items-center justify-between gap-2 border-b px-3 backdrop-blur-md md:px-6'>
      <div className='flex min-w-0 items-center gap-2 md:gap-3'>
        {/* 44px touch target on mobile; the trigger opens the overlay drawer
            below md and collapses to the rail at md and up. */}
        <SidebarTrigger className='-ms-1 size-11 md:size-9 [&_svg]:size-(--nav-icon)' />

        {/* Below md the drawer is closed by default, so the top bar carries the
            brand. From md the sidebar shows it and the header shows page context. */}
        <Link
          href='/map'
          aria-label='FihDar'
          // h-11 so the brand is a full-height touch target on mobile, not a
          // 32px link the size of its icon.
          className='flex h-11 items-center gap-2 rounded-(--nav-radius) pe-1 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none md:hidden'
        >
          <span className='bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg'>
            <LogoMark className='size-(--nav-icon)' />
          </span>
          <span className='text-base font-semibold tracking-tight'>FihDar</span>
        </Link>

        <Separator
          orientation='vertical'
          className='hidden h-5 data-vertical:self-center md:block'
        />
        <span className='hidden truncate text-[0.9375rem] font-medium md:block'>{title}</span>
      </div>

      <div className='flex items-center gap-1'>
        {isLoaded && !isSignedIn && (
          <Button
            nativeButton={false}
            variant='ghost'
            className='h-11 px-4 text-[0.9375rem] md:h-9'
            render={<Link href='/auth/sign-in' aria-label='เข้าสู่ระบบ' />}
          >
            เข้าสู่ระบบ
          </Button>
        )}
        <ThemeModeToggle />
      </div>
    </header>
  );
}
