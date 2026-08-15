import { TextLoop } from '@/components/visuals/text-loop';

/** Section-transition ribbon — the one non-auth use of TextLoop on this page. */
export function AboutRibbon() {
  return (
    <div className='bg-brand text-brand-foreground border-y'>
      <div className='mx-auto h-16 w-full max-w-5xl px-4 sm:px-6 lg:px-8'>
        <TextLoop
          text='MONITOR • UNDERSTAND • PRIORITIZE • FIHDAR'
          shape='line'
          speed={30}
          separator='•'
          fontSize={16}
          fontWeight={600}
          letterSpacing={2}
          uppercase
          color='rgba(255,255,255,0.75)'
          ribbon
          ribbonColor='rgba(255,255,255,0.25)'
          ribbonWidth={1}
          className='h-full w-full'
        />
      </div>
    </div>
  );
}
