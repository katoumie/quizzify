import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

async function main() {
  const skills = await prisma.skill.findMany({ select: { id: true, name: true, nameNorm: true } });
  for (const s of skills) {
    const nameNorm = norm(s.name);
    if (s.nameNorm !== nameNorm) {
      await prisma.skill.update({ where: { id: s.id }, data: { nameNorm } });
    }
  }
  console.log(`Backfilled ${skills.length} skills.`);
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
