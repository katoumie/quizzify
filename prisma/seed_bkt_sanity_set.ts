// /prisma/seed_bkt_sanity_set.ts
// Usage: npx ts-node prisma/seed_bkt_sanity_set.ts "you@example.com"
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// mimic your app’s normalizeSkill: trim, collapse spaces, lowercase
function normalizeSkillName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function upsertSkillByName(name: string) {
  const nameNorm = normalizeSkillName(name);
  return prisma.skill.upsert({
    where: { nameNorm },           // <-- unique key in your schema
    update: {},                    // no-op
    create: { name, nameNorm },    // <-- nameNorm required
  });
}

async function main() {
  const ownerEmail = (process.argv[2] || "").trim();
  if (!ownerEmail) throw new Error('Usage: npx ts-node prisma/seed_bkt_sanity_set.ts "you@example.com"');

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) throw new Error(`No user with email ${ownerEmail}`);

  // Remove previous copy for this owner & title (keeps testing clean)
  const existing = await prisma.studySet.findFirst({
    where: { ownerId: owner.id, title: "BKT Sanity Set (Math & Bio)" },
    select: { id: true },
  });
  if (existing) {
    await prisma.studySet.delete({ where: { id: existing.id } });
  }

  // Ensure skills (name + nameNorm)
  const math = await upsertSkillByName("Mathematics");
  const bio  = await upsertSkillByName("Biology");

  // Create the set (private, no default skill; cards will be explicit)
  const set = await prisma.studySet.create({
    data: {
      ownerId: owner.id,
      title: "BKT Sanity Set (Math & Bio)",
      description: "Two skills, two items each, for BKT sanity checks.",
      isPublic: false,
      defaultSkillId: null,
    },
  });

  // 4 cards (explicit skills via CardSkill; inheritDefault=false)
  const rows = [
    { term: "3x + 5 = 14",   definition: "Solve for x.",                 skillId: math.id }, // Math #1
    { term: "d/dx (x^2)",    definition: "State the derivative.",        skillId: math.id }, // Math #2
    { term: "Mitochondria",  definition: "Its primary role in a cell.",  skillId: bio.id  }, // Bio #1
    { term: "DNA base pairs",definition: "Give the base pairs.",         skillId: bio.id  }, // Bio #2
  ];

  let position = 1;
  for (const r of rows) {
    const card = await prisma.card.create({
      data: {
        setId: set.id,
        term: r.term,
        definition: r.definition,
        position,
        imageUrl: null,
        inheritDefault: false,
      },
      select: { id: true },
    });
    position += 1;

    await prisma.cardSkill.create({
      data: { cardId: card.id, skillId: r.skillId, weight: 1.0 },
    });
  }

  console.log("Seeded set:", set.id, "→", set.title);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
