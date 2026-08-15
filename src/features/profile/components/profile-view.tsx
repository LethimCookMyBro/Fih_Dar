'use client';

import * as React from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppForm } from '@/lib/form';
import { profileKeys, profileQueryOptions } from '@/features/reports/api/queries';
import { updateProfile } from '@/features/reports/api/service';
import { REPORT_PROVINCES, type Profile } from '@/features/reports/api/types';
import { MyReports } from '@/features/reports/components/my-reports';

const NO_PROVINCE = '__none__';

const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, 'กรุณากรอกชื่อที่ใช้แสดง').max(120, 'ชื่อยาวเกินไป'),
  phone: z.string().trim().max(40, 'เบอร์โทรยาวเกินไป'),
  organization: z.string().trim().max(160, 'ชื่อหน่วยงานยาวเกินไป'),
  province: z.string()
});

function ProfileField({ label, value }: { label: string; value: string | null }) {
  const empty = !value?.trim();
  return (
    <div>
      <dt className='text-muted-foreground text-[0.8125rem]'>{label}</dt>
      <dd
        className={`mt-1 text-[0.9375rem] break-words ${empty ? 'text-muted-foreground/60' : ''}`}
      >
        {empty ? 'ยังไม่ได้ระบุ' : value}
      </dd>
    </div>
  );
}

function ProfileEditForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
      await queryClient.invalidateQueries({ queryKey: profileKeys.current() });
      onDone();
    },
    onError: () => toast.error('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')
  });

  const form = useAppForm({
    defaultValues: {
      displayName: profile.displayName,
      phone: profile.phone ?? '',
      organization: profile.organization ?? '',
      province: profile.province ?? NO_PROVINCE
    },
    validators: { onSubmit: profileFormSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        displayName: value.displayName,
        phone: value.phone.trim() || null,
        organization: value.organization.trim() || null,
        province:
          value.province === NO_PROVINCE
            ? null
            : (value.province as (typeof REPORT_PROVINCES)[number])
      });
    }
  });

  return (
    <form
      className='grid gap-4 sm:grid-cols-2'
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name='displayName'
        children={(field) => <field.TextField label='ชื่อที่ใช้แสดง' required />}
      />
      <form.AppField
        name='phone'
        children={(field) => <field.TextField label='เบอร์โทรศัพท์' type='tel' />}
      />
      <form.AppField
        name='organization'
        children={(field) => <field.TextField label='หน่วยงาน' />}
      />
      <form.AppField
        name='province'
        children={(field) => (
          <field.SelectField
            label='จังหวัด'
            placeholder='เลือกจังหวัด'
            options={[
              { value: NO_PROVINCE, label: 'ไม่ระบุ' },
              ...REPORT_PROVINCES.map((province) => ({ value: province, label: province }))
            ]}
          />
        )}
      />

      <div className='flex flex-wrap gap-2 pt-1 sm:col-span-2'>
        {/* Spinner occupies reserved space so the button width is stable. */}
        <Button
          type='submit'
          disabled={mutation.isPending}
          className='h-11 min-w-28 px-5 text-[0.9375rem]'
        >
          <Icons.spinner
            className={`animate-spin ${mutation.isPending ? '' : 'hidden'}`}
            aria-hidden
          />
          บันทึก
        </Button>
        <Button
          type='button'
          variant='ghost'
          onClick={onDone}
          disabled={mutation.isPending}
          className='h-11 px-5 text-[0.9375rem]'
        >
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

/**
 * Account header built from the Clerk session, not the database. The avatar,
 * name and email are already owned by Clerk, so this section renders as soon
 * as the session loads — even when PostgreSQL is slow or unreachable.
 */
function AccountHeader() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    // Mirrors the real header (avatar + two lines) so nothing jumps.
    return (
      <div role='status' aria-label='กำลังโหลดข้อมูลบัญชี' className='flex items-center gap-4'>
        <Skeleton className='size-16 shrink-0 rounded-full' />
        <div className='min-w-0 flex-1 space-y-2'>
          <Skeleton className='h-6 w-48' />
          <Skeleton className='h-4 w-64' />
        </div>
        <span className='sr-only'>กำลังโหลด…</span>
      </div>
    );
  }

  const displayName = user?.fullName?.trim() || user?.username?.trim() || 'บัญชี FihDar';
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? '';

  return (
    <div className='flex min-w-0 items-center gap-4'>
      <Avatar className='size-16 shrink-0'>
        <AvatarImage src={user?.imageUrl ?? undefined} alt='' />
        <AvatarFallback>
          <Icons.user className='size-7' aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className='min-w-0'>
        <h2 className='truncate text-xl font-semibold tracking-tight'>{displayName}</h2>
        {email ? <p className='text-muted-foreground truncate text-[0.9375rem]'>{email}</p> : null}
      </div>
    </div>
  );
}

/**
 * Database-backed profile details. Has its own skeleton / error / retry states
 * so a slow or failing database never takes down the identity header above.
 */
function ProfileDetails() {
  const [editing, setEditing] = React.useState(false);
  const { data, isPending, isError, refetch } = useQuery(profileQueryOptions());

  return (
    <section>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold tracking-tight'>ข้อมูลโปรไฟล์</h2>
        {!isPending && !isError && data && !editing && (
          <Button
            variant='outline'
            onClick={() => setEditing(true)}
            className='h-11 px-4 text-[0.9375rem]'
          >
            <Icons.edit />
            แก้ไขข้อมูล
          </Button>
        )}
      </div>

      <div className='border-border border-t pt-6'>
        {isPending ? (
          <div role='status' aria-label='กำลังโหลดข้อมูลโปรไฟล์' className='grid gap-4 sm:grid-cols-2'>
            <Skeleton className='h-11' />
            <Skeleton className='h-11' />
            <Skeleton className='h-11' />
            <Skeleton className='h-11' />
            <span className='sr-only'>กำลังโหลด…</span>
          </div>
        ) : isError || !data ? (
          <div role='alert' className='border-border rounded-xl border px-6 py-10 text-center'>
            <span className='bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full'>
              <Icons.alertCircle className='size-6' aria-hidden />
            </span>
            <p className='mt-4 text-[1.0625rem] font-semibold'>โหลดข้อมูลโปรไฟล์ไม่สำเร็จ</p>
            <p className='text-muted-foreground mx-auto mt-1 max-w-sm text-[0.9375rem] leading-relaxed'>
              อาจเกิดจากการเชื่อมต่อขัดข้องชั่วคราว
            </p>
            <Button
              variant='outline'
              className='mt-5 h-11 px-5 text-[0.9375rem]'
              onClick={() => void refetch()}
            >
              ลองอีกครั้ง
            </Button>
          </div>
        ) : editing ? (
          <ProfileEditForm profile={data.profile} onDone={() => setEditing(false)} />
        ) : (
          <dl className='grid gap-6 sm:grid-cols-3'>
            <ProfileField label='เบอร์โทรศัพท์' value={data.profile.phone} />
            <ProfileField label='จังหวัด' value={data.profile.province} />
            <ProfileField label='หน่วยงาน' value={data.profile.organization} />
          </dl>
        )}
      </div>
    </section>
  );
}

export function ProfileView() {
  return (
    // Account page, not an admin settings panel: the identity block sits
    // directly on the page background with no card around it. Hierarchy comes
    // from the avatar, type scale and a hairline — not from nested boxes.
    <div className='space-y-10'>
      <section>
        <AccountHeader />
      </section>

      <ProfileDetails />

      <section>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <h2 className='text-lg font-semibold tracking-tight'>รายงานของฉัน</h2>
          <Button
            nativeButton={false}
            variant='outline'
            className='h-11 px-4 text-[0.9375rem]'
            render={<Link href='/report' aria-label='แจ้งการพบ' />}
          >
            <Icons.mapPinPlus />
            แจ้งการพบ
          </Button>
        </div>
        <MyReports />
      </section>
    </div>
  );
}
