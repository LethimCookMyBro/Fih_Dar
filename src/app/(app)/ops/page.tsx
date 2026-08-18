import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { requireOfficerOrRedirect } from '@/server/require-auth';
import { OpsView } from '@/features/ops/components/ops-view';

export const metadata: Metadata = {
  title: 'ศูนย์ปฏิบัติการภาคสนาม',
  description: 'งานภาคสนามของเจ้าหน้าที่ — บันทึกผลการลงพื้นที่และสถานะรายงาน'
};

export default async function OpsPage() {
  await requireOfficerOrRedirect();

  return (
    <PageContainer
      pageTitle='ศูนย์ปฏิบัติการภาคสนาม'
      pageDescription='รายงานจากประชาชนและผลการปฏิบัติงานของเจ้าหน้าที่'
    >
      <OpsView />
    </PageContainer>
  );
}
