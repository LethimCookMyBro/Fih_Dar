'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';

import { LogoMark } from '@/components/brand/logo-mark';
import { AuthVisual } from './auth-visual';

/**
 * Shared frame for the Clerk sign-in / sign-up widgets. Providers are whatever
 * Clerk is configured with — nothing is rendered here that Clerk does not offer.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className='grid min-h-svh lg:grid-cols-[56fr_44fr]'>
      <AuthVisual />

      <div className='bg-background relative flex items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:p-10'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0'
          style={{
            background:
              'radial-gradient(55% 48% at 50% 42%, color-mix(in oklch, var(--primary) 6%, transparent), transparent 72%)'
          }}
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
          className='relative flex w-full max-w-[460px] flex-col items-center gap-8'
        >
          <Link
            href='/map'
            className='flex items-center gap-2.5 rounded-(--nav-radius) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none lg:hidden'
          >
            <LogoMark className='size-9 rounded-lg' />
            <span className='text-lg font-semibold tracking-tight'>FihDar</span>
          </Link>
          {children}
        </motion.div>
      </div>
    </div>
  );
}
