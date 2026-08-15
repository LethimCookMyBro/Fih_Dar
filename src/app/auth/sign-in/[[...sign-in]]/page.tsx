import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: 'เข้าสู่ระบบ FihDar เพื่อแจ้งการพบปลาที่น่าสงสัย'
};

export default async function Page() {
  return <SignInViewPage />;
}
