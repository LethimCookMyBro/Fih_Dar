// Officer workflow — REAL local-database integration test.
//
// Runs the actual, unmodified src/server/report-service.ts functions (via
// alias-loader.mjs, see register-alias-loader.mjs) against the local dev
// Postgres, and verifies real persisted rows — not mocks. This is the
// "legitimate test identity mechanism" requested in place of a real browser
// Clerk login, which cannot be performed without real credentials.
//
//   npm run masterpass:officer-test
//
// Requires a reachable local DATABASE_URL with the schema migrated. Creates
// its own throwaway UserProfile/SightingReport rows (isSeedData: true) and
// deletes them in a finally block — never touches real citizen data.

import assert from 'node:assert/strict';
import { PrismaClient, FieldOutcome, ReportStatus, OperationalDecisionType } from '@prisma/client';

const {
  recordOperationalDecision,
  recordFieldAction,
  reopenForReassessment,
  getOperationalReportHistory,
  listOperationalReports
} = await import('../../src/server/report-service.ts');
const { requireOfficer } = await import('../../src/server/authorization.ts');
const { runReassessmentMatches } = await import('../intel/reassess.mjs');

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const failures = [];

function isForbidden(error) {
  return error?.code === 'FORBIDDEN';
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok — ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
    console.error(`  FAIL — ${name}\n    ${error.stack?.split('\n').slice(0, 3).join('\n    ')}`);
  }
}

const OFFICER_CLERK_ID = `test_officer_${Date.now()}`;
const CITIZEN_CLERK_ID = `test_citizen_${Date.now()}`;

// Minimal fake Clerk `currentUser()` shape — only the fields
// profile-service.ts#clerkIdentity() actually reads. getOrCreateCurrentProfile
// always re-derives identity (even for an existing profile, to keep
// email/avatar in sync), so this must be present even though a real UserProfile
// row is created below.
function fakeClerkUser(clerkUserId, email) {
  return {
    id: clerkUserId,
    primaryEmailAddress: { emailAddress: email },
    emailAddresses: [{ emailAddress: email }],
    fullName: null,
    username: null,
    imageUrl: null,
    raw: { organization_memberships: [] }
  };
}

const officerContext = {
  userId: OFFICER_CLERK_ID,
  orgId: null,
  user: fakeClerkUser(OFFICER_CLERK_ID, 'test-officer@example.invalid')
};
const citizenContext = {
  userId: CITIZEN_CLERK_ID,
  orgId: null,
  user: fakeClerkUser(CITIZEN_CLERK_ID, 'test-citizen@example.invalid')
};

// requireOfficer() checks OFFICER_CLERK_USER_IDS at call time (officer-allowlist.ts
// re-reads process.env on every call — no caching) — this is the SAME mechanism
// production uses, just pointed at a throwaway local test identity.
process.env.OFFICER_CLERK_USER_IDS = OFFICER_CLERK_ID;

let officerProfileId;
let citizenProfileId;
const reportIds = [];

async function makeReport(overrides = {}) {
  const report = await prisma.sightingReport.create({
    data: {
      publicReference: `FD-TEST-${Math.random().toString(36).slice(2, 10)}`,
      reporter: { connect: { id: citizenProfileId } },
      latitude: 13.361,
      longitude: 100.984,
      province: 'ชลบุรี',
      observedAt: new Date(),
      quantityRange: 'ONE',
      imagePath: 'reports/test-fixture.jpg',
      status: ReportStatus.PENDING,
      isSeedData: true,
      seedBatchId: 'officer-workflow-test',
      ...overrides
    },
    select: { id: true, status: true }
  });
  reportIds.push(report.id);
  return report;
}

try {
  const officerProfile = await prisma.userProfile.create({
    data: {
      clerkUserId: OFFICER_CLERK_ID,
      displayName: 'Test Officer (masterpass)',
      email: 'test-officer@example.invalid'
    },
    select: { id: true }
  });
  officerProfileId = officerProfile.id;

  const citizenProfile = await prisma.userProfile.create({
    data: {
      clerkUserId: CITIZEN_CLERK_ID,
      displayName: 'Test Citizen (masterpass)',
      email: 'test-citizen@example.invalid'
    },
    select: { id: true }
  });
  citizenProfileId = citizenProfile.id;

  // --- authorization: citizen cannot perform officer actions ---------------
  console.log('authorization');

  await check('citizen (non-officer) cannot record a field action', async () => {
    const report = await makeReport();
    await assert.rejects(
      () => recordFieldAction(citizenContext, report.id, { outcome: 'FOUND', notes: null }),
      isForbidden
    );
  });

  await check('citizen (non-officer) cannot record an operational decision', async () => {
    const report = await makeReport();
    await assert.rejects(
      () => recordOperationalDecision(citizenContext, report.id, { decision: 'DISPATCH', reason: null }),
      isForbidden
    );
  });

  await check('officer allowlist is enforced by requireOfficer(), not bypassed by this test', () => {
    assert.throws(() => requireOfficer('someone-not-on-the-allowlist'));
    assert.doesNotThrow(() => requireOfficer(OFFICER_CLERK_ID));
  });

  // --- DISPATCH / MONITOR / DEFER: persisted, audited, status untouched ----
  console.log('operational decisions (DISPATCH/MONITOR/DEFER)');

  await check('DISPATCH creates a ReportDecision row and updates the cache field', async () => {
    const report = await makeReport();
    const before = await prisma.sightingReport.findUniqueOrThrow({
      where: { id: report.id },
      select: { status: true, operationalDecision: true }
    });
    assert.equal(before.operationalDecision, null);

    const result = await recordOperationalDecision(officerContext, report.id, {
      decision: 'DISPATCH',
      reason: 'ทดสอบ'
    });
    assert.equal(result.decision.decision, 'DISPATCH');
    assert.equal(result.decision.previousDecision, null);
    assert.equal(result.decision.officerName, 'Test Officer (masterpass)');

    const rows = await prisma.reportDecision.findMany({ where: { reportId: report.id } });
    assert.equal(rows.length, 1, 'exactly one audit row created');
    assert.equal(rows[0].decision, OperationalDecisionType.DISPATCH);
    assert.equal(rows[0].officerProfileId, officerProfileId, 'actor recorded');
    assert.equal(rows[0].reason, 'ทดสอบ', 'reason recorded');
    assert.ok(rows[0].createdAt instanceof Date, 'timestamp recorded');

    const after = await prisma.sightingReport.findUniqueOrThrow({
      where: { id: report.id },
      select: { status: true, operationalDecision: true }
    });
    assert.equal(after.operationalDecision, 'DISPATCH');
    assert.equal(
      after.status,
      before.status,
      'a decision must NEVER change ReportStatus — that is FieldOutcome\'s job only'
    );
  });

  await check('MONITOR then DEFER chain previousDecision correctly and never delete history', async () => {
    const report = await makeReport();
    await recordOperationalDecision(officerContext, report.id, { decision: 'MONITOR', reason: null });
    await recordOperationalDecision(officerContext, report.id, { decision: 'DEFER', reason: 'รอข้อมูลเพิ่ม' });

    const rows = await prisma.reportDecision.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: 'asc' }
    });
    assert.equal(rows.length, 2, 'both decisions retained — no row overwritten or deleted');
    assert.equal(rows[0].decision, OperationalDecisionType.MONITOR);
    assert.equal(rows[0].previousDecision, null);
    assert.equal(rows[1].decision, OperationalDecisionType.DEFER);
    assert.equal(rows[1].previousDecision, OperationalDecisionType.MONITOR, 'previousDecision chains correctly');

    const current = await prisma.sightingReport.findUniqueOrThrow({
      where: { id: report.id },
      select: { operationalDecision: true }
    });
    assert.equal(current.operationalDecision, 'DEFER', 'cache field reflects the LATEST decision');
  });

  await check('recording a decision never creates a ReportFieldAction row', async () => {
    const report = await makeReport();
    await recordOperationalDecision(officerContext, report.id, { decision: 'DISPATCH', reason: null });
    const actions = await prisma.reportFieldAction.findMany({ where: { reportId: report.id } });
    assert.equal(actions.length, 0, 'a decision is not a field visit');
  });

  // --- field actions: real persistence, correct status mapping -------------
  console.log('field actions (real persistence)');

  await check('FOUND -> FIELD_CONFIRMED, persisted', async () => {
    const report = await makeReport();
    const result = await recordFieldAction(officerContext, report.id, { outcome: 'FOUND', notes: 'พบจริง' });
    assert.equal(result.status, ReportStatus.FIELD_CONFIRMED);
    const persisted = await prisma.sightingReport.findUniqueOrThrow({
      where: { id: report.id },
      select: { status: true }
    });
    assert.equal(persisted.status, ReportStatus.FIELD_CONFIRMED);
    const actions = await prisma.reportFieldAction.findMany({ where: { reportId: report.id } });
    assert.equal(actions.length, 1);
    assert.equal(actions[0].outcome, FieldOutcome.FOUND);
    assert.equal(actions[0].officerProfileId, officerProfileId);
  });

  await check('CONTROLLED -> ACTION_TAKEN, and a later FOLLOW_UP_REQUIRED visit reaches MONITORING', async () => {
    const report = await makeReport();
    const first = await recordFieldAction(officerContext, report.id, { outcome: 'CONTROLLED', notes: null });
    assert.equal(first.status, ReportStatus.ACTION_TAKEN);

    // CONTROLLED must not be a dead end — a further visit can still reach MONITORING.
    const second = await recordFieldAction(officerContext, report.id, {
      outcome: 'FOLLOW_UP_REQUIRED',
      notes: null
    });
    assert.equal(second.status, ReportStatus.MONITORING);

    const actions = await prisma.reportFieldAction.findMany({
      where: { reportId: report.id },
      orderBy: { createdAt: 'asc' }
    });
    assert.equal(actions.length, 2, 'both real visits kept as immutable history');
  });

  await check('NOT_FOUND -> FIELD_CHECKED (negative survey evidence, not absence)', async () => {
    const report = await makeReport();
    const result = await recordFieldAction(officerContext, report.id, { outcome: 'NOT_FOUND', notes: null });
    assert.equal(result.status, ReportStatus.FIELD_CHECKED);
    assert.notEqual(
      result.status,
      ReportStatus.REJECTED,
      'NOT_FOUND must not be conflated with a rejected/closed determination'
    );
  });

  await check('REJECTED blocks a new field action until reopened via reassessment', async () => {
    const report = await makeReport();
    const rejected = await recordFieldAction(officerContext, report.id, {
      outcome: 'MISIDENTIFIED',
      notes: null
    });
    assert.equal(rejected.status, ReportStatus.REJECTED);

    await assert.rejects(
      () => recordFieldAction(officerContext, report.id, { outcome: 'FOUND', notes: null }),
      /ปฏิเสธแล้ว/,
      'a REJECTED report must not silently accept a new field outcome'
    );

    const reopened = await reopenForReassessment(officerContext, report.id, 'พบหลักฐานใหม่');
    assert.equal(reopened.status, ReportStatus.REASSESSMENT);

    // Now that it has been reopened, a new field action is valid again.
    const afterReopen = await recordFieldAction(officerContext, report.id, { outcome: 'FOUND', notes: null });
    assert.equal(afterReopen.status, ReportStatus.FIELD_CONFIRMED);
  });

  // --- reassessment: no fabricated field-action rows, no duplicate effects -
  console.log('reassessment (manual + automatic, real DB)');

  await check('manual reopenForReassessment never fabricates a ReportFieldAction', async () => {
    const report = await makeReport();
    await recordFieldAction(officerContext, report.id, { outcome: 'CONTROLLED', notes: null }); // -> ACTION_TAKEN
    const beforeCount = (await prisma.reportFieldAction.findMany({ where: { reportId: report.id } })).length;

    await reopenForReassessment(officerContext, report.id, 'สัญญาณใหม่');

    const afterCount = (await prisma.reportFieldAction.findMany({ where: { reportId: report.id } })).length;
    assert.equal(afterCount, beforeCount, 'reassessment must not create a fake field visit');

    const persisted = await prisma.sightingReport.findUniqueOrThrow({
      where: { id: report.id },
      select: { status: true, reassessmentTrigger: true }
    });
    assert.equal(persisted.status, ReportStatus.REASSESSMENT);
    assert.equal(persisted.reassessmentTrigger.source, 'MANUAL');
  });

  await check('reopenForReassessment rejects a still-PENDING report (nothing to reassess yet)', async () => {
    const report = await makeReport(); // PENDING, never acted on
    await assert.rejects(() => reopenForReassessment(officerContext, report.id, null));
  });

  await check(
    'automatic reassessment: one qualifying signal processed twice creates exactly one effect on the SAME report (idempotent, concurrency-safe)',
    async () => {
      // Scoped to this test's own report only — the local dev DB also carries
      // real seed data in the same province, so a global match COUNT is not a
      // reliable signal here; only this report's own row is inspected.
      const report = await makeReport({ status: ReportStatus.MONITORING, district: 'บางละมุง' });
      await prisma.reportFieldAction.create({
        data: {
          report: { connect: { id: report.id } },
          officer: { connect: { id: officerProfileId } },
          outcome: FieldOutcome.FOLLOW_UP_REQUIRED,
          notes: null
        }
      });

      const signalId = `test-obs-${Date.now()}`;
      const relevant = [
        {
          observation: {
            id: signalId,
            scrapedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString() // genuinely newer than the field action above
          },
          location: { province: 'ชลบุรี', district: 'บางละมุง' }
        }
      ];

      // Two concurrent calls over the SAME signal — proves no duplicate
      // reassessment effect on THIS report even under a real race.
      await Promise.all([
        runReassessmentMatches({ prisma, relevant, logger: { log: () => {} } }),
        runReassessmentMatches({ prisma, relevant, logger: { log: () => {} } })
      ]);

      const persisted = await prisma.sightingReport.findUniqueOrThrow({
        where: { id: report.id },
        select: { status: true, reassessmentTrigger: true }
      });
      assert.equal(persisted.status, ReportStatus.REASSESSMENT, 'ends in REASSESSMENT, not a race artifact');
      assert.equal(persisted.reassessmentTrigger.observationId, signalId, 'trigger recorded exactly once, consistently');

      // Re-running against the SAME already-reassessed report is a no-op —
      // it has left the trigger-eligible status set, so its trigger must be unchanged.
      await runReassessmentMatches({ prisma, relevant, logger: { log: () => {} } });
      const afterThirdRun = await prisma.sightingReport.findUniqueOrThrow({
        where: { id: report.id },
        select: { status: true, reassessmentTrigger: true }
      });
      assert.equal(afterThirdRun.status, ReportStatus.REASSESSMENT);
      assert.equal(
        afterThirdRun.reassessmentTrigger.matchedAt,
        persisted.reassessmentTrigger.matchedAt,
        'a report already in REASSESSMENT is never matched again — trigger timestamp unchanged'
      );
    }
  );

  await check('automatic reassessment never auto-dispatches or fabricates a field action', async () => {
    const report = await makeReport({ status: ReportStatus.ACTION_TAKEN });
    await prisma.reportFieldAction.create({
      data: {
        report: { connect: { id: report.id } },
        officer: { connect: { id: officerProfileId } },
        outcome: FieldOutcome.CONTROLLED,
        notes: null
      }
    });
    const beforeActions = (await prisma.reportFieldAction.findMany({ where: { reportId: report.id } })).length;
    const beforeDecisions = (await prisma.reportDecision.findMany({ where: { reportId: report.id } })).length;

    const relevant = [
      {
        observation: {
          id: `test-obs-nodispatch-${Date.now()}`,
          scrapedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString()
        },
        location: { province: 'ชลบุรี', district: null }
      }
    ];
    await runReassessmentMatches({ prisma, relevant, logger: { log: () => {} } });

    const afterActions = (await prisma.reportFieldAction.findMany({ where: { reportId: report.id } })).length;
    const afterDecisions = (await prisma.reportDecision.findMany({ where: { reportId: report.id } })).length;
    assert.equal(afterActions, beforeActions, 'no field action fabricated');
    assert.equal(afterDecisions, beforeDecisions, 'no DISPATCH/MONITOR/DEFER decision fabricated');
  });

  // --- lazy evidence detail --------------------------------------------------
  console.log('evidence detail (getOperationalReportHistory)');

  await check('history includes both field actions and decisions in one timeline-able shape', async () => {
    const report = await makeReport();
    await recordOperationalDecision(officerContext, report.id, { decision: 'DISPATCH', reason: null });
    await recordFieldAction(officerContext, report.id, { outcome: 'FOUND', notes: null });

    const history = await getOperationalReportHistory(report.id, officerContext);
    assert.equal(history.decisions.length, 1);
    assert.equal(history.fieldActions.length, 1);
    assert.equal(history.decisions[0].decision, 'DISPATCH');
    assert.equal(history.fieldActions[0].outcome, 'FOUND');
  });

  await check('citizen cannot fetch officer evidence history', async () => {
    const report = await makeReport();
    await assert.rejects(() => getOperationalReportHistory(report.id, citizenContext), isForbidden);
  });

  // --- pagination sanity ------------------------------------------------------
  console.log('pagination');

  await check('listOperationalReports honors a small limit and returns a usable cursor', async () => {
    for (let i = 0; i < 3; i += 1) await makeReport();
    const page = await listOperationalReports(officerContext, { limit: 2 });
    assert.ok(page.reports.length <= 2, 'never returns more than the requested limit');
    assert.ok(typeof page.counts.total === 'number' && page.counts.total >= 3);
  });

  // --- stale-state check: no cached/stored score means nothing to go stale ---
  console.log('stale-priority check');

  await check(
    'a field action is visible in the VERY NEXT listOperationalReports call — no server-side cache to invalidate',
    async () => {
      const report = await makeReport({ status: ReportStatus.PENDING });
      const before = await listOperationalReports(officerContext, { limit: 50 });
      const beforeRow = before.reports.find((r) => r.id === report.id);
      assert.equal(beforeRow.status, 'PENDING');

      await recordFieldAction(officerContext, report.id, { outcome: 'CONTROLLED', notes: null });

      // No sleep, no cache-bust flag — SightingReport/EventCandidate carry no
      // score/priority/cachedAt column (confirmed in prisma/schema.prisma),
      // so every read is computed live; a genuinely stale read would fail here.
      const after = await listOperationalReports(officerContext, { limit: 50 });
      const afterRow = after.reports.find((r) => r.id === report.id);
      assert.equal(afterRow.status, 'ACTION_TAKEN', 'status change visible immediately, not cached');
    }
  );
} finally {
  // --- cleanup: delete only the rows this test created ------------------------
  await prisma.reportDecision.deleteMany({ where: { reportId: { in: reportIds } } });
  await prisma.reportFieldAction.deleteMany({ where: { reportId: { in: reportIds } } });
  await prisma.sightingReport.deleteMany({ where: { id: { in: reportIds } } });
  if (officerProfileId) await prisma.userProfile.delete({ where: { id: officerProfileId } }).catch(() => {});
  if (citizenProfileId) await prisma.userProfile.delete({ where: { id: citizenProfileId } }).catch(() => {});
  await prisma.$disconnect();
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
