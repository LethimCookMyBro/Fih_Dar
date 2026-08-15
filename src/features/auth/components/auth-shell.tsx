import Link from 'next/link';

import { Icons } from '@/components/icons';
import { AuthVisual } from './auth-visual';

/**
 * Shared frame for the Clerk sign-in / sign-up widgets. Providers are whatever
 * Clerk is configured with — nothing is rendered here that Clerk does not offer.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='grid min-h-svh lg:grid-cols-[56fr_44fr]'>
      <AuthVisual />

      <div className='bg-muted/30 flex items-center justify-center px-4 py-10 sm:px-6 lg:p-10'>
        <div className='flex w-full max-w-[440px] flex-col items-center gap-8'>
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
