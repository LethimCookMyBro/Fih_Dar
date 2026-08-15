import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { REPORT_STATUS_LABELS, type ReportStatus } from '@/features/reports/api/types';

// Colour is never the only signal — each status carries its own icon and label.
const STATUS_STYLE: Record<ReportStatus, { className: string; icon: keyof typeof Icons }> = {
  PENDING: {
    className: 'text-status-pending border-status-pending/40 bg-status-pending/10',
    icon: 'clock'
  },
  VERIFIED: {
    className: 'text-status-verified border-status-verified/40 bg-status-verified/10',
    icon: 'circleCheck'
  },
  REJECTED: {
    className: 'text-status-rejected border-status-rejected/40 bg-status-rejected/10',
    icon: 'circleX'
  }
};

export function ReportStatusBadge({
  status,
  className
}: {
  status: ReportStatus;
  className?: string;
}) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  const Icon = Icons[style.icon];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        style.className,
        className
      )}
    >
      <Icon className='size-3.5' aria-hidden />
      {REPORT_STATUS_LABELS[status] ?? status}
    </span>
  );
}
