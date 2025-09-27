// /src/app/api/sets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserSkillTx, normalizeSkill } from "@/lib/skills";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type InCard = {
  term: string;
  definition: string;
  position?: number;
  imageUrl?: string | null;
  /** Tri-state: omit -> inherit, null -> explicit None, "Math" -> explicit skill */
  skill?: string | null;
};

/** Remove UserSkill rows for skills the owner no longer uses anywhere */
async function cleanupUserSkillsTx(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const usedInCards = await tx.cardSkill.findMany({
    where: { card: { set: { ownerId: userId } } },
    select: { skillId: true },
    distinct: ["skillId"],
  });

  const usedAsDefault = await tx.studySet.findMany({
    where: { ownerId: userId, NOT: { defaultSkillId: null } },
    select: { defaultSkillId: true },
  });

  const stillUsed = new Set<string>();
  for (const r of usedInCards) stillUsed.add(r.skillId);
  for (const r of usedAsDefault) if (r.defaultSkillId) stillUsed.add(r.defaultSkillId);

  if (stillUsed.size > 0) {
    await tx.userSkill.deleteMany({ where: { userId, skillId: { notIn: Array.from(stillUsed) } } });
  } else {
    await tx.userSkill.deleteMany({ where: { userId } });
  }
}

/** GET: include defaultSkill + cards (inheritDefault + explicit skill if present) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const setId = params.id;
    if (!setId) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      include: {
        defaultSkill: { select: { id: true, name: true } },
        cards: {
          orderBy: { position: "asc" },
          include: {
            // Relation from Card -> CardSkill[]
            // Using 'skills' as the relation field (rename if yours differs)
            skills: { include: { skill: { select: { id: true, name: true } } } }, // first only (MVP)
          },
        },
      },
    });
    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      {
        id: set.id,
        title: set.title,
        description: set.description,
        isPublic: set.isPublic,
        defaultSkill: set.defaultSkill ? { id: set.defaultSkill.id, name: set.defaultSkill.name } : null,
        cards: set.cards.map((c) => ({
          id: c.id,
          term: c.term,
          definition: c.definition,
          position: c.position,
          imageUrl: c.imageUrl,
          inheritDefault: (c as any).inheritDefault ?? true, // boolean on Card in your schema
          skill: (c as any).skills?.[0]?.skill?.name ?? null, // null if explicit None
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** PATCH: meta + defaultSkill + cards + GC user skills */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const setId = params.id;
    if (!setId) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string | null;
      isPublic?: boolean;
      defaultSkill?: string | null; // string => set, null => clear, undefined => unchanged
      cards?: InCard[];
      ownerId?: string;
    };

    const title = typeof body?.title === "string" ? body.title.trim() : undefined;
    const description =
      body?.description === null
        ? null
        : typeof body?.description === "string"
        ? body.description.trim()
        : undefined;
    const isPublic = typeof body?.isPublic === "boolean" ? body.isPublic : undefined;

    const defaultSkillLabel: string | null | undefined =
      typeof body?.defaultSkill === "string" && body.defaultSkill.trim()
        ? body.defaultSkill.trim()
        : body?.defaultSkill === null
        ? null
        : undefined;

    const rawCards = Array.isArray(body?.cards) ? (body.cards as InCard[]) : undefined;

    if (
      typeof title === "undefined" &&
      typeof description === "undefined" &&
      typeof isPublic === "undefined" &&
      typeof defaultSkillLabel === "undefined" &&
      !rawCards
    ) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const setMeta = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { ownerId: true, isPublic: true },
    });
    if (!setMeta) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const ownerIdForSkills = body.ownerId ?? setMeta.ownerId;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // (1) Update meta + defaultSkill (if provided)
      if (
        typeof title !== "undefined" ||
        typeof description !== "undefined" ||
        typeof isPublic !== "undefined" ||
        typeof defaultSkillLabel !== "undefined"
      ) {
        let defaultSkillIdPatch: { defaultSkillId?: string | null } = {};
        if (typeof defaultSkillLabel !== "undefined") {
          if (defaultSkillLabel === null) {
            defaultSkillIdPatch.defaultSkillId = null;
          } else {
            const sk = await ensureUserSkillTx(tx, ownerIdForSkills, defaultSkillLabel);
            defaultSkillIdPatch.defaultSkillId = sk.id;
          }
        }

        await tx.studySet.update({
          where: { id: setId },
          data: {
            ...(typeof title !== "undefined" ? { title } : {}),
            ...(typeof description !== "undefined" ? { description } : {}),
            ...(typeof isPublic !== "undefined" ? { isPublic } : {}),
            ...defaultSkillIdPatch,
          },
        });
      }

      // (2) Replace cards honoring inherit vs explicit (incl. explicit None)
      if (rawCards) {
        const clean = rawCards
          .map((c, i) => {
            const hasSkillProp = Object.prototype.hasOwnProperty.call(c, "skill");
            const rawSkill = (c as any).skill as string | null | undefined;
            const explicitSkill =
              typeof rawSkill === "string" && rawSkill.trim().length > 0 ? rawSkill.trim() : null;

            // omit => inherit; present but null/empty => explicit None; present + string => explicit skill
            const inheritDefault = !hasSkillProp;
            const attachLabel: string | undefined =
              hasSkillProp && explicitSkill ? explicitSkill : undefined;

            return {
              term: String(c?.term || "").trim(),
              definition: String(c?.definition || "").trim(),
              position: Number.isFinite(c?.position) ? Number(c.position) : i,
              imageUrl: c?.imageUrl ? String(c.imageUrl) : null,
              inheritDefault,
              attachLabel, // never null; undefined means "no card-skill row"
            };
          })
          .filter((c) => c.term || c.definition);

        // Drop all existing cards (CardSkill rows cascade if schema set accordingly)
        await tx.card.deleteMany({ where: { setId } });

        // Recreate and note which need a CardSkill attach
        const created: { id: string; label?: string }[] = [];
        for (const c of clean) {
          const card = await tx.card.create({
            data: {
              term: c.term,
              definition: c.definition,
              position: c.position,
              imageUrl: c.imageUrl,
              setId,
              inheritDefault: c.inheritDefault,
            },
            select: { id: true },
          });
          created.push({ id: card.id, label: c.attachLabel });
        }

        // Ensure skills for explicit labels
        const normToOriginal = new Map<string, string>();
        for (const { label } of created) {
          if (!label) continue;
          const norm = normalizeSkill(label);
          if (!normToOriginal.has(norm)) normToOriginal.set(norm, label);
        }

        const normToSkillId = new Map<string, string>();
        for (const [norm, original] of normToOriginal) {
          const skill = await ensureUserSkillTx(tx, ownerIdForSkills, original);
          normToSkillId.set(norm, skill.id);
        }

        // Attach CardSkill for each explicit label
        for (const { id: cardId, label } of created) {
          if (!label) continue; // inherit or explicit None -> no CardSkill row
          const skillId = normToSkillId.get(normalizeSkill(label));
          if (!skillId) continue;
          await tx.cardSkill.create({ data: { cardId, skillId, weight: 1.0 } });
        }
      }

      // (3) If public → private, remove non-owner likes
      if (setMeta.isPublic && isPublic === false) {
        await tx.like.deleteMany({ where: { setId, NOT: { userId: setMeta.ownerId } } });
      }

      // (4) GC user's personal skill library
      await cleanupUserSkillsTx(tx, ownerIdForSkills);
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PATCH /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE: owner-guarded delete + GC skills */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const setId = params.id;
  if (!setId) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  try {
    // Accept ownerId from query or JSON body (matches your library page)
    const url = new URL(req.url);
    let ownerId = url.searchParams.get("ownerId");
    if (!ownerId) {
      const body = await req.json().catch(() => ({} as any));
      if (typeof body?.ownerId === "string") ownerId = body.ownerId;
    }
    if (!ownerId) return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });

    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: { ownerId: true },
    });
    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (set.ownerId !== ownerId) {
      return NextResponse.json(
        { error: "Forbidden: ownerId does not match set owner." },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.studySet.delete({ where: { id: setId } });
      await cleanupUserSkillsTx(tx, ownerId!);
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    if (err?.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this set due to related records. Ensure onDelete: Cascade in your Prisma schema or delete dependents first.",
        },
        { status: 409 }
      );
    }
    console.error("DELETE /api/sets/[id] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
