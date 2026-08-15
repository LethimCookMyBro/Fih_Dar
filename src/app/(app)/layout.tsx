import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { FihDarHeader } from '@/components/layout/fihdar-header';
import { FihDarSidebar } from '@/components/layout/fihdar-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

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
      <FihDarSidebar />
      <SidebarInset id='main-content' tabIndex={-1} className='min-w-0 overflow-x-hidden'>
        <FihDarHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
