import ProfileCard from '@/components/reactbits/profile-card';

// Roster source: the team's official project proposal ("สมาชิกทีมและบทบาท" section) —
// not invented. Only name + real area of contribution are shown publicly; no student
// IDs, no fabricated handles, socials, or contact actions.
const TEAM = [
  {
    name: 'นายชุติพนธ์ จิตต์รุ่งเรืองสุข',
    role: 'ส่วนติดต่อผู้ใช้ และ Cybersecurity',
    letter: 'ช',
    bg: '#14181a',
    fg: '#2a9d8f'
  },
  {
    name: 'นายเมธาสิทธิ์ แก้วศรีทอง',
    role: 'LLM และ RAG',
    letter: 'ม',
    bg: '#1e3b37',
    fg: '#8ecfc6'
  },
  {
    name: 'นายชิษณุพงศ์โรจน์ เลิศกิจกาจา',
    role: 'Automation และ Data Cleansing',
    letter: 'ล',
    bg: '#2a1f26',
    fg: '#c9a9bd'
  },
  {
    name: 'นายพชร ปฏิมาการ',
    role: 'AI Vision และ Image Processing',
    letter: 'พ',
    bg: '#14181a',
    fg: '#70405f'
  }
] as const;

// No real member photos exist yet — a branded initials mark (radar-ring motif, matching
// the app's logo language) stands in per the "abstract placeholder, never a fake AI
// portrait" rule. Deterministic per member: same input always renders the same mark.
function initialsAvatar(letter: string, bg: string, fg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'>
    <rect width='300' height='300' fill='${bg}'/>
    <circle cx='150' cy='138' r='118' fill='none' stroke='${fg}' stroke-width='1.5' opacity='0.35'/>
    <circle cx='150' cy='138' r='82' fill='none' stroke='${fg}' stroke-width='1.5' opacity='0.55'/>
    <text x='150' y='168' text-anchor='middle' font-family='Tahoma, "Noto Sans Thai", system-ui, sans-serif' font-size='118' font-weight='700' fill='${fg}'>${letter}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Diagonal stripe mask that shapes where the holographic sweep shows — without it the
// shine layer washes the whole card evenly instead of reading as a moving scan.
const HOLO_MASK = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='black'/><g stroke='white' stroke-width='7' opacity='0.9'><line x1='-20' y1='0' x2='60' y2='140'/><line x1='20' y1='0' x2='100' y2='140'/><line x1='60' y1='0' x2='140' y2='140'/><line x1='100' y1='0' x2='180' y2='140'/></g></svg>`
)}`;

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
            <li key={member.name}>
              <ProfileCard
                name={member.name}
                title={member.role}
                avatarUrl={initialsAvatar(member.letter, member.bg, member.fg)}
                iconUrl={HOLO_MASK}
                cardHeight='420px'
                behindGlowColor='rgba(42, 157, 143, 0.45)'
                innerGradient='linear-gradient(150deg,#4b214290 0%,#2a9d8f2e 100%)'
                enableMobileTilt={false}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
