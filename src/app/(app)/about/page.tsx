import type { Metadata } from 'next';

import { AboutHero } from '@/features/about/components/about-hero';
import { AboutRibbon } from '@/features/about/components/about-ribbon';
import { CapabilityTiltedCards } from '@/features/about/components/capability-tilted-cards';
import { ProductCardSwap } from '@/features/about/components/product-card-swap';
import { FeatureSpotlightDialogs } from '@/features/about/components/feature-spotlight-dialogs';
import { AboutStory, AboutTeam, AboutCta } from '@/features/about/components/about-story-team-cta';

export const metadata: Metadata = {
  title: 'เกี่ยวกับ FihDar',
  description: 'FihDar เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น'
};

export default function AboutPage() {
  return (
    <main>
      <AboutHero />
      <AboutRibbon />
      <CapabilityTiltedCards />
      <ProductCardSwap />
      <FeatureSpotlightDialogs />
      <AboutStory />
      <AboutTeam />
      <AboutCta />
    </main>
  );
}
