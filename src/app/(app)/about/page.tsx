import type { Metadata } from 'next';

import { Reveal } from '@/components/visuals/reveal';
import { AboutHero } from '@/features/about/components/about-hero';
import { CapabilityTiltedCards } from '@/features/about/components/capability-tilted-cards';
import { ProductCardSwap } from '@/features/about/components/product-card-swap';
import { AboutStory, AboutCta } from '@/features/about/components/about-story-team-cta';
import { AboutTeam } from '@/features/about/components/about-team';

export const metadata: Metadata = {
  title: 'เกี่ยวกับ FihDar',
  description: 'FihDar เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น'
};

// The hero carries its own visual weight (interactive lanyard badge) and skips the
// fade-in below it so it's on screen immediately, not mid-transition.
export default function AboutPage() {
  return (
    <main>
      <AboutHero />
      <Reveal>
        <CapabilityTiltedCards />
      </Reveal>
      <Reveal>
        <ProductCardSwap />
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
