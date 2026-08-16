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
    <section className='mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 md:py-28 lg:px-8'>
      <div className='mb-14 md:mb-20'>
        <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
          ความสามารถหลัก
        </p>
        <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-4xl'>
          สามความสามารถหลักของ FihDar
        </h2>
      </div>

      <div className='flex flex-col gap-16 md:gap-28'>
        {CAPABILITIES.map((c, i) => {
          const isPriority = i === 2;
          return (
            <div
              key={c.index}
              className={
                isPriority
                  ? 'flex flex-col items-center gap-8'
                  : `flex flex-col items-center gap-8 md:gap-12 ${i === 1 ? 'md:flex-row-reverse' : 'md:flex-row'}`
              }
            >
              <div className={isPriority ? 'w-full max-w-4xl' : 'w-full md:w-7/12'}>
                <TiltedCard
                  imageSrc={c.image}
                  altText={c.alt}
                  containerHeight={isPriority ? '420px' : '460px'}
                  containerWidth='100%'
                  imageHeight={isPriority ? '420px' : '460px'}
                  imageWidth='100%'
                  rotateAmplitude={7}
                  scaleOnHover={1.025}
                  className='rounded-2xl'
                />
              </div>
              <div
                className={
                  isPriority ? 'max-w-xl text-center' : 'w-full text-center md:w-5/12 md:text-start'
                }
              >
                <p className='text-muted-foreground font-mono text-5xl font-bold tracking-tight md:text-6xl'>
                  {c.index}
                </p>
                <h3 className='mt-2 text-2xl font-semibold tracking-tight md:text-3xl'>
                  {c.title}
                </h3>
                <p className='text-muted-foreground mt-1 text-lg'>{c.thai}</p>
                <p
                  className={`text-muted-foreground mt-3 text-base leading-relaxed ${isPriority ? 'mx-auto max-w-md' : 'max-w-md md:mx-0'}`}
                >
                  {c.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
