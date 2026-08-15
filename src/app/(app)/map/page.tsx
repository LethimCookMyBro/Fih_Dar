import type { Metadata } from 'next';

import { MapView } from '@/features/map/components/map-view';

export const metadata: Metadata = {
  title: 'แผนที่ทางน้ำภาคตะวันออก',
  description: 'แผนที่เฝ้าระวังการพบปลาที่น่าสงสัยในฉะเชิงเทรา ชลบุรี และระยอง'
};

export default function MapPage() {
  // The map owns the whole viewport below the header — no page padding.
  // Height tracks --header-h so the two can't drift apart.
  return (
    <div className='h-[calc(100svh-var(--header-h))] w-full'>
      <MapView />
    </div>
  );
}
