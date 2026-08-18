'use client';

import * as React from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAppForm } from '@/lib/form';
import { ReportStatusBadge } from '@/features/reports/components/report-status-badge';
import {
  FIELD_OUTCOME_LABELS,
  FIELD_OUTCOMES,
  LOCATION_PRECISION_LABELS,
  OPERATIONAL_DECISIONS,
  OPERATIONAL_DECISION_LABELS,
  PHOTO_LOCATION_RELATION_LABELS,
  REPORT_QUANTITY_RANGE_LABELS,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  type FieldOutcome,
  type OperationalDecisionType,
  type ReportStatus
} from '@/features/reports/api/types';
import {
  recordFieldAction,
  recordOperationalDecision,
  reopenForReassessment,
  type OperationalReport
} from '@/features/reports/api/service';
import { formatThaiDate } from '@/features/reports/lib/format';
import {
  operationalReportHistoryQueryOptions,
  operationalReportsQueryOptions,
  opsKeys
} from '../api/queries';
import { PriorityLane } from './priority-lane';

const STATUS_FILTERS: { key: 'ALL' | ReportStatus; label: string }[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  ...REPORT_STATUSES.map((status) => ({
    key: status as ReportStatus,
    label: REPORT_STATUS_LABELS[status]
  }))
];

const SCOPE_FILTERS: { key: 'EEC' | 'ALL'; label: string }[] = [
  { key: 'EEC', label: 'พื้นที่นำร่อง EEC' },
  { key: 'ALL', label: 'ทั้งหมด (รวมนอกพื้นที่นำร่อง)' }
];

const DECISION_ICONS: Record<OperationalDecisionType, keyof typeof Icons> = {
  DISPATCH: 'send',
  MONITOR: 'radar',
  DEFER: 'minus'
};

const fieldActionSchema = z.object({
  outcome: z.enum(FIELD_OUTCOMES, { error: 'กรุณาเลือกผลการลงพื้นที่' }),
  notes: z.string().trim().max(1000, 'บันทึกยาวเกินไป').optional()
});

const reopenSchema = z.object({
  notes: z.string().trim().max(1000, 'บันทึกยาวเกินไป').optional()
});

const decisionReasonSchema = z.object({
  reason: z.string().trim().max(1000, 'เหตุผลยาวเกินไป').optional()
});

function FieldActionForm({ report, onDone }: { report: OperationalReport; onDone: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      reportId,
      input
    }: {
      reportId: string;
      input: { outcome: FieldOutcome; notes: string | null };
    }) => recordFieldAction(reportId, input),
    onSuccess: async () => {
      toast.success('บันทึกผลการลงพื้นที่แล้ว');
      await queryClient.invalidateQueries({ queryKey: opsKeys.all });
      onDone();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง')
  });

  const form = useAppForm({
    defaultValues: { outcome: undefined, notes: '' } as unknown as z.input<
      typeof fieldActionSchema
    >,
    validators: { onSubmit: fieldActionSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        reportId: report.id,
        input: { outcome: value.outcome, notes: value.notes?.trim() || null }
      });
    }
  });

  return (
    <form
      className='border-border bg-muted/40 mt-4 space-y-4 rounded-xl border p-4'
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name='outcome'
        children={(field) => (
          <field.SelectField
            label='ผลการลงพื้นที่'
            required
            placeholder='เลือกผลการลงพื้นที่'
            options={FIELD_OUTCOMES.map((outcome) => ({
              value: outcome,
              label: FIELD_OUTCOME_LABELS[outcome]
            }))}
          />
        )}
      />
      <form.AppField
        name='notes'
        children={(field) => (
          <field.TextareaField
            label='บันทึกเพิ่มเติม'
            description='ไม่บังคับ — สภาพพื้นที่ เหตุผลที่ไม่พบ หรือรายละเอียดการดำเนินการ'
            rows={3}
          />
        )}
      />
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' disabled={mutation.isPending} className='h-11 px-5 text-[0.9375rem]'>
          {mutation.isPending ? <Icons.spinner className='animate-spin' /> : null}
          บันทึกผลการลงพื้นที่
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

function ReopenForm({ report, onDone }: { report: OperationalReport; onDone: () => void }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ reportId, notes }: { reportId: string; notes: string | null }) =>
      reopenForReassessment(reportId, notes),
    onSuccess: async () => {
      toast.success('ตั้งสถานะเป็น “ต้องประเมินซ้ำ” แล้ว');
      await queryClient.invalidateQueries({ queryKey: opsKeys.all });
      onDone();
    },
    onError: () => toast.error('ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง')
  });

  const form = useAppForm({
    defaultValues: { notes: '' } as unknown as z.input<typeof reopenSchema>,
    validators: {
      onSubmit: reopenSchema
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ reportId: report.id, notes: value.notes?.trim() || null });
    }
  });

  return (
    <form
      className='border-border bg-muted/40 mt-4 space-y-4 rounded-xl border p-4'
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p className='text-[0.875rem] leading-relaxed'>
        ใช้เมื่อมีหลักฐานใหม่หลังการดำเนินการครั้งล่าสุด (เช่น มีรายงานพบซ้ำในบริเวณเดิม) —
        ระบบจะไม่ประกาศการระบาดใหม่จากรายงานเดียวโดยอัตโนมัติ
      </p>
      <form.AppField
        name='notes'
        children={(field) => (
          <field.TextareaField label='บันทึกสัญญาณใหม่' description='ไม่บังคับ — ระบุหลักฐานที่พบ' rows={2} />
        )}
      />
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' disabled={mutation.isPending} className='h-11 px-5 text-[0.9375rem]'>
          {mutation.isPending ? <Icons.spinner className='animate-spin' /> : null}
          ยืนยัน — ต้องประเมินซ้ำ
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
 * PRE-FIELD triage — DISPATCH/MONITOR/DEFER — deliberately separate from
 * FieldActionForm above (a POST-visit result). Recording a decision never
 * touches ReportStatus and never fabricates a field visit.
 */
function DecisionForm({
  report,
  decision,
  onDone
}: {
  report: OperationalReport;
  decision: OperationalDecisionType;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ reportId, reason }: { reportId: string; reason: string | null }) =>
      recordOperationalDecision(reportId, { decision, reason }),
    onSuccess: async () => {
      toast.success(`บันทึกการตัดสินใจ “${OPERATIONAL_DECISION_LABELS[decision]}” แล้ว`);
      await queryClient.invalidateQueries({ queryKey: opsKeys.all });
      onDone();
    },
    onError: () => toast.error('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง')
  });

  const form = useAppForm({
    defaultValues: { reason: '' } as unknown as z.input<typeof decisionReasonSchema>,
    validators: { onSubmit: decisionReasonSchema },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ reportId: report.id, reason: value.reason?.trim() || null });
    }
  });

  return (
    <form
      className='border-border bg-muted/40 mt-4 space-y-4 rounded-xl border p-4'
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name='reason'
        children={(field) => (
          <field.TextareaField
            label={`เหตุผล — ${OPERATIONAL_DECISION_LABELS[decision]}`}
            description='ไม่บังคับ'
            rows={2}
          />
        )}
      />
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' disabled={mutation.isPending} className='h-11 px-5 text-[0.9375rem]'>
          {mutation.isPending ? <Icons.spinner className='animate-spin' /> : null}
          ยืนยัน — {OPERATIONAL_DECISION_LABELS[decision]}
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

function DecisionButtons({ report }: { report: OperationalReport }) {
  const [active, setActive] = React.useState<OperationalDecisionType | null>(null);

  return (
    <div>
      <div className='flex flex-wrap gap-2'>
        {OPERATIONAL_DECISIONS.map((decision) => {
          const Icon = Icons[DECISION_ICONS[decision]];
          const isCurrent = report.operationalDecision === decision;
          return (
            <Button
              key={decision}
              type='button'
              size='sm'
              variant={isCurrent ? 'default' : 'outline'}
              className='h-10 px-3.5 text-[0.8125rem]'
              onClick={() => setActive(decision)}
            >
              <Icon className='size-4' aria-hidden />
              {OPERATIONAL_DECISION_LABELS[decision]}
            </Button>
          );
        })}
      </div>
      {active && <DecisionForm report={report} decision={active} onDone={() => setActive(null)} />}
    </div>
  );
}

/** Full field-action + decision history — loaded on demand, never bundled into the list. */
function EvidenceDetail({ reportId }: { reportId: string }) {
  const { data, isPending, isError } = useQuery(operationalReportHistoryQueryOptions(reportId));

  if (isPending) {
    return (
      <div className='space-y-2 p-4'>
        <Skeleton className='h-6 w-full rounded' />
        <Skeleton className='h-6 w-3/4 rounded' />
      </div>
    );
  }
  if (isError || !data) {
    return <p className='text-muted-foreground p-4 text-[0.8125rem]'>โหลดหลักฐานไม่สำเร็จ</p>;
  }

  const timeline = [
    ...data.decisions.map((decision) => ({
      kind: 'decision' as const,
      at: decision.createdAt,
      label: `การตัดสินใจ: ${OPERATIONAL_DECISION_LABELS[decision.decision]}`,
      by: decision.officerName,
      notes: decision.reason
    })),
    ...data.fieldActions.map((action) => ({
      kind: 'field' as const,
      at: action.createdAt,
      label: `ผลการลงพื้นที่: ${FIELD_OUTCOME_LABELS[action.outcome]}`,
      by: action.officerName,
      notes: action.notes
    }))
  ].toSorted((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (timeline.length === 0) {
    return <p className='text-muted-foreground p-4 text-[0.8125rem]'>ยังไม่มีประวัติการดำเนินการ</p>;
  }

  return (
    <ul className='space-y-3 p-4'>
      {timeline.map((entry, index) => (
        <li key={`${entry.kind}-${index}`} className='flex items-start gap-2 text-[0.8125rem]'>
          <Icons.timelineEvent className='mt-0.5 size-4 shrink-0' aria-hidden />
          <div className='min-w-0'>
            <p className='font-medium'>{entry.label}</p>
            <p className='text-muted-foreground'>
              {entry.by} · {formatThaiDate(entry.at)}
            </p>
            {entry.notes && <p className='text-muted-foreground mt-0.5'>{entry.notes}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function OpsCard({ report }: { report: OperationalReport }) {
  const [showFieldAction, setShowFieldAction] = React.useState(false);
  const [showReopen, setShowReopen] = React.useState(false);
  const [showEvidence, setShowEvidence] = React.useState(false);

  const openFieldAction = () => {
    setShowReopen(false);
    setShowFieldAction(true);
  };
  const openReopen = () => {
    setShowFieldAction(false);
    setShowReopen(true);
  };

  return (
    <li className='border-border divide-y rounded-xl border'>
      <div className='p-4 sm:p-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='font-mono text-[0.9375rem] font-medium'>{report.publicReference}</p>
              {report.isSeedData && (
                <span className='bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem]'>
                  ข้อมูลทดสอบระบบ
                </span>
              )}
              {report.isEecPilot === false && (
                <span
                  title='พื้นที่นี้อยู่นอกเขตนำร่อง EEC — เก็บไว้เพื่อการเฝ้าระวัง ไม่ใช่คิวส่งทีมลงพื้นที่ตามแผนปัจจุบัน'
                  className='border-status-pending/40 bg-status-pending/10 rounded-full border px-2 py-0.5 text-[0.6875rem]'
                >
                  นอกพื้นที่นำร่อง EEC
                </span>
              )}
              {report.operationalDecision && (
                <span className='bg-brand/10 text-brand rounded-full px-2 py-0.5 text-[0.6875rem] font-medium'>
                  {OPERATIONAL_DECISION_LABELS[report.operationalDecision]}
                </span>
              )}
            </div>
            <p className='text-muted-foreground mt-1 text-[0.8125rem]'>
              ผู้แจ้ง: {report.reporterName} · ส่งเมื่อ {formatThaiDate(report.createdAt)}
            </p>
          </div>
          <ReportStatusBadge status={report.status} />
        </div>

        <dl className='text-muted-foreground mt-3 grid gap-x-6 gap-y-1.5 text-[0.8125rem] sm:grid-cols-2'>
          <div className='flex gap-2'>
            <dt className='shrink-0'>ตำแหน่ง:</dt>
            <dd className='min-w-0 break-words'>
              {report.province}
              {report.district ? ` · ${report.district}` : ''} ·{' '}
              {LOCATION_PRECISION_LABELS[report.locationPrecision] ?? report.locationPrecision}
            </dd>
          </div>
          <div className='flex gap-2'>
            <dt className='shrink-0'>พบเมื่อ:</dt>
            <dd>{formatThaiDate(report.observedAt)}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='shrink-0'>จำนวน:</dt>
            <dd>{REPORT_QUANTITY_RANGE_LABELS[report.quantityRange] ?? report.quantityRange}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='shrink-0'>รูปถ่าย:</dt>
            <dd>
              {PHOTO_LOCATION_RELATION_LABELS[report.photoLocationRelation] ??
                report.photoLocationRelation}
            </dd>
          </div>
        </dl>

        {report.note && (
          <p className='bg-muted/50 text-muted-foreground mt-3 rounded-lg p-3 text-[0.8125rem] leading-relaxed'>
            {report.note}
          </p>
        )}

        {report.latestFieldAction && (
          <div className='mt-3 flex items-start gap-2 text-[0.8125rem]'>
            <Icons.timelineEvent className='mt-0.5 size-4 shrink-0' aria-hidden />
            <p className='text-muted-foreground leading-relaxed'>
              <span className='font-medium'>
                {FIELD_OUTCOME_LABELS[report.latestFieldAction.outcome] ??
                  report.latestFieldAction.outcome}
              </span>{' '}
              · {report.latestFieldAction.officerName} ·{' '}
              {formatThaiDate(report.latestFieldAction.createdAt)}
              {report.latestFieldAction.notes && (
                <span className='mt-0.5 block'>{report.latestFieldAction.notes}</span>
              )}
            </p>
          </div>
        )}

        <div className='mt-4 space-y-3'>
          <div>
            <p className='text-muted-foreground mb-1.5 text-[0.75rem] font-medium'>
              การตัดสินใจปฏิบัติการ
            </p>
            <DecisionButtons report={report} />
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              className='h-11 px-4 text-[0.875rem]'
              onClick={openFieldAction}
            >
              <Icons.edit />
              บันทึกผลการลงพื้นที่
            </Button>
            {report.status !== 'REASSESSMENT' && (
              <Button
                type='button'
                variant='outline'
                className='h-11 px-4 text-[0.875rem]'
                onClick={openReopen}
              >
                <Icons.radar />
                พบสัญญาณใหม่ — ต้องประเมินซ้ำ
              </Button>
            )}
            <Button
              type='button'
              variant='ghost'
              className='h-11 px-4 text-[0.875rem]'
              aria-expanded={showEvidence}
              onClick={() => setShowEvidence((v) => !v)}
            >
              <Icons.chevronDown
                className={cn('transition-transform', showEvidence && 'rotate-180')}
              />
              ดูหลักฐาน
            </Button>
          </div>
        </div>
      </div>

      {showFieldAction && (
        <FieldActionForm report={report} onDone={() => setShowFieldAction(false)} />
      )}
      {showReopen && <ReopenForm report={report} onDone={() => setShowReopen(false)} />}
      {showEvidence && <EvidenceDetail reportId={report.id} />}
    </li>
  );
}

export function OpsView() {
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | ReportStatus>('ALL');
  const [scope, setScope] = React.useState<'EEC' | 'ALL'>('EEC');

  const filters = React.useMemo(
    () => ({ status: statusFilter === 'ALL' ? undefined : statusFilter, scope }),
    [statusFilter, scope]
  );

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(operationalReportsQueryOptions(filters));

  const reports = React.useMemo(() => data?.pages.flatMap((page) => page.reports) ?? [], [data]);
  const counts = data?.pages[0]?.counts;

  return (
    <div className='space-y-10'>
      <section className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          {SCOPE_FILTERS.map(({ key, label }) => (
            <Button
              key={key}
              type='button'
              variant={scope === key ? 'default' : 'outline'}
              size='sm'
              className='h-10 px-3.5 text-[0.875rem]'
              onClick={() => setScope(key)}
              aria-pressed={scope === key}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {STATUS_FILTERS.map(({ key, label }) => (
            <Button
              key={key}
              type='button'
              variant={statusFilter === key ? 'default' : 'outline'}
              size='sm'
              className='h-10 px-3.5 text-[0.875rem]'
              onClick={() => setStatusFilter(key)}
              aria-pressed={statusFilter === key}
            >
              {label}
              {key !== 'ALL' && counts && (
                <span className='ml-1 tabular-nums'>{counts[key] ?? 0}</span>
              )}
            </Button>
          ))}
        </div>

        {isPending && (
          <div role='status' aria-label='กำลังโหลดรายงานปฏิบัติการ' className='space-y-6'>
            <Skeleton className='h-12 w-full rounded-xl' />
            <Skeleton className='h-44 w-full rounded-xl' />
            <Skeleton className='h-44 w-full rounded-xl' />
            <span className='sr-only'>กำลังโหลด…</span>
          </div>
        )}

        {isError && (
          <div role='alert' className='border-border rounded-xl border px-6 py-10 text-center'>
            <span className='bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full'>
              <Icons.alertCircle className='size-6' aria-hidden />
            </span>
            <p className='mt-4 text-[1.0625rem] font-semibold'>โหลดรายงานปฏิบัติการไม่สำเร็จ</p>
            <Button
              variant='outline'
              className='mt-5 h-11 px-5 text-[0.9375rem]'
              onClick={() => void refetch()}
            >
              ลองอีกครั้ง
            </Button>
          </div>
        )}

        {!isPending && !isError && (
          <>
            {reports.length === 0 ? (
              <div className='border-border rounded-xl border border-dashed px-6 py-12 text-center'>
                <span className='bg-muted text-muted-foreground mx-auto flex size-12 items-center justify-center rounded-full'>
                  <Icons.fish className='size-6' aria-hidden />
                </span>
                <p className='mt-4 text-[1.0625rem] font-semibold'>ไม่มีรายงานในเงื่อนไขนี้</p>
              </div>
            ) : (
              <>
                <ul className='space-y-4'>
                  {reports.map((report) => (
                    <OpsCard key={report.id} report={report} />
                  ))}
                </ul>
                {hasNextPage && (
                  <div className='flex justify-center pt-2'>
                    <Button
                      type='button'
                      variant='outline'
                      className='h-11 px-6 text-[0.9375rem]'
                      disabled={isFetchingNextPage}
                      onClick={() => void fetchNextPage()}
                    >
                      {isFetchingNextPage ? <Icons.spinner className='animate-spin' /> : null}
                      โหลดเพิ่มเติม
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <PriorityLane />
    </div>
  );
}
