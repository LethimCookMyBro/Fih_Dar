import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { FihDarHeader } from '@/components/layout/fihdar-header';
import { FihDarSidebar } from '@/components/layout/fihdar-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { isPublicOpsDemoEnabled } from '@/server/authorization';

export const metadata: Metadata = {
  title: { default: 'FihDar', template: '%s | FihDar' }
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href='#main-content'
        className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <FihDarSidebar publicOpsDemo={isPublicOpsDemoEnabled()} />
      {/* No overflow-x here: `overflow` other than `visible` on either axis
          forces the other axis to compute as `auto` (CSS Overflow §3), which
          turns this flex child into a scroll container of its own — and
          FihDarHeader's `sticky top-0` inside it then sticks to THIS
          element's scrollport instead of the real page viewport, so it
          never visibly detaches from flow while scrolling. `min-w-0` alone
          (a flex-shrink fix, not an overflow one) already keeps a flex child
          from forcing horizontal growth; <body> in the root layout already
          carries overflow-x-hidden as the actual belt-and-suspenders guard,
          on an element sticky positioning does not resolve against. */}
      <SidebarInset id='main-content' tabIndex={-1} className='min-w-0'>
        <FihDarHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
