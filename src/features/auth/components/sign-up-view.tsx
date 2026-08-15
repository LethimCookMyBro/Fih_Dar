import { SignUp as ClerkSignUpForm } from '@clerk/nextjs';

import { clerkAppearance } from '../lib/clerk-appearance';
import { AuthShell } from './auth-shell';

export default function SignUpViewPage() {
  return (
    <AuthShell>
      <ClerkSignUpForm
        appearance={clerkAppearance}
        signInUrl='/auth/sign-in'
        fallbackRedirectUrl='/map'
      />
    </AuthShell>
  );
}
