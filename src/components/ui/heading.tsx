import { InfoButton } from '@/components/ui/info-button';
import type { InfobarContent } from '@/components/ui/infobar';

interface HeadingProps {
  title: string;
  description: string;
  infoContent?: InfobarContent;
}

export function Heading({ title, description, infoContent }: HeadingProps) {
  return (
    <div>
      <div className='flex items-center gap-2'>
        {/* 600 not 700: bold-everywhere flattens hierarchy, and Thai counters
            fill in at heavy weights. Size steps up from 24px on mobile. */}
        <h1 className='text-2xl font-semibold tracking-tight text-balance md:text-3xl'>{title}</h1>
        {infoContent && (
          <div className='pt-1'>
            <InfoButton content={infoContent} />
          </div>
        )}
      </div>
      {description && (
        <p className='text-muted-foreground mt-1 max-w-prose text-[0.9375rem] leading-relaxed'>
          {description}
        </p>
      )}
    </div>
  );
}
