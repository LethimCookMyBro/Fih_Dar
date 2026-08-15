import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/components/themes/font.config';
import { DEFAULT_THEME, THEMES } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

const META_THEME_COLORS = {
  light: '#f5f7f7',
  dark: '#14181a'
};

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_APP_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL) }
    : {}),
  title: {
    default: 'FihDar — เฝ้าระวังการพบปลาที่น่าสงสัยในภาคตะวันออก',
    template: '%s | FihDar'
  },
  description:
    'FihDar (Fish + Radar) รวบรวมรายงานการพบปลาที่น่าสงสัยจากประชาชนในฉะเชิงเทรา ชลบุรี และระยอง แล้วแสดงผลบนแผนที่ทางน้ำจริง',
  openGraph: {
    title: 'FihDar — เฝ้าระวังการพบปลาที่น่าสงสัยในภาคตะวันออก',
    description: 'เปลี่ยนข้อมูลการพบปลาที่กระจัดกระจาย ให้กลายเป็นข้อมูลที่ช่วยเฝ้าระวังและตัดสินใจได้ง่ายขึ้น',
    siteName: 'FihDar',
    type: 'website'
  }
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get('active_theme')?.value;
  const isValidTheme = THEMES.some((t) => t.value === activeThemeValue);
  const themeToApply = isValidTheme ? activeThemeValue! : DEFAULT_THEME;

  return (
    // fontVariables sits on <html> so the next/font custom properties are in
    // scope for the [data-theme] --font-sans definition, which is declared here.
    <html lang='th' suppressHydrationWarning data-theme={themeToApply} className={fontVariables}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Set meta theme color
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body className='bg-background overflow-x-hidden overscroll-none font-sans antialiased'>
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers activeThemeValue={themeToApply}>
              <Toaster />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
