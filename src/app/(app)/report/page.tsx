import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { requireAuthOrRedirect } from '@/server/require-auth';
import { ReportForm } from '@/features/reports/components/report-form';

export const metadata: Metadata = {
  title: 'แจ้งการพบปลาที่น่าสงสัย',
  description: 'ส่งข้อมูลการพบปลาที่น่าสงสัยพร้อมพิกัดและภาพประกอบ'
};

export default async function ReportPage() {
  await requireAuthOrRedirect('/report');

  return (
    <PageContainer
      pageTitle='แจ้งการพบปลาที่น่าสงสัย'
      pageDescription='ข้อมูลของคุณช่วยให้ทีมเฝ้าระวังตรวจสอบสถานการณ์ได้เร็วขึ้น'
    >
      <ReportForm />
    </PageContainer>
  );
}
