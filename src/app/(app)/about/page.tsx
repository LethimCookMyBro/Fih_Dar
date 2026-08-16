import type { Metadata } from 'next';

import { Reveal } from '@/components/visuals/reveal';
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

// The hero carries its own visual weight (animated background) and skips the
// fade-in below it so it's on screen immediately, not mid-transition.
export default function AboutPage() {
  return (
    <main>
      <AboutHero />
      <Reveal>
        <AboutRibbon />
      </Reveal>
      <Reveal>
        <CapabilityTiltedCards />
      </Reveal>
      <Reveal>
        <ProductCardSwap />
      </Reveal>
      <Reveal>
        <FeatureSpotlightDialogs />
      </Reveal>
      <Reveal>
        <AboutStory />
      </Reveal>
      <Reveal>
        <AboutTeam />
      </Reveal>
      <Reveal>
        <AboutCta />
      </Reveal>
    </main>
  );
}
