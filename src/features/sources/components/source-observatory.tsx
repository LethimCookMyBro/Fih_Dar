'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { sourceDetailQueryOptions, sourceListQueryOptions } from '@/features/sources/api/queries';
import { formatDateTime, formatNumber, signalCaption } from '@/features/sources/lib/format';
import { cn } from '@/lib/utils';
import type { SourceListSort, SourceStatus } from '@/features/sources/api/types';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'สถานะทั้งหมด' },
  { value: 'OK', label: 'ปกติ' },
  { value: 'DEGRADED', label: 'มีข้อจำกัด' },
  { value: 'UNKNOWN', label: 'ไม่ทราบสถานะ' }
];

const CATEGORY_OPTIONS = ['ข่าวสาธารณะ', 'ข้อมูลเปิดภาครัฐ', 'ข้อมูลพลเมือง'];

const TRANSPORT_OPTIONS = ['RSS', 'CKAN', 'JSON API'];

const SORT_OPTIONS: { value: SourceListSort; label: string }[] = [
  { value: 'name', label: 'ชื่อแหล่งข้อมูล' },
  { value: 'observations', label: 'จำนวนรายการ' },
  { value: 'latest', label: 'ข้อมูลล่าสุด' },
  { value: 'status', label: 'สถานะ' }
];

const SORTABLE_COLUMNS: { key: SourceListSort; label: string }[] = [
  { key: 'name', label: 'แหล่งข้อมูล' },
  { key: 'latest', label: 'ข้อมูลล่าสุด' },
  { key: 'observations', label: 'จำนวนรายการ' }
];

function SourceStatusPill({ status }: { status: SourceStatus }) {
  if (status === 'OK') {
    return (
      <span className='bg-status-verified/10 text-status-verified inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium'>
        <span className='size-1.5 rounded-full bg-current' aria-hidden />
        ปกติ
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span className='bg-status-pending/10 text-status-pending inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium'>
        <span className='size-1.5 rounded-full bg-current' aria-hidden />
        มีข้อจำกัด
      </span>
    );
  }
  return (
    <span className='text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium'>
      <span className='size-1.5 rounded-full bg-current' aria-hidden />
      ไม่ทราบสถานะ
    </span>
  );
}

function TransportIcon({ transport }: { transport: string }) {
  if (transport === 'RSS') return <Icons.rss className='size-4' aria-hidden />;
  if (transport === 'CKAN') return <Icons.database className='size-4' aria-hidden />;
  return <Icons.globe className='size-4' aria-hidden />;
}

// --- Detail drawer -----------------------------------------------------------
function SourceDetailSheet({
  slug,
  onOpenChange
}: {
  slug: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: detail, isPending } = useQuery({
    ...sourceDetailQueryOptions(slug ?? '__none__'),
    enabled: slug !== null
  });

  const open = slug !== null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='right' className='overflow-y-auto'>
        {isPending || !detail ? (
          <div role='status' aria-label='กำลังโหลดรายละเอียดแหล่งข้อมูล' className='space-y-3 p-4'>
            <Skeleton className='h-7 w-40' />
            <Skeleton className='h-4 w-64' />
            <Skeleton className='mt-4 h-40 w-full rounded-xl' />
            <Skeleton className='h-40 w-full rounded-xl' />
            <span className='sr-only'>กำลังโหลด…</span>
          </div>
        ) : (
          <>
            <SheetHeader className='border-border border-b'>
              <SheetTitle className='text-lg font-semibold'>{detail.label}</SheetTitle>
              <SheetDescription>
                {detail.category} · {detail.transport}
              </SheetDescription>
              <div className='pt-2'>
                <SourceStatusPill status={detail.status} />
                {signalCaption(detail) && (
                  <p className='text-muted-foreground mt-1.5 text-[0.8125rem]'>
                    {signalCaption(detail)}
                  </p>
                )}
              </div>
            </SheetHeader>

            <div className='px-4 pb-6'>
              {detail.description && (
                <p className='text-muted-foreground text-[0.875rem] leading-relaxed'>
                  {detail.description}
                </p>
              )}

              <dl className='mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-[0.875rem]'>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ประเภท</dt>
                  <dd className='mt-0.5 font-medium'>{detail.category}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ช่องทาง</dt>
                  <dd className='mt-0.5 font-medium'>{detail.transport}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ผู้ให้ข้อมูล</dt>
                  <dd className='mt-0.5 font-medium'>{detail.authorityType}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ระดับความน่าเชื่อถือ</dt>
                  <dd className='mt-0.5 font-medium'>{detail.trustTier}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ตรวจสอบล่าสุด</dt>
                  <dd className='mt-0.5'>{formatDateTime(detail.lastCheckedAt)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>สำเร็จล่าสุด</dt>
                  <dd className='mt-0.5'>{formatDateTime(detail.lastSuccessAt)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>ข้อมูลล่าสุด</dt>
                  <dd className='mt-0.5'>{formatDateTime(detail.lastNewObservationAt)}</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>จำนวนรายการทั้งหมด</dt>
                  <dd className='mt-0.5 font-semibold tabular-nums'>
                    {formatNumber(detail.totalObservations)}
                  </dd>
                  <dd className='text-muted-foreground text-[0.75rem]'>
                    สะสมตลอดช่วงเวลา — ยังไม่กรองความเกี่ยวข้อง
                  </dd>
                </div>
                <div>
                  <dt className='text-muted-foreground text-[0.75rem]'>รายการที่เกี่ยวข้อง</dt>
                  <dd className='mt-0.5 font-semibold tabular-nums'>
                    {formatNumber(detail.relevantObservations)}
                  </dd>
                  <dd className='text-muted-foreground text-[0.75rem]'>
                    ผ่านการตรวจสอบความเกี่ยวข้องแล้ว
                  </dd>
                </div>
              </dl>

              {detail.homepage && (
                <a
                  href={detail.homepage}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary mt-5 inline-flex items-center gap-1.5 text-[0.875rem] font-medium hover:underline'
                >
                  เยี่ยมชมเว็บไซต์ต้นทาง
                  <Icons.externalLink className='size-3.5' aria-hidden />
                </a>
              )}

              <p className='text-muted-foreground mt-6 text-[0.75rem] leading-relaxed'>
                แสดงเฉพาะข้อมูลที่เปิดเผยได้ — ไม่แสดงรายละเอียดทางเทคนิคของจุดเชื่อมต่อ
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- Observatory -------------------------------------------------------------
function ObservatorySkeleton() {
  return (
    <div role='status' aria-label='กำลังโหลดแหล่งข้อมูล' className='mt-6 space-y-4'>
      <Skeleton className='h-11 w-full rounded-xl' />
      <Skeleton className='h-72 w-full rounded-2xl' />
      <span className='sr-only'>กำลังโหลด…</span>
    </div>
  );
}

export function SourceObservatory() {
  const [searchInput, setSearchInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [transport, setTransport] = React.useState('');
  const [sort, setSort] = React.useState<SourceListSort>('name');
  const [page, setPage] = React.useState(1);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);

  // Debounce the search box; every other filter applies immediately.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = (setter: (value: string) => void) => (value: string | null) => {
    setter(value ?? '');
    setPage(1);
  };

  const { data, isPending, isFetching } = useQuery(
    sourceListQueryOptions({
      q: query || undefined,
      status: status || undefined,
      category: category || undefined,
      transport: transport || undefined,
      sort,
      page,
      pageSize: PAGE_SIZE
    })
  );

  const totalPages = data?.pagination.totalPages ?? 1;
  const summary = data?.summary;

  return (
    <section id='sources' aria-labelledby='observatory-heading' className='scroll-mt-24'>
      <div className='max-w-2xl'>
        <p className='text-primary text-[0.8125rem] font-semibold tracking-wide uppercase'>
          หอสังเกตการณ์แหล่งข้อมูล
        </p>
        <h2
          id='observatory-heading'
          className='mt-2 text-2xl font-semibold tracking-tight sm:text-3xl'
        >
          แหล่งข้อมูลที่เชื่อมต่อ
        </h2>
        <p className='text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed'>
          ทุกแหล่งข้อมูลผ่านการตรวจสอบความน่าเชื่อถือและลงทะเบียนเป็นโค้ดอย่างมีข้อจำกัด —
          ฐานข้อมูลไม่สามารถสั่งให้ระบบไปดึงข้อมูลจาก URL ที่กำหนดเองได้
        </p>
      </div>

      {summary && (
        <p className='text-muted-foreground mt-6 text-[0.875rem]' aria-live='polite'>
          <span className='text-foreground font-semibold'>{formatNumber(summary.total)}</span>{' '}
          แหล่งข้อมูล
          <span className='text-status-verified font-medium'>
            {' '}
            · {formatNumber(summary.healthy)} ปกติ
          </span>
          {summary.degraded > 0 && (
            <span className='text-status-pending font-medium'>
              {' '}
              · {formatNumber(summary.degraded)} มีข้อจำกัด
            </span>
          )}
          {summary.unknown > 0 && (
            <span className='text-muted-foreground font-medium'>
              {' '}
              · {formatNumber(summary.unknown)} ไม่ทราบสถานะ
            </span>
          )}
        </p>
      )}

      {/* Toolbar */}
      <div className='mt-5 flex flex-col gap-2.5 lg:flex-row lg:items-center'>
        <div className='relative flex-1'>
          <Icons.search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
            aria-hidden
          />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder='ค้นหาแหล่งข้อมูล...'
            aria-label='ค้นหาแหล่งข้อมูล'
            className='pl-9'
          />
        </div>
        <div className='flex flex-wrap items-center gap-2.5'>
          <Select value={status} onValueChange={updateFilter(setStatus)}>
            <SelectTrigger size='sm' aria-label='กรองตามสถานะ'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={updateFilter(setCategory)}>
            <SelectTrigger size='sm' aria-label='กรองตามประเภท'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              <SelectItem value=''>ทุกประเภท</SelectItem>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={transport} onValueChange={updateFilter(setTransport)}>
            <SelectTrigger size='sm' aria-label='กรองตามช่องทาง'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              <SelectItem value=''>ทุกช่องทาง</SelectItem>
              {TRANSPORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isPending ? (
        <ObservatorySkeleton />
      ) : (
        <div className='border-border mt-5 overflow-hidden rounded-2xl border bg-card'>
          {data && data.sources.length === 0 ? (
            <div className='px-6 py-14 text-center'>
              <p className='text-muted-foreground text-[0.9375rem]'>ไม่พบแหล่งข้อมูลที่ตรงกับเงื่อนไข</p>
              <Button
                variant='outline'
                className='mt-4 h-10 px-4 text-[0.875rem]'
                onClick={() => {
                  setSearchInput('');
                  setQuery('');
                  setStatus('');
                  setCategory('');
                  setTransport('');
                  setPage(1);
                }}
              >
                ล้างตัวกรองทั้งหมด
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className='hidden overflow-x-auto md:block'>
                <table className='w-full min-w-175 border-collapse text-[0.875rem]'>
                  <thead>
                    <tr className='border-border border-b'>
                      {SORTABLE_COLUMNS.map((column) => {
                        const active = sort === column.key;
                        return (
                          <th
                            key={column.key}
                            aria-sort={active ? 'ascending' : 'none'}
                            className='text-muted-foreground py-3 pr-4 pl-5 text-start font-medium text-[0.75rem] tracking-wide uppercase'
                          >
                            <button
                              type='button'
                              onClick={() => {
                                setSort(column.key);
                                setPage(1);
                              }}
                              className={cn(
                                'inline-flex items-center gap-1.5 uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                                active ? 'text-foreground' : ''
                              )}
                            >
                              {column.label}
                              <Icons.arrowUpDown
                                className={cn('size-3.5', active ? 'text-primary' : 'opacity-50')}
                                aria-hidden
                              />
                            </button>
                          </th>
                        );
                      })}
                      <th className='text-muted-foreground py-3 pr-4 text-start font-medium text-[0.75rem] tracking-wide uppercase'>
                        ช่องทาง
                      </th>
                      <th className='text-muted-foreground py-3 pr-4 text-start font-medium text-[0.75rem] tracking-wide uppercase'>
                        สถานะ
                      </th>
                      <th className='text-muted-foreground py-3 pr-4 text-start font-medium text-[0.75rem] tracking-wide uppercase'>
                        ตรวจสอบล่าสุด
                      </th>
                      <th className='text-muted-foreground py-3 pr-5 text-end font-medium text-[0.75rem] tracking-wide uppercase'>
                        รายการ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.sources.map((source) => {
                      const rowLabel = 'ดูรายละเอียด ' + source.label;
                      return (
                        <tr
                          key={source.id}
                          className={cn(
                            'border-border cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50',
                            isFetching ? 'opacity-60' : ''
                          )}
                          onClick={() => setSelectedSlug(source.slug)}
                        >
                          {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- structural cell (false positive: div child of td); the row's keyboard action is the trailing cell's button */}
                          <td className='py-3.5 pr-4 pl-5'>
                            <div className='flex items-center gap-3'>
                              <span className='border-border text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background'>
                                <TransportIcon transport={source.transport} />
                              </span>
                              <div>
                                <p className='font-medium'>{source.label}</p>
                                <p className='text-muted-foreground text-[0.75rem]'>
                                  {source.category}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className='py-3.5 pr-4 text-muted-foreground whitespace-nowrap'>
                            {formatDateTime(source.lastNewObservationAt)}
                          </td>
                          <td className='py-3.5 pr-4 text-end tabular-nums whitespace-nowrap'>
                            {formatNumber(source.totalObservations)}
                          </td>
                          <td className='py-3.5 pr-4 whitespace-nowrap'>
                            <span className='text-muted-foreground inline-flex items-center gap-1.5'>
                              <TransportIcon transport={source.transport} />
                              {source.transport}
                            </span>
                          </td>
                          <td className='py-3.5 pr-4 whitespace-nowrap'>
                            <SourceStatusPill status={source.status} />
                            {signalCaption(source) && (
                              <p className='text-muted-foreground mt-1 text-[0.75rem]'>
                                {signalCaption(source)}
                              </p>
                            )}
                          </td>
                          <td className='text-muted-foreground py-3.5 pr-4 whitespace-nowrap'>
                            {formatDateTime(source.lastCheckedAt)}
                          </td>
                          <td className='py-3.5 pr-5 text-end whitespace-nowrap'>
                            <button
                              type='button'
                              onClick={() => setSelectedSlug(source.slug)}
                              aria-label={`ดูรายละเอียด ${source.label}`}
                              className='text-muted-foreground rounded-md p-1 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none'
                            >
                              <Icons.chevronRight className='size-4' aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile compact rows */}
              <ul className='md:hidden'>
                {data?.sources.map((source) => (
                  <li key={source.id} className='border-border border-b last:border-0'>
                    <button
                      type='button'
                      onClick={() => setSelectedSlug(source.slug)}
                      className='flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none'
                    >
                      <span className='border-border text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background'>
                        <TransportIcon transport={source.transport} />
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='block truncate font-medium'>{source.label}</span>
                        <span className='text-muted-foreground block truncate text-[0.75rem]'>
                          {source.category} · {source.transport} ·{' '}
                          {formatNumber(source.totalObservations)} รายการ
                        </span>
                      </span>
                      <span className='flex shrink-0 flex-col items-end gap-1'>
                        <SourceStatusPill status={source.status} />
                        {signalCaption(source) && (
                          <span className='text-muted-foreground text-end text-[0.6875rem]'>
                            {signalCaption(source)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Footer: pagination */}
              <div className='border-border flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5'>
                <p className='text-muted-foreground text-[0.8125rem]' aria-live='polite'>
                  แสดง {data?.sources.length ?? 0} จาก {formatNumber(data?.pagination.total ?? 0)}{' '}
                  แหล่ง
                </p>
                <div className='flex items-center gap-1.5'>
                  <Button
                    variant='outline'
                    size='icon-sm'
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    aria-label='หน้าก่อนหน้า'
                  >
                    <Icons.chevronLeft />
                  </Button>
                  <span className='text-muted-foreground px-2 text-[0.8125rem] tabular-nums'>
                    หน้า {formatNumber(page)} / {formatNumber(totalPages)}
                  </span>
                  <Button
                    variant='outline'
                    size='icon-sm'
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    aria-label='หน้าถัดไป'
                  >
                    <Icons.chevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Mobile sort helper — the table headers are desktop-only */}
      <div className='mt-3 md:hidden'>
        <Select
          value={sort}
          onValueChange={(value) => {
            setSort(value as SourceListSort);
            setPage(1);
          }}
        >
          <SelectTrigger size='sm' aria-label='เรียงลำดับแหล่งข้อมูล'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align='end'>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SourceDetailSheet
        slug={selectedSlug}
        onOpenChange={(open) => !open && setSelectedSlug(null)}
      />
    </section>
  );
}
