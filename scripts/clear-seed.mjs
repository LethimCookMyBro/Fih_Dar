// Removes every system-validation record created by `npm run db:seed`.
//
// Deletion is scoped strictly to isSeedData=true — genuine citizen reports
// always carry isSeedData=false and can never be matched by this query, so a
// stray `db:clear-seed` can never delete real user data.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const removed = await prisma.sightingReport.deleteMany({ where: { isSeedData: true } });
  const remaining = await prisma.sightingReport.count();
  console.log(`removed ${removed.count} system-validation record(s)`);
  console.log(`remaining SightingReport rows: ${remaining} (genuine records untouched)`);
}

main()
  .catch((error) => {
    console.error('clear-seed failed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
