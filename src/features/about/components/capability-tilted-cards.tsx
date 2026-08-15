import TiltedCard from '@/components/reactbits/tilted-card';

const CAPABILITIES = [
  {
    index: '01',
    title: 'MONITOR',
    thai: 'เฝ้าระวังหลายแหล่ง',
    body: 'รวบรวมสัญญาณการพบจากหลายแหล่งไว้ในมุมมองเดียว',
    image: '/about/waterway-map.jpg',
    alt: 'แผนที่ทางน้ำภาคตะวันออกของ FihDar แสดงกลุ่มรายงานตามเส้นทางน้ำจริง'
  },
  {
    index: '02',
    title: 'UNDERSTAND',
    thai: 'เข้าใจสถานที่และเหตุการณ์',
    body: 'ช่วยเชื่อมรายงานกับพื้นที่และเหตุการณ์ที่เกี่ยวข้อง',
    image: '/about/event-detail.jpg',
    alt: 'การ์ดรายละเอียดรายงานการพบพร้อมจังหวัด วันที่ และพิกัดโดยประมาณ'
  },
  {
    index: '03',
    title: 'PRIORITIZE',
    thai: 'มองพื้นที่ที่ควรสนใจก่อน',
    body: 'เปรียบเทียบพื้นที่พร้อมดูเหตุผลของ Priority MVP',
    image: '/about/priority-panel.jpg',
    alt: 'แผงอันดับพื้นที่ที่ควรลงพื้นที่ก่อน พร้อมคะแนนความสำคัญของแต่ละพื้นที่'
  }
];

export function CapabilityTiltedCards() {
  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8'>
      <ul className='grid gap-8 sm:grid-cols-3'>
        {CAPABILITIES.map((c) => (
          <li key={c.index} className='flex flex-col'>
            <TiltedCard
              imageSrc={c.image}
              altText={c.alt}
              containerHeight='220px'
              containerWidth='100%'
              imageHeight='220px'
              imageWidth='100%'
              rotateAmplitude={6}
              scaleOnHover={1.02}
              className='rounded-xl'
            />
            <p className='text-muted-foreground mt-4 font-mono text-[0.6875rem] tracking-[0.18em]'>
              {c.index}
            </p>
            <h3 className='mt-1 text-lg font-semibold tracking-tight'>{c.thai}</h3>
            <p className='text-muted-foreground mt-1.5 text-[0.9375rem] leading-relaxed'>
              {c.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
