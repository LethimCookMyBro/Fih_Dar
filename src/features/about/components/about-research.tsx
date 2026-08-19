import Image from 'next/image';

import { Icons } from '@/components/icons';

// Bibliographic fields verified against Crossref/DOI records before writing this file.
// Related work only: FihDar does not implement these papers' methods or verification
// technology (e.g. eDNA), and a digital signal here is not confirmed field presence.
//
// First-page previews are rendered from the papers' own official open-access PDFs
// (all three are CC BY 4.0 per Crossref license metadata) — never fabricated covers.
// Aquaculture Reports blocks automated PDF fetches (403), so paper 1 has no preview
// image; it gets the neutral placeholder instead of a stand-in image.
const PAPERS = [
  {
    category: 'ปลาหมอคางดำในประเทศไทย',
    icon: Icons.fish,
    title:
      'Genetic diversity, population structure and multiple introductions of invasive blackchin tilapia Sarotherodon melanotheron in Thailand',
    venue: 'Aquaculture Reports · 2026',
    tagline: 'บริบทปลาหมอคางดำในประเทศไทย',
    doi: '10.1016/j.aqrep.2026.103575',
    previewSrc: null
  },
  {
    category: 'Digital Surveillance',
    icon: Icons.radar,
    title:
      'Integrating social media and environmental DNA records to enhance surveillance and improve early detection of invasive species',
    venue: 'NeoBiota · 2025',
    tagline: 'สัญญาณดิจิทัลสู่การตรวจสอบภาคสนาม',
    doi: '10.3897/neobiota.102.151710',
    previewSrc: '/research/paper-digital-surveillance-2025.webp'
  },
  {
    category: 'Aquatic Field Prioritization',
    icon: Icons.target,
    title:
      'Increasing broad-spectrum aquatic invasive species early detection program efficiency through biased site selection and gear allocation',
    venue: 'Biological Invasions · 2024',
    tagline: 'เลือกพื้นที่ตรวจเมื่อทรัพยากรมีจำกัด',
    doi: '10.1007/s10530-024-03306-5',
    previewSrc: '/research/paper-aquatic-prioritization-2024.webp'
  }
] as const;

export function AboutResearch() {
  return (
    <section className='border-t'>
      <div className='mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8'>
        <div className='mx-auto max-w-2xl text-center'>
          <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
            หลักฐานทางวิชาการ
          </p>
          <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-4xl'>งานวิจัยที่เกี่ยวข้อง</h2>
          <p className='text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed'>
            แนวคิดของ FihDar เชื่อมโยงกับงานด้านปลาหมอคางดำ การเฝ้าระวังจากสัญญาณดิจิทัล และการจัดลำดับพื้นที่
          </p>
        </div>

        <ul className='mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
          {PAPERS.map((paper) => (
            <li key={paper.doi}>
              <a
                href={`https://doi.org/${paper.doi}`}
                target='_blank'
                rel='noopener noreferrer'
                aria-label={`อ่านงานวิจัย: ${paper.title} (เปิดในแท็บใหม่)`}
                className='group focus-visible:ring-ring bg-card ring-foreground/10 flex h-full flex-col overflow-hidden rounded-xl text-card-foreground ring-1 outline-none transition-[transform,box-shadow] motion-safe:hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2'
              >
                <div className='bg-muted relative aspect-[4/5] w-full overflow-hidden'>
                  {paper.previewSrc ? (
                    <Image
                      src={paper.previewSrc}
                      alt={`หน้าแรกของงานวิจัย ${paper.title}`}
                      fill
                      sizes='(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
                      className='object-cover object-top transition-transform duration-300 motion-safe:group-hover:scale-[1.02]'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center'>
                      <paper.icon
                        className='text-muted-foreground/30 h-16 w-16'
                        aria-hidden='true'
                      />
                    </div>
                  )}
                </div>

                <div className='flex flex-1 flex-col gap-2 p-5'>
                  <div className='flex items-center gap-2'>
                    <paper.icon className='text-primary h-4 w-4 shrink-0' aria-hidden='true' />
                    <p className='text-muted-foreground font-mono text-[0.6875rem] tracking-[0.14em] uppercase'>
                      {paper.category}
                    </p>
                  </div>
                  <h3 className='line-clamp-3 text-base leading-snug font-semibold text-balance'>
                    {paper.title}
                  </h3>
                  <p className='text-muted-foreground text-sm'>{paper.venue}</p>
                  <p className='text-sm'>{paper.tagline}</p>
                  <span className='text-primary mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium'>
                    อ่านงานวิจัย
                    <Icons.externalLink
                      className='h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5'
                      aria-hidden='true'
                    />
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
