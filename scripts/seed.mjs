// Seed script — creates a small, controlled set of system-validation records in
// the real PostgreSQL database so the product (map, filters, profile, APIs) can
// be exercised with realistic data.
//
// All records created here are tagged isSeedData=true with a fixed
// seedBatchId, so they are trivially distinguishable from genuine citizen
// reports and removable in one step (`npm run db:clear-seed`).
//
//   npm run db:seed                      → 18 records owned by a system profile
//   SEED_OWNER_CLERK_ID=user_xxx npm run db:seed
//                                        → also assigns 4 records to that user
//                                          (for testing profile counts/history)
//
// Deterministic and idempotent: every run wipes the previous seed batch first,
// then recreates it from the same fixed inputs, so repeated runs never
// duplicate rows.
import { PrismaClient } from '@prisma/client';

const SEED_BATCH = 'initial-system-validation';
const SYSTEM_PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const SYSTEM_PROFILE_CLERK_ID = 'fihdar-system-validation';

const PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'];

// Synthetic waypoints only — deliberately generic waterway-adjacent points per
// province, never a real reported occurrence.
const PROVINCE_POINTS = {
  'ฉะเชิงเทรา': [
    [13.681, 101.079],
    [13.702, 101.101],
    [13.664, 101.048],
    [13.724, 101.121],
    [13.645, 101.062],
    [13.715, 101.087]
  ],
  'ชลบุรี': [
    [13.362, 100.985],
    [13.383, 101.002],
    [13.341, 100.968],
    [13.403, 101.021],
    [13.324, 100.991],
    [13.391, 100.977]
  ],
  'ระยอง': [
    [12.681, 101.254],
    [12.702, 101.271],
    [12.664, 101.237],
    [12.723, 101.289],
    [12.646, 101.249],
    [12.708, 101.265]
  ]
};

const QUANTITY_RANGES = ['ONE', 'TWO_TO_FIVE', 'SIX_TO_TEN', 'OVER_TEN', 'UNKNOWN'];
const STATUSES = ['VERIFIED', 'VERIFIED', 'REJECTED', 'VERIFIED', 'VERIFIED', 'PENDING'];

const NOTE =
  'ข้อมูลจำลองสำหรับการตรวจสอบระบบ — ไม่ใช่ข้อมูลการพบจริงของปลาหมอคางดำ';

const prisma = new PrismaClient();

function daysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(9, 0, 0, 0);
  return date;
}

async function main() {
  // Wipe any previous seed batch (all seed batches, past and present) so the
  // seed is deterministic and can never duplicate itself.
  const removed = await prisma.sightingReport.deleteMany({ where: { isSeedData: true } });
  if (removed.count > 0) {
    console.log(`removed ${removed.count} previous seed record(s)`);
  }

  const systemProfile = await prisma.userProfile.upsert({
    where: { id: SYSTEM_PROFILE_ID },
    create: {
      id: SYSTEM_PROFILE_ID,
      clerkUserId: SYSTEM_PROFILE_CLERK_ID,
      displayName: 'ระบบตรวจสอบ FihDar',
      email: 'system-validation@fihdar.local',
      organization: 'FihDar (internal)'
    },
    update: {}
  });

  // Optional real-user owner for profile-count testing.
  let ownerProfile = null;
  if (process.env.SEED_OWNER_CLERK_ID) {
    ownerProfile = await prisma.userProfile.upsert({
      where: { clerkUserId: process.env.SEED_OWNER_CLERK_ID },
      create: {
        clerkUserId: process.env.SEED_OWNER_CLERK_ID,
        displayName: 'ผู้ทดสอบระบบ',
        email: 'test-owner@fihdar.local'
      },
      update: {}
    });
    console.log(`assigning 4 records to owner profile ${ownerProfile.clerkUserId}`);
  }

  const records = [];
  let index = 0;
  for (const province of PROVINCES) {
    const points = PROVINCE_POINTS[province];
    for (let j = 0; j < points.length; j += 1) {
      const [latitude, longitude] = points[j];
      const status = STATUSES[j];
      // First four records (2 provinces, mixed statuses) go to the test owner
      // when one is supplied, exercising profile counts + recent reports.
      const reporterId = ownerProfile && index < 4 ? ownerProfile.id : systemProfile.id;
      records.push({
        publicReference: `FD-SEED-${String(index + 1).padStart(3, '0')}`,
        reporterId,
        latitude,
        longitude,
        province,
        district: null,
        subdistrict: null,
        locationDescription: 'ตำแหน่งจำลองสำหรับทดสอบระบบ',
        observedAt: daysAgo((j + 1) * 7 + (index % 3) * 4),
        quantityRange: QUANTITY_RANGES[index % QUANTITY_RANGES.length],
        note: NOTE,
        imagePath: '',
        status,
        isSeedData: true,
        seedBatchId: SEED_BATCH
      });
      index += 1;
    }
  }

  await prisma.sightingReport.createMany({ data: records });
  const counts = await prisma.sightingReport.groupBy({
    by: ['status'],
    where: { isSeedData: true },
    _count: { _all: true }
  });
  const byStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all]));
  console.log(
    `seeded ${records.length} system-validation records (batch "${SEED_BATCH}")`
  );
  console.log(
    `  VERIFIED=${byStatus.VERIFIED ?? 0} PENDING=${byStatus.PENDING ?? 0} REJECTED=${byStatus.REJECTED ?? 0}`
  );
  console.log('run `npm run db:clear-seed` to remove them');
}

main()
  .catch((error) => {
    console.error('seed failed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

