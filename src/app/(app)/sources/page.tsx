import type { Metadata } from 'next';

import { SourcesView } from '@/features/sources/components/sources-view';

export const metadata: Metadata = {
  title: 'แหล่งข้อมูล',
  description: 'แหล่งข้อมูลสาธารณะที่ FihDar ใช้ประกอบการเฝ้าระวังและวิเคราะห์เชิงพื้นที่'
};

export default function SourcesPage() {
  // The hero owns the first viewport, so this page uses a wider content shell
  // than the default PageContainer (same precedent as /map).
  return (
    <div className='mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-4 pt-5 pb-14 sm:px-6 lg:px-8'>
      <SourcesView />
    </div>
  );
}
