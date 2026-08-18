import Image from 'next/image';

import { cn } from '@/lib/utils';

interface LogoMarkProps {
  /** Sizing and corner radius. The mark is square; size it with one `size-*`. */
  className?: string;
  priority?: boolean;
}

/**
 * The FihDar mark: a sonar ring whose sweep and inner arcs resolve into a fish.
 *
 * The artwork carries its own Keppel field, so it *is* the brand tile — callers
 * size and round it directly instead of nesting it inside a `bg-primary` square
 * the way the previous single-colour SVG needed.
 *
 * Source artwork is 1254px; `public/brand/logo.png` is the 512px derivative that
 * ships. next/image serves a WebP scaled to the requested size, so a 32px header
 * tile does not download the full asset.
 */
export function LogoMark({ className, priority }: LogoMarkProps) {
  return (
    <Image
      src='/brand/logo.png'
      alt=''
      aria-hidden
      width={512}
      height={512}
      priority={priority}
      className={cn('shrink-0 object-cover select-none', className)}
    />
  );
}

export default LogoMark;
