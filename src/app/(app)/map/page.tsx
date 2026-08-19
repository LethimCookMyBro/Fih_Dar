import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MapView } from '@/features/map/components/map-view';

export const metadata: Metadata = {
  title: 'แผนที่ทางน้ำภาคตะวันออก',
  description: 'แผนที่เฝ้าระวังการพบปลาที่น่าสงสัยในฉะเชิงเทรา ชลบุรี และระยอง'
};

export default function MapPage() {
  // The map owns the whole viewport below the header — no page padding.
  // Height tracks --header-h so the two can't drift apart. `dvh`, not `svh`:
  // this container should track the live visual viewport, because on iOS
  // Safari the URL bar auto-collapses during scroll/pan, growing the actual
  // visible area — sizing to the smallest (svh) leaves that growth as a
  // blank gap below the map instead of the map filling it. Suspense is
  // required here because MapView reads useSearchParams() (for the
  // ?event= deep link from /ops's "ดูบนแผนที่").
  return (
    <div className='h-[calc(100dvh-var(--header-h))] w-full'>
      <Suspense fallback={null}>
        <MapView />
      </Suspense>
    </div>
  );
}
