import { Icons } from '@/components/icons';

// Bibliographic fields verified against Crossref/DOI records before writing this file.
// Related work only: FihDar does not implement these papers' methods or verification
// technology (e.g. eDNA), and a digital signal here is not confirmed field presence.
const PAPERS = [
  {
    category: 'ปลาหมอคางดำในประเทศไทย',
    icon: Icons.fish,
    title:
      'Genetic diversity, population structure and multiple introductions of invasive blackchin tilapia Sarotherodon melanotheron in Thailand',
    venue: 'Aquaculture Reports · 2026',
    summary:
      'ศึกษาพันธุกรรมและโครงสร้างประชากรปลาหมอคางดำในประเทศไทย พร้อมวิเคราะห์การกระจายและการนำเข้าสู่หลายพื้นที่',
    relation: 'สนับสนุนบริบทปัญหาและความจำเป็นของระบบเฝ้าระวังเชิงพื้นที่ในประเทศไทย',
    doi: '10.1016/j.aqrep.2026.103575'
  },
  {
    category: 'Digital Surveillance',
    icon: Icons.radar,
    title:
      'Integrating social media and environmental DNA records to enhance surveillance and improve early detection of invasive species',
    venue: 'NeoBiota · 2025',
    summary: 'ใช้ข้อมูลออนไลน์ช่วยค้นหาพื้นที่ต้องสงสัยของชนิดพันธุ์รุกราน ก่อนตรวจสอบต่อด้วยหลักฐานจากพื้นที่จริง',
    relation: 'สอดคล้องกับแนวคิดของ FihDar ที่เปลี่ยนสัญญาณดิจิทัลให้เป็นพื้นที่สำหรับการตรวจสอบภาคสนาม',
    doi: '10.3897/neobiota.102.151710'
  },
  {
    category: 'Spatial Prioritization',
    icon: Icons.target,
    title:
      'A site prioritization tool for invasive species management: Integrating diverse spatial data to improve decision making',
    venue: 'Ecological Informatics · 2026',
    summary: 'ผสานข้อมูลเชิงพื้นที่หลายประเภทเพื่อช่วยจัดลำดับพื้นที่สำหรับการติดตามและจัดการชนิดพันธุ์รุกราน',
    relation: 'สอดคล้องกับแนวคิดการช่วยเจ้าหน้าที่เลือกพื้นที่ที่ควรตรวจสอบก่อนเมื่อทรัพยากรมีจำกัด',
    doi: '10.1016/j.ecoinf.2026.103779'
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
                className='group focus-visible:ring-ring bg-card ring-foreground/10 flex h-full flex-col gap-4 rounded-xl p-5 text-card-foreground ring-1 outline-none transition-[transform,box-shadow] motion-safe:hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2'
              >
                <div>
                  <div className='bg-accent text-accent-foreground flex h-10 w-10 items-center justify-center rounded-lg'>
                    <paper.icon className='h-5 w-5' aria-hidden='true' />
                  </div>
                  <p className='text-muted-foreground mt-3 font-mono text-[0.6875rem] tracking-[0.14em] uppercase'>
                    {paper.category}
                  </p>
                </div>
                <div className='flex flex-1 flex-col'>
                  <h3 className='text-base leading-snug font-semibold text-balance'>
                    {paper.title}
                  </h3>
                  <p className='text-muted-foreground mt-1.5 text-sm'>{paper.venue}</p>
                  <p className='mt-4 text-sm leading-relaxed'>{paper.summary}</p>
                  <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
                    ความเกี่ยวข้องกับ FihDar: {paper.relation}
                  </p>
                  <div className='mt-5 flex items-center justify-between gap-3 border-t pt-4'>
                    <span className='text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium'>
                      อ่านงานวิจัย
                      <Icons.externalLink
                        className='h-3.5 w-3.5 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5'
                        aria-hidden='true'
                      />
                    </span>
                    <span className='text-muted-foreground min-w-0 truncate font-mono text-[0.6875rem]'>
                      DOI: {paper.doi}
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
