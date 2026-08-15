import 'server-only';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

import { CurrentClerkUser, requireCurrentClerkUser } from './auth';
import { AuthServiceError } from './errors';
import { REPORT_PROVINCES } from './report-validation';

export const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    organization: z.string().trim().max(160).nullable().optional(),
    province: z.enum(REPORT_PROVINCES).nullable().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');

const profileSelect = {
  id: true,
  displayName: true,
  email: true,
  phone: true,
  organization: true,
  province: true,
  avatarUrl: true
} as const;

function clerkOrganization(user: CurrentClerkUser['user'], orgId: string | null): string | null {
  const memberships = user.raw?.organization_memberships ?? [];
  const membership = orgId
    ? (memberships.find((item) => item.organization.id === orgId) ?? memberships[0])
    : memberships[0];
  return membership?.organization.name ?? null;
}

function clerkIdentity(context: CurrentClerkUser) {
  const { user } = context;
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) throw new AuthServiceError('Authenticated identity has no email address');

  const displayName = user.fullName?.trim() || user.username?.trim() || email;
  return {
    displayName,
    email,
    avatarUrl: user.imageUrl || null,
    organization: clerkOrganization(user, context.orgId)
  };
}

export async function getOrCreateCurrentProfile(context?: CurrentClerkUser) {
  const current = context ?? (await requireCurrentClerkUser());
  const identity = clerkIdentity(current);
  const profile = await prisma.userProfile.upsert({
    where: { clerkUserId: current.userId },
    create: { clerkUserId: current.userId, ...identity },
    // Clerk-owned identity stays in sync; `organization` is deliberately NOT
    // part of this update — it is a user-editable profile field, and syncing it
    // from the Clerk org membership would silently revert the user's edits on
    // every read (users without a Clerk org would get it wiped to null).
    update: {
      email: identity.email,
      avatarUrl: identity.avatarUrl
    },
    select: profileSelect
  });
  return profile;
}

export async function updateCurrentProfile(input: unknown, context?: CurrentClerkUser) {
  const current = context ?? (await requireCurrentClerkUser());
  const patch = profilePatchSchema.parse(input);
  await getOrCreateCurrentProfile(current);
  return prisma.userProfile.update({
    where: { clerkUserId: current.userId },
    data: patch,
    select: profileSelect
  });
}
