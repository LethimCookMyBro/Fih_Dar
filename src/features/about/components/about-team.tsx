import ProfileCard from '@/components/reactbits/profile-card';

// Roster source: the team's official project proposal ("สมาชิกทีมและบทบาท" section) —
// not invented. Only name + real area of contribution are shown publicly; no student
// IDs, no fabricated handles, socials, or contact actions.
const TEAM = [
  {
    name: 'นายชุติพนธ์ จิตต์รุ่งเรืองสุข',
    role: 'ส่วนติดต่อผู้ใช้ และ Cybersecurity',
    accent: '#2a9d8f'
  },
  {
    name: 'นายเมธาสิทธิ์ แก้วศรีทอง',
    role: 'LLM และ RAG',
    accent: '#8ecfc6'
  },
  {
    name: 'นายชิษณุพงศ์โรจน์ เลิศกิจกาจา',
    role: 'Automation และ Data Cleansing',
    accent: '#c9a9bd'
  },
  {
    name: 'นายพชร ปฏิมาการ',
    role: 'AI Vision และ Image Processing',
    accent: '#70405f'
  }
] as const;

// One shared team mascot image, reused across all four cards (not an individual
// portrait of any member) — see public/team/tuff-pigeon.png. alt stays empty:
// it's decorative branding, and labelling it as any one member's photo would be
// false. Name/role text remain the real accessible content of each card.
const TEAM_IMAGE_SRC = '/team/tuff-pigeon.png';

export function AboutTeam() {
  return (
    <section className='border-t'>
      <div className='mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 md:py-24 lg:px-8'>
        <div className='text-center'>
          <p className='text-muted-foreground font-mono text-[0.75rem] tracking-[0.18em] uppercase'>
            ทีมผู้พัฒนา
          </p>
          <h2 className='mt-3 text-3xl font-semibold tracking-tight md:text-4xl'>ทีมนกพิราบก้าวร้าว</h2>
        </div>

        <ul className='mt-16 grid grid-cols-1 place-items-center gap-y-12 gap-x-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8'>
          {TEAM.map((member) => (
            <li key={member.name} className='flex w-full max-w-[300px] justify-center'>
              <ProfileCard
                name={member.name}
                title={member.role}
                avatarUrl={TEAM_IMAGE_SRC}
                avatarAlt=''
                accent={member.accent}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
