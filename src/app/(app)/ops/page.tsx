import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { requireOpsPageAccess } from '@/server/require-auth';
import { OpsView } from '@/features/ops/components/ops-view';

export const metadata: Metadata = {
  title: 'ศูนย์ปฏิบัติการภาคสนาม',
  description: 'งานภาคสนามของเจ้าหน้าที่ — บันทึกผลการลงพื้นที่และสถานะรายงาน'
};

export default async function OpsPage() {
  const { isOfficer } = await requireOpsPageAccess();

  return (
    <PageContainer
      pageTitle='ศูนย์ปฏิบัติการภาคสนาม'
      pageDescription='รายงานจากประชาชนและผลการปฏิบัติงานของเจ้าหน้าที่'
    >
      <OpsView isOfficer={isOfficer} />
    </PageContainer>
  );
}
