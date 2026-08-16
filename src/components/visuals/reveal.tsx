'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

/**
 * One restrained scroll-entrance treatment reused across every About section
 * (opacity + a 24px rise) so the page doesn't accumulate a different animation
 * per component. Reduced-motion is resolved after mount rather than read
 * synchronously, matching the pattern in auth-visual/about-hero: keeps the
 * first client render identical to the server's instead of branching on a
 * value that isn't available yet during SSR.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
