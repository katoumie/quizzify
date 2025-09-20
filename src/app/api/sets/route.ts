// /src/app/api/sets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserSkillTx, normalizeSkill } from "@/lib/skills";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type InCard = {
  term: string;
  definition: string;
  position?: number;
  imageUrl?: string | null;
  /**
   * Tri-state at the API boundary:
   *  - omit 'skill' key  -> inherit default (inheritDefault=true)
   *  - skill: null       -> explicit None   (inheritDefault=false)
   *  - skill: "Math"     -> explicit skill  (inheritDefault=false)
   */
  skill?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const ownerId = String(body?.ownerId || "");
    const title = String(body?.title || "").trim();
    const description =
      body?.description === null
        ? null
        : typeof body?.description === "string"
        ? body.description.trim()
        : null;
    const isPublic = typeof body?.isPublic === "boolean" ? body.isPublic : false;

    // NEW: optional default skill label for the set
    const defaultSkillLabel: string | null =
      typeof body?.defaultSkill === "string" && body.defaultSkill.trim()
        ? body.defaultSkill.trim()
        : body?.defaultSkill === null
        ? null
        : undefined;

    const rawCards = Array.isArray(body?.cards) ? (body.cards as InCard[]) : [];
    if (!ownerId) return NextResponse.json({ error: "Missing ownerId." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (!rawCards.length) {
      return NextResponse.json({ error: "Please include at least one card." }, { status: 400 });
    }

    // Normalize with tri-state semantics
    const clean = rawCards
      .map((c, i) => {
        const hasSkillProp = Object.prototype.hasOwnProperty.call(c, "skill");
        const rawSkill = (c as any).skill as string | null | undefined;
        const explicitSkill =
          typeof rawSkill === "string" && rawSkill.trim().length > 0
            ? rawSkill.trim()
            : null; // null means explicit None when hasSkillProp === true

        const inheritDefault = !hasSkillProp; // omit => inherit
        const attachLabel: string | undefined =
          hasSkillProp && explicitSkill ? explicitSkill : undefined;

        return {
          term: String(c?.term || "").trim(),
          definition: String(c?.definition || "").trim(),
          position: Number.isFinite(c?.position) ? Number(c.position) : i,
          imageUrl: c?.imageUrl ? String(c.imageUrl) : null,
          inheritDefault, // boolean
          attachLabel,    // string | undefined
        };
      })
      .filter((c) => c.term || c.definition);

    if (!clean.length) {
      return NextResponse.json(
        { error: "Please include at least one non-empty card." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1) Create (or resolve) default skill id if provided
      let defaultSkillId: string | null | undefined = undefined;
      if (defaultSkillLabel === null) {
        defaultSkillId = null; // explicitly none
      } else if (typeof defaultSkillLabel === "string") {
        const s = await ensureUserSkillTx(tx, ownerId, defaultSkillLabel);
        defaultSkillId = s.id;
      }

      // 2) Create set
      const set = await tx.studySet.create({
        data: {
          title,
          description,
          isPublic,
          ownerId,
          ...(typeof defaultSkillId !== "undefined" ? { defaultSkillId } : {}),
        },
        select: { id: true, isPublic: true },
      });

      // 3) Create cards
      const created: { id: string; label?: string }[] = [];
      for (const c of clean) {
        const card = await tx.card.create({
          data: {
            term: c.term,
            definition: c.definition,
            position: c.position,
            imageUrl: c.imageUrl,
            setId: set.id,
            inheritDefault: c.inheritDefault,
          },
          select: { id: true },
        });
        created.push({ id: card.id, label: c.attachLabel });
      }

      // 4) Ensure/attach explicit skills
      const normToOriginal = new Map<string, string>();
      for (const { label } of created) {
        if (!label) continue;
        const norm = normalizeSkill(label);
        if (!normToOriginal.has(norm)) normToOriginal.set(norm, label);
      }

      const normToSkillId = new Map<string, string>();
      for (const [norm, original] of normToOriginal) {
        const skill = await ensureUserSkillTx(tx, ownerId, original);
        normToSkillId.set(norm, skill.id);
      }

      for (const { id: cardId, label } of created) {
        if (!label) continue;
        const skillId = normToSkillId.get(normalizeSkill(label));
        if (!skillId) continue;
        await tx.cardSkill.create({ data: { cardId, skillId, weight: 1.0 } });
      }

      return set;
    });

    return NextResponse.json(
      { ok: true, id: result.id, isPublic: result.isPublic },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/sets error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
