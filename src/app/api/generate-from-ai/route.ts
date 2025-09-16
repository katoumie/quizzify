import { NextResponse } from "next/server";
import { openai } from "@/lib/ai";
import mammoth from "mammoth";
import { mkdtemp, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

type OutCard = { term: string; definition: string };
type OutSet = { title: string | null; description: string | null; cards: OutCard[] };

const MAX_CHARS = 60_000;
const CHUNK_SIZE = 12_000;
const MAX_CARDS = 50;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[AI] Missing OPENAI_API_KEY");
      return NextResponse.json({ error: "Server is missing OpenAI API key." }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const contentType = file.type || "";
    const name = file.name || "upload";
    const buf = Buffer.from(await file.arrayBuffer());

    console.log("[AI] Upload received:", { name, contentType, size: buf.byteLength });

    // 1) Extract text
    let rawText: string;
    try {
      rawText = await extractText(buf, contentType, name);
    } catch (e: any) {
      console.error("[AI] extractText() failed:", e);
      return NextResponse.json(
        { error: `Could not extract text (${e?.message || "unknown error"})` },
        { status: 400 }
      );
    }

    if (!rawText?.trim()) {
      console.warn("[AI] Extraction returned empty text.");
      return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });
    }

    const text = rawText.slice(0, MAX_CHARS);
    console.log("[AI] Extracted chars:", text.length);

    // 2) Build study set via OpenAI
    let structured: OutSet;
    try {
      structured = await buildStudySet(text);
    } catch (e: any) {
      console.error("[AI] OpenAI call failed:", e);
      return NextResponse.json({ error: `OpenAI failed (${e?.message || "unknown error"})` }, { status: 500 });
    }

    // 3) Sanitize
    const cards = Array.isArray(structured.cards) ? structured.cards : [];
    const pruned: OutCard[] = cards
      .filter((c) => c?.term && c?.definition)
      .slice(0, MAX_CARDS)
      .map((c) => ({
        term: String(c.term).slice(0, 200),
        definition: String(c.definition).slice(0, 600),
      }));

    const payload: OutSet = {
      title: (structured.title || fallbackTitle(name))?.slice(0, 120) ?? "Study Set",
      description: structured.description ? String(structured.description).slice(0, 400) : null,
      cards: pruned,
    };

    console.log("[AI] Generated set:", {
      title: payload.title,
      descriptionLen: payload.description?.length ?? 0,
      cards: payload.cards.length,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/generate-from-ai unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** ---------------- helpers ---------------- */

function fallbackTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim() || "Study Set";
}

async function extractText(buf: Buffer, contentType: string, filename: string): Promise<string> {
  const lc = (contentType || "").toLowerCase();
  const ext = (filename.split(".").pop() || "").toLowerCase();

  // PDF — lazy import; treat module as any (avoids TS declaration error)
  if (lc.includes("pdf") || ext === "pdf") {
    // NOTE: we import the ESM path directly to avoid package side-effects
    const mod: any = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse: any = mod.default || mod;
    const res = await pdfParse(buf);
    return (res && res.text) || "";
  }

  // DOCX — mammoth to HTML, then strip tags
  if (lc.includes("officedocument.wordprocessingml") || ext === "docx") {
    const { value: html } = await mammoth.convertToHtml({ buffer: buf });
    return htmlToText(html);
  }

  // PPTX — lazy import parser; write temp file since parser wants a path
  if (lc.includes("officedocument.presentationml") || lc.includes("powerpoint") || ext === "pptx") {
    const { default: JSZip } = await import("jszip");

    // 1) Load ZIP
    const zip = await JSZip.loadAsync(buf);

    // 2) Grab slide XML files
    const slideFiles = Object.keys(zip.files)
      .filter((p) => p.startsWith("ppt/slides/slide") && p.endsWith(".xml"))
      .sort((a, b) => {
        // natural sort by slide number
        const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
        const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
        return na - nb;
      });

    // 3) Extract all <a:t>text</a:t> runs
    const decode = (s: string) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

    const slideTexts: string[] = [];
    for (const path of slideFiles) {
      const xml = await zip.files[path].async("string");
      // collect all text runs (PowerPoint uses a:t for text)
      const runs = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => decode(m[1]).trim());
      const notes = Array.from(xml.matchAll(/<p:notes[^>]*>([\s\S]*?)<\/p:notes>/g)).map((m) => decode(m[1]).trim()); // rarely present in slide xml
      const text = [...runs, ...notes].filter(Boolean).join("\n").trim();
      if (text) slideTexts.push(text);
    }

    const all = slideTexts.join("\n\n");
    if (all.trim()) return all;

    // As a last resort, try pulling text from most common “notesSlides” too
    const noteFiles = Object.keys(zip.files)
      .filter((p) => p.startsWith("ppt/notesSlides/notesSlide") && p.endsWith(".xml"))
      .sort((a, b) => {
        const na = Number(a.match(/notesSlide(\d+)\.xml$/)?.[1] || 0);
        const nb = Number(b.match(/notesSlide(\d+)\.xml$/)?.[1] || 0);
        return na - nb;
      });

    const noteTexts: string[] = [];
    for (const path of noteFiles) {
      const xml = await zip.files[path].async("string");
      const runs = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)).map((m) => decode(m[1]).trim());
      const text = runs.filter(Boolean).join("\n").trim();
      if (text) noteTexts.push(text);
    }

    return noteTexts.join("\n\n");
  }

  // Plain text fallback
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

function chunkString(s: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

async function buildStudySet(text: string): Promise<OutSet> {
  const chunks = chunkString(text, CHUNK_SIZE);

  const perChunkCards: OutCard[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const remaining = MAX_CARDS - perChunkCards.length;
    if (remaining <= 0) break;

    const { cards } = await askOpenAI({
      mode: "cards-only",
      body: chunk,
      index: i + 1,
      total: chunks.length,
      // @ts-ignore – we’ll read this in askOpenAI via a type guard
      desiredCount: Math.min(30, remaining), // try to fetch up to 30 per chunk, but not beyond remaining
    });

    if (Array.isArray(cards)) perChunkCards.push(...cards);
    if (perChunkCards.length >= MAX_CARDS) break;
  }

  const final = await askOpenAI({
    mode: "title-and-description",
    body: text.slice(0, 8000),
    seedCards: perChunkCards.slice(0, MAX_CARDS),
  });

  return {
    title: final.title || "Study Set",
    description: final.description || null,
    cards: (final.cards?.length ? final.cards : perChunkCards).slice(0, MAX_CARDS),
  };
}


type AskArgs =
  | { mode: "cards-only"; body: string; index: number; total: number; seedCards?: OutCard[]; desiredCount?: number }
  | { mode: "title-and-description"; body: string; seedCards: OutCard[] };

async function askOpenAI(args: AskArgs): Promise<OutSet> {
  const system = `You are an expert study-set generator. Extract crisp "term" → "definition" pairs from the document text.
Prefer concise, correct, self-contained definitions. Skip duplicates and trivial noise.`;

  const isCardsOnly = args.mode === "cards-only";
  const desired = isCardsOnly ? Math.max(1, Math.min(args.desiredCount ?? 30, MAX_CARDS)) : undefined;

  const user = isCardsOnly
    ? `CHUNK ${args.index}/${args.total}
Return up to ${desired} high-quality, non-duplicate cards from this chunk. Prioritize distinct, useful concepts.

TEXT:
"""${args.body}"""`
    : `Using the provided sample of the document and the preliminary cards,
1) Propose a short, descriptive Title.
2) Propose a concise Description (<= 1-2 sentences).
3) Return a final list of cards (you may refine/merge/trim seed cards).

SEED_CARDS:
${JSON.stringify(args.seedCards ?? [], null, 2)}

TEXT_SAMPLE:
"""${args.body}"""`;

  const tools = [
    {
      type: "function" as const,
      function: {
        name: "return_study_set",
        description: "Return the synthesized study set.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            cards: {
              type: "array",
              items: {
                type: "object",
                required: ["term", "definition"],
                properties: {
                  term: { type: "string" },
                  definition: { type: "string" },
                },
              },
            },
          },
          required: ["cards"],
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
    tool_choice: { type: "function", function: { name: "return_study_set" } },
    temperature: 0.2,
  });

  const msg = completion.choices[0]?.message;
  let parsed: any = null;

  const tc = msg?.tool_calls?.[0];
  if (tc && tc.type === "function" && "function" in tc && tc.function?.arguments) {
    try {
      parsed = JSON.parse(tc.function.arguments);
    } catch {
      parsed = null;
    }
  }

  const out: OutSet = {
    title: typeof parsed?.title === "string" ? parsed.title : null,
    description:
      typeof parsed?.description === "string" || parsed?.description === null
        ? parsed.description
        : null,
    cards: Array.isArray(parsed?.cards) ? parsed.cards : [],
  };

  return out;
}