// /src/app/api/generate-from-ai/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/ai";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 60;

type OutCard = { term: string; definition: string };
type OutSet = { title: string | null; description: string | null; cards: OutCard[] };

const MAX_CHARS = 60_000;
const CHUNK_SIZE = 12_000;
const MAX_CARDS = 50;

type GenMode = "recall" | "balanced" | "reasoning";
type AnswerLen = "short" | "medium" | "detailed";

type GenOptions = {
  mode: GenMode;
  reasoningPct: number;        // 0..100 (used only when balanced)
  answerLength: AnswerLen;
  useSourcePhrasing: boolean;
  subjectHint: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[AI] Missing OPENAI_API_KEY");
      return NextResponse.json({ error: "Server is missing OpenAI API key." }, { status: 500 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    // NEW: optional behavior inputs from the modal
    const opts: GenOptions = {
      mode: (String(form.get("mode") || "balanced") as GenMode),
      reasoningPct: clampInt(Number(form.get("reasoningPct") ?? 80), 0, 100),
      answerLength: (String(form.get("answerLength") || "short") as AnswerLen),
      useSourcePhrasing: String(form.get("useSourcePhrasing") || "false") === "true",
      subjectHint: String(form.get("subjectHint") || ""),
    };

    const contentType = file.type || "";
    const name = file.name || "upload";
    const buf = Buffer.from(await file.arrayBuffer());

    console.log("[AI] Upload received:", { name, contentType, size: buf.byteLength, opts });

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

    // 2) Build study set via OpenAI (now behavior-aware)
    let structured: OutSet;
    try {
      structured = await buildStudySet(text, opts);
    } catch (e: any) {
      console.error("[AI] OpenAI call failed:", e);
      return NextResponse.json({ error: `OpenAI failed (${e?.message || "unknown error"})` }, { status: 500 });
    }

    // 3) Sanitize
    const cards = Array.isArray(structured.cards) ? structured.cards : [];
    const pruned: OutCard[] = cards
      .filter((c) => c?.term && c?.definition)
      .slice(0, MAX_CARDS)
      .map((c) => {
        const term = String(c.term).slice(0, 200);
        const definitionRaw = String(c.definition).slice(0, 600);
        const definition = deLeak(term, definitionRaw); // ← remove term leakage
        return { term, definition };
      });

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

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function fallbackTitle(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim() || "Study Set";
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

// --- NEW: remove obvious term leakage from definitions ---
function deLeak(term: string, def: string): string {
  if (!term || !def) return def;

  // Normalize term into tokens
  const stop = new Set([
    "what","which","who","where","when","why","how","is","are","was","were","do","does","did",
    "the","a","an","of","to","in","on","for","and","or","with","from","that","this","these","those"
  ]);
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const termTokens = clean(term).split(" ").filter(w => w && !stop.has(w));

  if (termTokens.length === 0) return def;

  // Build candidate phrases (prefer longer n-grams found in the definition)
  const defLC = clean(def);
  const phrases: string[] = [];
  for (let n = Math.min(5, termTokens.length); n >= 2; n--) {
    for (let i = 0; i <= termTokens.length - n; i++) {
      const p = termTokens.slice(i, i + n).join(" ");
      if (defLC.includes(p)) phrases.push(p);
    }
  }
  // If nothing multi-word matched, try a notable single word (>=3 chars) that appears in the def
  if (!phrases.length) {
    const single = termTokens.find(w => w.length >= 3 && defLC.includes(w));
    if (single) phrases.push(single);
  }

  if (!phrases.length) return def;

  // Replace, longest first
  const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = def;
  Array.from(new Set(phrases))
    .sort((a, b) => b.length - a.length)
    .forEach(p => {
      const re = new RegExp(`\\b${escapeRx(p)}\\b`, "gi");
      out = out.replace(re, (m) => (/[A-Z]/.test(m[0]) ? "It" : "it"));
    });

  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function chunkString(s: string, size: number) {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

async function buildStudySet(text: string, opts: GenOptions): Promise<OutSet> {
  const chunks = chunkString(text, CHUNK_SIZE);

  const perChunkCards: OutCard[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const remaining = MAX_CARDS - perChunkCards.length;
    if (remaining <= 0) break;

    const { cards } = await askOpenAI(
      {
        mode: "cards-only",
        body: chunk,
        index: i + 1,
        total: chunks.length,
        desiredCount: Math.min(30, remaining),
      },
      opts
    );

    if (Array.isArray(cards)) perChunkCards.push(...cards);
    if (perChunkCards.length >= MAX_CARDS) break;
  }

  const final = await askOpenAI(
    {
      mode: "title-and-description",
      body: text.slice(0, 8000),
      seedCards: perChunkCards.slice(0, MAX_CARDS),
    },
    opts
  );

  return {
    title: final.title || "Study Set",
    description: final.description || null,
    cards: (final.cards?.length ? final.cards : perChunkCards).slice(0, MAX_CARDS),
  };
}

type AskArgs =
  | { mode: "cards-only"; body: string; index: number; total: number; desiredCount?: number }
  | { mode: "title-and-description"; body: string; seedCards: OutCard[] };

function lengthRule(len: AnswerLen) {
  switch (len) {
    case "short":
      return "Definitions must be 1–2 tight sentences.";
    case "medium":
      return "Definitions must be 2–3 concise sentences.";
    case "detailed":
      return "Definitions may be 3–5 compact sentences; avoid fluff.";
  }
}

function styleRules(opts: GenOptions) {
  const base = [
    "Return objects with {term, definition} only. No numbering or extra commentary.",
    "Do NOT include the words 'Source:', 'Output Term:', or 'Output Definition:'.",
    opts.useSourcePhrasing
      ? "Stay close to the document's phrasing when possible (light edits for clarity)."
      : "Paraphrase in your own words; avoid quoting entire sentences from the source.",
    lengthRule(opts.answerLength),
  ];

  if (opts.mode === "recall") {
    base.push(
      "Create straightforward recall cards.",
      "term = the key concept or prompt.",
      "definition = the precise explanation/answer."
    );
  } else if (opts.mode === "reasoning") {
    base.push(
      "Create applied, real-world, scenario-style questions that require inference.",
      "term = a 'why/how/which/what happens if...' style question (6–18 words).",
      "definition = the concise reasoning that invokes the underlying principle.",
      "Avoid trivial 'What is...' prompts."
    );
  } else {
    // balanced
    base.push(
      `Blend of recall and reasoning. Roughly ${opts.reasoningPct}% reasoning, ${100 - opts.reasoningPct}% recall.`,
      "Interleave both types."
    );
  }

  if (opts.subjectHint) {
    base.push(`When choosing topics, prioritize relevance to: "${opts.subjectHint}".`);
  }
  return base.join("\n");
}

async function askOpenAI(args: AskArgs, opts: GenOptions): Promise<OutSet> {
  const system = `You are an expert study-set generator. Extract crisp "term" → "definition" pairs from the document text.
    Prefer concise, correct, self-contained definitions. Skip duplicates and trivial noise.

    IMPORTANT RULES
    - Do NOT repeat the exact term (or its key subject words) inside the definition.
      Use neutral referents like "it", "they", "this process", "this law", etc.
    - Keep definitions 1–2 sentences, direct, and free of fluff.`;

  const user =
    args.mode === "cards-only"
      ? `CHUNK ${args.index}/${args.total}
From this text, return up to ${Math.max(1, Math.min(args.desiredCount ?? 30, MAX_CARDS))} high-quality cards.

TEXT:
"""${args.body}"""` 
      : `Using the provided sample and seed cards, propose:
1) Title (short)
2) Description (<= 2 sentences)
3) A refined final list of cards (you may merge/deduplicate/trim).

SEED_CARDS:
${JSON.stringify((args as any).seedCards ?? [], null, 2)}

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
      { role: "user", content: [styleRules(opts), "", user].join("\n") },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "return_study_set" } },
    temperature: 0.2,
  });

  const msg = completion.choices[0]?.message;
  let parsed: any = null;

  const tc = msg?.tool_calls?.[0];
  if (tc && tc.type === "function" && "function" in tc && (tc as any).function?.arguments) {
    try {
      parsed = JSON.parse((tc as any).function.arguments);
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
