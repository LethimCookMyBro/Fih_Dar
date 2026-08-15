import { SignIn as ClerkSignInForm } from '@clerk/nextjs';

import { clerkAppearance } from '../lib/clerk-appearance';
import { AuthShell } from './auth-shell';

export default function SignInViewPage() {
  return (
    <AuthShell>
      <ClerkSignInForm
        appearance={clerkAppearance}
        signUpUrl='/auth/sign-up'
        fallbackRedirectUrl='/map'
      />
    </AuthShell>
  );
}
