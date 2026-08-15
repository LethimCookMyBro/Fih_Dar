'use client';
import { ClerkProvider } from '@clerk/nextjs';
import { thTH } from '@clerk/localizations';
import React from 'react';
import { ActiveThemeProvider } from '../themes/active-theme';
import QueryProvider from './query-provider';

// Clerk's th-TH pack templates the sign-in/sign-up title with the app name
// from the Clerk Dashboard ("เข้าสู่ระบบ {{applicationName}}"), which is not
// set to "FihDar" there. Overriding the strings here keeps branding correct
// without depending on dashboard configuration or patching the DOM.
const fihdarLocalization = {
  ...thTH,
  signIn: {
    ...thTH.signIn!,
    start: {
      ...thTH.signIn!.start,
      title: 'เข้าสู่ระบบ FihDar',
      subtitle: 'เข้าสู่ระบบเพื่อเข้าถึงระบบเฝ้าระวังและข้อมูลเชิงพื้นที่'
    }
  },
  signUp: {
    ...thTH.signUp!,
    start: {
      ...thTH.signUp!.start,
      title: 'สร้างบัญชี FihDar',
      subtitle: 'เข้าร่วมระบบรายงานและเฝ้าระวังปลาหมอคางดำในพื้นที่ภาคตะวันออก'
    }
  }
};

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <ActiveThemeProvider initialTheme={activeThemeValue}>
        <ClerkProvider
          localization={fihdarLocalization}
          appearance={{
            variables: {
              colorPrimary: 'var(--primary)',
              colorPrimaryForeground: 'var(--primary-foreground)',
              colorDanger: 'var(--destructive)',
              colorBackground: 'var(--card)',
              colorForeground: 'var(--foreground)',
              colorMuted: 'var(--muted)',
              colorMutedForeground: 'var(--muted-foreground)',
              colorInput: 'var(--input)',
              colorInputForeground: 'var(--foreground)',
              colorBorder: 'var(--border)',
              colorRing: 'var(--ring)',
              fontFamily: 'var(--font-sans)'
            }
          }}
        >
          <QueryProvider>{children}</QueryProvider>
        </ClerkProvider>
      </ActiveThemeProvider>
    </>
  );
}
