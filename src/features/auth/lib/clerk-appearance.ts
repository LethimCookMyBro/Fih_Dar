import type { ComponentProps } from 'react';
import type { SignIn } from '@clerk/nextjs';

// Derived from the installed @clerk/nextjs rather than importing @clerk/types,
// which is only a transitive dependency here.
type Appearance = NonNullable<ComponentProps<typeof SignIn>['appearance']>;

/**
 * Maps the Clerk widgets onto FihDar's design tokens so sign-in/sign-up read as
 * part of the product rather than an embedded third-party card.
 *
 * `variables` take CSS custom properties directly, so both themes and the
 * light/dark switch are handled without a second palette here.
 *
 * Deliberately conservative: sizing and colour only. Clerk owns the internal
 * layout and flow, and overriding structure is how these integrations break.
 *
 * Note: the widget's heading text ("Sign in to <app name>") comes from the
 * application name in the Clerk dashboard, not from code — it cannot be
 * changed here.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: 'var(--primary)',
    colorBackground: 'var(--background)',
    colorForeground: 'var(--foreground)',
    colorMutedForeground: 'var(--muted-foreground)',
    colorInput: 'var(--background)',
    colorInputForeground: 'var(--foreground)',
    colorDanger: 'var(--destructive)',
    colorSuccess: 'var(--primary)',
    borderRadius: '0.625rem',
    fontFamily: 'var(--font-sans)'
  },
  elements: {
    rootBox: 'w-full',
    // One border, no stacked shadow — matches the flat-surface language used
    // everywhere else in the app.
    cardBox: 'w-full border border-border rounded-2xl shadow-none',
    card: 'bg-background shadow-none',
    headerTitle: 'text-2xl font-semibold tracking-tight',
    headerSubtitle: 'text-muted-foreground text-[0.9375rem]',
    // 44px controls, consistent with the rest of the form system.
    formButtonPrimary: 'h-11 text-[0.9375rem] font-medium normal-case tracking-normal',
    // Border-defined, matching src/components/ui/input.tsx. Without the explicit
    // border the field sat at colorInput === colorBackground and disappeared
    // into the card.
    formFieldInput: 'h-11 border border-input bg-transparent text-[0.9375rem]',
    formFieldLabel: 'text-[0.9375rem]',
    socialButtonsBlockButton: 'h-11 text-[0.9375rem] normal-case',
    // Clerk renders the branding/dev-mode row as a visually separate grey slab by
    // default; matching it to the card removes the seam without hiding its content.
    footer: 'bg-background border-none',
    footerAction: 'bg-background',
    footerActionText: 'text-[0.9375rem]',
    footerActionLink: 'text-[0.9375rem] font-medium'
  }
};
