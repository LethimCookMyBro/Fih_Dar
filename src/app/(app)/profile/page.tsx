import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { requireAuthOrRedirect } from '@/server/require-auth';
import { ProfileView } from '@/features/profile/components/profile-view';

export const metadata: Metadata = {
  title: 'โปรไฟล์',
  description: 'ข้อมูลผู้ใช้และรายงานที่คุณส่งเข้ามา'
};

export default async function ProfilePage() {
  await requireAuthOrRedirect('/profile');

  return (
    <PageContainer pageTitle='โปรไฟล์' pageDescription='ข้อมูลของคุณและรายงานที่ส่งเข้ามา'>
      <ProfileView />
    </PageContainer>
  );
}
