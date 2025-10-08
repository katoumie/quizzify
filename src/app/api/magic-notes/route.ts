// /src/app/api/magic-notes/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/ai";
import { getAuthedUserId } from "@/lib/auth";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 60;

type OutSection = { heading: string | null; contentMd: string };
type OutNote = { title: string | null; sections: OutSection[] };

const MAX_CHARS = 60_000;
const CHUNK_SIZE = 12_000;
const MAX_SECTIONS = 30;

/* =========================
   GET /api/magic-notes
   Returns the caller's notes list (owner-only).
   ========================= */
export async function GET(req: Request) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get("ownerId") || userId;
    if (ownerId !== userId) {
      // Prevent fetching someone else’s notes
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Select only fields that exist on your MagicNote model
    const rows = await prisma.magicNote.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        // If your model has an owner relation:
        owner: { select: { id: true, username: true, avatar: true } },
      },
    });

    // No likes for notes yet — keep a stable shape with likeCount: 0
    const notes = rows.map((n) => ({
      ...n,
      likeCount: 0,
    }));

    return NextResponse.json({ notes }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/magic-notes error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* =========================
   POST /api/magic-notes
   Generate a note from an uploaded file
   ========================= */
export async function POST(req: Request) {
  try {
    const ownerId = await getAuthedUserId();
    if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!process.env.OPENAI_API_KEY) {
      console.error("[MagicNotes] Missing OPENAI_API_KEY");
      return NextResponse.json({ error: "Server is missing OpenAI API key." }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const titleFromClient = (form.get("title") as string | null)?.trim() || undefined;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const contentType = file.type || "";
    const name = file.name || "upload";
    const buf = Buffer.from(await file.arrayBuffer());
    console.log("[MagicNotes] Upload:", { name, contentType, size: buf.byteLength });

    // 1) Extract text
    let rawText: string;
    try {
      rawText = await extractText(buf, contentType, name);
    } catch (e: any) {
      console.error("[MagicNotes] extractText() failed:", e);
      return NextResponse.json({ error: `Could not extract text (${e?.message || "unknown"})` }, { status: 400 });
    }
    if (!rawText?.trim()) return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });

    const text = rawText.slice(0, MAX_CHARS);
    console.log("[MagicNotes] Extracted chars:", text.length);

    // 2) Generate sections with OpenAI
    let generated: OutNote;
    try {
      generated = await buildMagicNote(text, titleFromClient, name);
    } catch (e: any) {
      console.error("[MagicNotes] OpenAI fail:", e);
      return NextResponse.json({ error: `OpenAI failed (${e?.message || "unknown"})` }, { status: 500 });
    }

    // 3) Sanitize
    const sections = (generated.sections ?? [])
      .filter((s) => s && typeof s.contentMd === "string" && s.contentMd.trim())
      .slice(0, MAX_SECTIONS)
      .map<OutSection>((s) => ({
        heading: s.heading ? String(s.heading).slice(0, 120) : null,
        contentMd: String(s.contentMd).slice(0, 10_000),
      }));

    const noteTitle = (titleFromClient || generated.title || fallbackTitle(name)).slice(0, 160);

    // 4) Persist
    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.magicNote.create({
        data: {
          ownerId,
          title: noteTitle,
          status: "READY",
          sourceName: name,
          sourceMime: contentType || null,
          sourceSize: buf.byteLength,
          wordCount: roughWordCount(text),
          sectionCount: sections.length,
        },
      });
      if (sections.length) {
        await tx.magicNoteSection.createMany({
          data: sections.map((s, idx) => ({
            noteId: created.id,
            position: idx,
            heading: s.heading,
            contentMd: s.contentMd,
          })),
        });
      }
      return created;
    });

    return NextResponse.json({ id: note.id }, { status: 200 });
  } catch (err) {
    console.error("POST /api/magic-notes error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* ---------- helpers ---------- */

function fallbackTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim() || "Magic Notes";
}
function roughWordCount(s: string) {
  return s.trim().split(/\s+/g).length;
}
function chunkString(s: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

async function extractText(buf: Buffer, contentType: string, filename: string): Promise<string> {
  const lc = (contentType || "").toLowerCase();
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (lc.includes("pdf") || ext === "pdf") {
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse: any = mod.default || mod;
    const res = await pdfParse(buf);
    return (res && res.text) || "";
  }

  if (lc.includes("officedocument.wordprocessingml") || ext === "docx") {
    const { value: html } = await mammoth.convertToHtml({ buffer: buf });
    return htmlToText(html);
  }

  if (lc.includes("officedocument.presentationml") || lc.includes("powerpoint") || ext === "pptx") {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter((p) => p.startsWith("ppt/slides/slide") && p.endsWith(".xml"))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0));
    const decode = (s: string) =>
      s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const slideTexts: string[] = [];
    for (const path of slideFiles) {
      const xml = await zip.files[path].async("string");
      const runs = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => decode(m[1]).trim());
      const notes = Array.from(xml.matchAll(/<p:notes[^>]*>([\s\S]*?)<\/p:notes>/g)).map((m) => decode(m[1]).trim());
      const text = [...runs, ...notes].filter(Boolean).join("\n").trim();
      if (text) slideTexts.push(text);
    }
    const all = slideTexts.join("\n\n");
    if (all.trim()) return all;

    const noteFiles = Object.keys(zip.files)
      .filter((p) => p.startsWith("ppt/notesSlides/notesSlide") && p.endsWith(".xml"))
      .sort((a, b) => Number(a.match(/notesSlide(\d+)\.xml$/)?.[1] || 0) - Number(b.match(/notesSlide(\d+)\.xml$/)?.[1] || 0));
    const noteTexts: string[] = [];
    for (const path of noteFiles) {
      const xml = await zip.files[path].async("string");
      const runs = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => decode(m[1]).trim());
      const text = runs.filter(Boolean).join("\n").trim();
      if (text) noteTexts.push(text);
    }
    return noteTexts.join("\n\n");
  }

  return buf.toString("utf8");
}
function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function buildMagicNote(text: string, titleHint: string | undefined, filename: string): Promise<OutNote> {
  const chunks = chunkString(text, CHUNK_SIZE);
  const perChunkSections: OutSection[] = [];

  for (const [i, chunk] of chunks.entries()) {
    const remaining = MAX_SECTIONS - perChunkSections.length;
    if (remaining <= 0) break;

    const { sections } = await askOpenAI({
      mode: "sections-only",
      body: chunk,
      index: i + 1,
      total: chunks.length,
      desiredCount: Math.min(12, remaining),
    });

    if (Array.isArray(sections)) perChunkSections.push(...sections);
    if (perChunkSections.length >= MAX_SECTIONS) break;
  }

  const final = await askOpenAI({
    mode: "title-and-merge",
    body: text.slice(0, 8000),
    seedSections: perChunkSections.slice(0, MAX_SECTIONS),
    titleHint: titleHint || fallbackTitle(filename),
  });

  return {
    title: final.title || titleHint || fallbackTitle(filename),
    sections: (final.sections?.length ? final.sections : perChunkSections).slice(0, MAX_SECTIONS),
  };
}

type AskArgs =
  | { mode: "sections-only"; body: string; index: number; total: number; desiredCount?: number }
  | { mode: "title-and-merge"; body: string; seedSections: OutSection[]; titleHint: string };

async function askOpenAI(args: AskArgs): Promise<OutNote> {
  const system = `You are an expert study-note writer for university students.
Rewrite and synthesize the source material using your **own words**. Do **not** copy slide or textbook wording.
Explain the *why* and *how* (intuition, relationships, tradeoffs) — not just lists of facts.
Use Markdown with "##" headings and '---' between major sections. Prefer short paragraphs; use bullets only when they clarify structure.
Compress aggressively: remove boilerplate, repetition, and slide cruft. Keep tone academically neutral and cohesive.`;

  const user =
    args.mode === "sections-only"
      ? `CHUNK ${args.index}/${args.total}
From the text below, produce up to ${Math.max(1, Math.min(args.desiredCount ?? 12, MAX_SECTIONS))} **summarized** sections.
Each section must be **paraphrased** (no verbatim copying) and feel like a lecturer's explanation.

For every section, return:
- "heading": short string (or null if not needed)
- "contentMd": concise Markdown (<= 1800 chars) written in your own words
- Keep flow cohesive; use bullets sparingly to clarify structure.

TEXT:
"""${args.body}"""`

      : `Merge and deduplicate the seed sections into a coherent mini-lesson written in your own words (no copying).
Return:
1) "title": short, informative title
2) "sections": ordered list of sections, each { "heading": string|null, "contentMd": string } using concise Markdown prose.

SEED_SECTIONS (for guidance; you may rewrite, merge, or drop):
${JSON.stringify((args as any).seedSections ?? [], null, 2)}

TEXT_SAMPLE (for additional context; paraphrase it, don't copy):
"""${args.body}"""

TITLE_HINT: ${(args as any).titleHint}`;

  const tools = [
    {
      type: "function" as const,
      function: {
        name: "return_magic_note",
        description: "Return the structured magic note.",
        parameters: {
          type: "object",
          properties: {
            title: { type: ["string", "null"] },
            sections: {
              type: "array",
              items: {
                type: "object",
                required: ["contentMd"],
                properties: {
                  heading: { type: ["string", "null"] },
                  contentMd: { type: "string" },
                },
              },
            },
          },
          required: ["sections"],
          additionalProperties: false,
        },
      },
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "return_magic_note" } },
    temperature: 0.7,
  });

  const msg = completion.choices[0]?.message;
  let parsed: any = null;
  const tc = msg?.tool_calls?.[0];
  if (tc && tc.type === "function" && (tc as any).function?.arguments) {
    try {
      parsed = JSON.parse((tc as any).function.arguments);
    } catch {}
  }

  return {
    title: typeof parsed?.title === "string" ? parsed.title : null,
    sections: Array.isArray(parsed?.sections)
      ? parsed.sections.map((s: any) => ({
          heading: typeof s?.heading === "string" ? s.heading : null,
          contentMd: typeof s?.contentMd === "string" ? s.contentMd : "",
        }))
      : [],
  };
}
