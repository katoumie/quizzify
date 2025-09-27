// /scripts/inspect-bkt-params.ts
// npx ts-node scripts/inspect-bkt-params.ts "Mathematics,Biology"
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const names = (process.argv[2] || "").split(",").map(s => s.trim()).filter(Boolean);
  const skills = await prisma.skill.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
  const ids = skills.map(s => s.id);
  const rows = await prisma.bKTParams.findMany({
    where: { skillId: { in: ids } },
    select: { skillId: true, pInit: true, pTransit: true, slip: true, guess: true, forget: true },
  });
  const byId = Object.fromEntries(rows.map(r => [r.skillId, r]));
  for (const s of skills) console.log(s.name, byId[s.id] ?? "(no row → using DEFAULT_BKT)");
}
main().finally(() => process.exit(0));