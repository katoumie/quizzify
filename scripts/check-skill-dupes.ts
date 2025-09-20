import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1) Rows missing nameNorm
  const missingRes = await prisma.$queryRaw<{ missing: number }[]>`
    SELECT COUNT(*)::int AS missing
    FROM "Skill"
    WHERE "nameNorm" IS NULL
  `;
  console.log('Missing nameNorm:', missingRes[0]?.missing ?? 0);

  // 2) Duplicates after normalization
  const dupes = await prisma.$queryRaw<{ namenorm: string; c: number }[]>`
    SELECT "nameNorm" AS namenorm, COUNT(*)::int AS c
    FROM "Skill"
    GROUP BY "nameNorm"
    HAVING COUNT(*) > 1
  `;
  console.log('Duplicates:', dupes);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
