import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: 'สมัครสมาชิก',
  description: 'สมัครสมาชิก FihDar เพื่อแจ้งการพบปลาที่น่าสงสัย'
};

export default function Page() {
  return <SignUpViewPage />;
}
