// Pure labels/ordering for the PRE-FIELD operational decision layer
// (DISPATCH/MONITOR/DEFER). Kept free of prisma/server-only, mirroring
// field-outcomes.ts, so the deterministic self-test can import it directly.
import { OperationalDecisionType } from '@prisma/client';

export const OPERATIONAL_DECISION_LABELS: Record<OperationalDecisionType, string> = {
  DISPATCH: 'ส่งทีมลงพื้นที่',
  MONITOR: 'เฝ้าระวังก่อน',
  DEFER: 'ยังไม่ดำเนินการ'
};

export const OPERATIONAL_DECISIONS: OperationalDecisionType[] = ['DISPATCH', 'MONITOR', 'DEFER'];
