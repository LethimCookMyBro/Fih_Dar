import { Inter, JetBrains_Mono, Noto_Sans_Thai } from 'next/font/google';

import { cn } from '@/lib/utils';

// Thai is the primary application language, so the Thai face leads --font-sans
// and Inter only covers the Latin fallback.
const fontThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  variable: '--font-noto-thai'
});

const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono'
});

export const fontVariables = cn(fontThai.variable, fontInter.variable, fontMono.variable);
