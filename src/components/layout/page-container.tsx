import React from 'react';
import { Heading } from '../ui/heading';
import { Skeleton } from '@/components/ui/skeleton';
import type { InfobarContent } from '@/components/ui/infobar';

function PageSkeleton() {
  return (
    <div role='status' aria-label='กำลังโหลดหน้า' className='flex flex-1 flex-col gap-4'>
      <Skeleton className='h-9 w-56' />
      <Skeleton className='h-5 w-full max-w-md' />
      <Skeleton className='mt-4 h-44 w-full rounded-xl' />
      <Skeleton className='h-44 w-full rounded-xl' />
      <span className='sr-only'>กำลังโหลด…</span>
    </div>
  );
}

export default function PageContainer({
  children,
  isLoading = false,
  access = true,
  accessFallback,
  pageTitle,
  pageDescription,
  infoContent,
  pageHeaderAction
}: {
  children: React.ReactNode;
  isLoading?: boolean;
  access?: boolean;
  accessFallback?: React.ReactNode;
  pageTitle?: string;
  pageDescription?: string;
  infoContent?: InfobarContent;
  pageHeaderAction?: React.ReactNode;
}) {
  if (!access) {
    return (
      <div role='status' className='flex flex-1 items-center justify-center px-4 py-16'>
        {accessFallback ?? (
          <div className='text-muted-foreground max-w-sm text-center text-[0.9375rem]'>
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </div>
        )}
      </div>
    );
  }

  const content = isLoading ? <PageSkeleton /> : children;

  const hasHeader = pageTitle || pageHeaderAction;

  // Spacing rhythm: 16px mobile → 24px tablet → 32px desktop, matching the
  // 4/8px scale. max-w keeps line length readable on wide monitors; the map
  // page opts out entirely by not using PageContainer.
  return (
    <div className='flex flex-1 flex-col px-4 pt-5 pb-10 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col'>
        {hasHeader && (
          <div className='mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8'>
            <Heading
              title={pageTitle ?? ''}
              description={pageDescription ?? ''}
              infoContent={infoContent}
            />
            {pageHeaderAction && <div className='shrink-0'>{pageHeaderAction}</div>}
          </div>
        )}
        {content}
      </div>
    </div>
  );
}
