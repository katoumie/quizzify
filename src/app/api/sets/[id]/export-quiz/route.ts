//src/app/api/sets/[id]/export-quiz/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedUserId } from "@/lib/auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CardRow = {
  id: string;
  term: string;
  definition: string;
};

type OptionRow = {
  text: string;
  isCorrect: boolean;
};

type QuestionRow = {
  cardId: string;
  term: string;
  options: OptionRow[];
};

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build MCQ questions: options are shuffled, but we do NOT store letters.
// Letters (A/B/C/D) are assigned later by index when drawing to the PDF.
function buildQuestions(cards: CardRow[]): QuestionRow[] {
  const defs = cards.map((c) => c.definition);
  return cards.map((c) => {
    const pool = defs.filter((d) => d !== c.definition);
    const distractors = shuffle(pool).slice(0, Math.min(3, pool.length));
    const options: OptionRow[] = shuffle([
      { text: c.definition, isCorrect: true },
      ...distractors.map((d) => ({
        text: d,
        isCorrect: false,
      })),
    ]).slice(0, 4);
    return {
      cardId: c.id,
      term: c.term,
      options,
    };
  });
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const uid = await getAuthedUserId();
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setId = ctx.params?.id;
    if (!setId) {
      return NextResponse.json(
        { error: "Missing set id" },
        { status: 400 }
      );
    }

    // Load user for username
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { username: true },
    });

    // Load set and cards
    const set = await prisma.studySet.findUnique({
      where: { id: setId },
      select: {
        title: true,
        ownerId: true,
        cards: {
          select: {
            id: true,
            term: true,
            definition: true,
          },
        },
      },
    });

    if (!set) {
      return NextResponse.json(
        { error: "Study set not found" },
        { status: 404 }
      );
    }

    if (!set.cards.length) {
      return NextResponse.json(
        { error: "This set has no cards to export." },
        { status: 400 }
      );
    }

    const questions = buildQuestions(
      set.cards.filter((c) => c.term && c.definition) as CardRow[]
    );

    // Create PDF
    const pdfDoc = await PDFDocument.create();

    // mutable page so we can swap when adding new pages
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();
    const margin = 50;
    let maxWidth = width - margin * 2;

    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - margin;

    const username = user?.username ?? "Unknown user";
    const today = new Date().toLocaleDateString();

    // Header
    const headerText = "Quizzify – Set Quiz";
    const headerSize = 18;
    const headerWidth = titleFont.widthOfTextAtSize(headerText, headerSize);
    page.drawText(headerText, {
      x: (width - headerWidth) / 2,
      y,
      size: headerSize,
      font: titleFont,
      color: rgb(0.15, 0.15, 0.3),
    });
    y -= 28;

    // Meta lines
    const metaLines = [
      `Set: ${set.title ?? "Untitled set"}`,
      `Generated for: ${username}`,
      `Date: ${today}`,
    ];

    const metaSize = 11;
    for (const line of metaLines) {
      page.drawText(line, {
        x: margin,
        y,
        size: metaSize,
        font: bodyFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 16;
    }

    y -= 10;

    const instructions =
      "Answer the following questions by selecting the best definition for each term.";
    const instrSize = 11;
    page.drawText(instructions, {
      x: margin,
      y,
      size: instrSize,
      font: bodyFont,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth,
      lineHeight: 13,
    });
    y -= 26;

    // Ensure vertical space; if not enough, create a new page
    function ensureSpace(lineHeight: number) {
      if (y - lineHeight < margin) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        maxWidth = width - margin * 2;
        y = height - margin;
      }
    }

    // Helper for wrapping text and auto paging
    function drawWrappedText(
      text: string,
      font: typeof bodyFont,
      size: number,
      color: ReturnType<typeof rgb>,
      lineHeight: number
    ) {
      const words = text.split(/\s+/);
      let line = "";
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, size);
        if (testWidth > maxWidth) {
          ensureSpace(lineHeight);
          page.drawText(line, {
            x: margin,
            y,
            size,
            font,
            color,
          });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: margin,
          y,
          size,
          font,
          color,
        });
        y -= lineHeight;
      }
    }

    // Questions
    const termSize = 12;
    const optSize = 11;
    const LETTERS = ["A", "B", "C", "D"];

    questions.forEach((q, idx) => {
      // Wrapped question line (prevents cutting at the right edge)
      const qLabel = `${idx + 1}. ${q.term}`;
      ensureSpace(16);
      drawWrappedText(
        qLabel,
        titleFont,
        termSize,
        rgb(0.05, 0.05, 0.15),
        16
      );
      y -= 4; // small gap before options

      // Options: assign A/B/C/D by index, also wrapped
      q.options.forEach((opt, optIndex) => {
        const letter =
          LETTERS[optIndex] ??
          String.fromCharCode("A".charCodeAt(0) + optIndex);
        const text = `${letter}. ${opt.text}`;
        drawWrappedText(
          text,
          bodyFont,
          optSize,
          rgb(0.1, 0.1, 0.1),
          14
        );
      });

      y -= 8;
    });

    const pdfBytes = await pdfDoc.save();

    const filenameSafeTitle =
      (set.title || "quizzify-set").replace(/[^a-z0-9]+/gi, "-") ||
      "quizzify-set";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameSafeTitle}-quiz.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/sets/[id]/export-quiz error:", err);
    return NextResponse.json(
      { error: "Failed to generate quiz PDF." },
      { status: 500 }
    );
  }
}
