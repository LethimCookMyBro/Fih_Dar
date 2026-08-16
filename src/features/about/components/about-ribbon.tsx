import { TextLoop } from '@/components/visuals/text-loop';

/**
 * Section-transition ribbon. Full-bleed on purpose: the brand color lives on the
 * moving curved band itself (via TextLoop's `ribbon`), not on a flat rectangular
 * section background, so the page stays neutral behind it.
 */
export function AboutRibbon() {
  return (
    <div className='bg-background overflow-hidden border-y'>
      <div className='h-[160px] w-full md:h-[190px]'>
        <TextLoop
          text='MONITOR • UNDERSTAND • PRIORITIZE • FIHDAR'
          shape='wave'
          speed={65}
          direction='forward'
          separator='•'
          curviness={42}
          fontSize={34}
          fontWeight={700}
          letterSpacing={3}
          uppercase
          color='#ffffff'
          ribbon
          ribbonColor='#4b2142'
          ribbonWidth={72}
          pauseOnHover
          className='h-full w-full'
        />
      </div>
    </div>
  );
}
