import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { SourcesView } from '@/features/sources/components/sources-view';

export const metadata: Metadata = {
  title: 'แหล่งข้อมูล',
  description: 'แหล่งข้อมูลสาธารณะที่ FihDar ใช้ประกอบการเฝ้าระวังและวิเคราะห์เชิงพื้นที่'
};

export default function SourcesPage() {
  return (
    <PageContainer
      pageTitle='แหล่งข้อมูล'
      pageDescription='ข้อมูลสาธารณะที่ FihDar ใช้ประกอบการเฝ้าระวังและวิเคราะห์เชิงพื้นที่'
    >
      <SourcesView />
    </PageContainer>
  );
}
