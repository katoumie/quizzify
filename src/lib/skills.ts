// /src/lib/skills.ts
import { Prisma, PrismaClient } from "@prisma/client";

export const normalizeSkill = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

/** Use the same tx the route is using */
export async function ensureUserSkillTx(
  tx: Prisma.TransactionClient,
  userId: string,
  rawLabel: string
) {
  const name = rawLabel.replace(/\s+/g, " ").trim().slice(0, 40);
  const nameNorm = normalizeSkill(name);

  const skill = await tx.skill.upsert({
    where: { nameNorm },
    create: { name, nameNorm },
    update: {},
  });

  await tx.userSkill.upsert({
    where: { userId_skillId: { userId, skillId: skill.id } },
    create: { userId, skillId: skill.id },
    update: {},
  });

  return skill;
}
