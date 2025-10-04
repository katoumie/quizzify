// src/app/api/duels/[code]/sse/route.ts
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;

  // Find session by lobby code (not ID)
  const session = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      status: true,
      hostId: true,
      setId: true,
      players: {
        select: {
          id: true,
          displayName: true,
          isReady: true,
          lives: true,
          role: true,
          user: { select: { username: true, avatar: true } },
        },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) return new Response("Not found", { status: 404 });

  // Capture non-null primitives for use inside the stream closure
  const sessionId = session.id;
  const sessionCode = session.code;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enc = new TextEncoder();
      const send = (obj: any) => {
        if (!closed) {
          try {
            controller.enqueue(enc.encode(sse(obj)));
          } catch {}
        }
      };

      async function sendSnapshot() {
        try {
          const snap = await prisma.duelSession.findUnique({
            where: { id: sessionId },
            select: {
              id: true,
              code: true,
              status: true,
              hostId: true,
              players: {
                select: {
                  id: true,
                  displayName: true,
                  isReady: true,
                  lives: true,
                  role: true,
                  user: { select: { username: true, avatar: true } },
                },
                orderBy: { connectedAt: "asc" },
              },
            },
          });

          if (!snap) return;

          send({
            type: "snapshot",
            payload: {
              id: snap.id,
              code: snap.code,
              status: snap.status,
              hostId: snap.hostId,
              players: snap.players.map((p) => ({
                id: p.id,
                name: p.displayName || p.user?.username || "Player",
                avatar: p.user?.avatar ?? null,
                isReady: !!p.isReady,
                lives: p.lives ?? 3,
                role: p.role ?? "PLAYER",
              })),
            },
          });
        } catch {}
      }

      // Initial snapshot
      sendSnapshot();

      // Relay bus messages
      const unsubId = duelsBus.subscribe(sessionId, (msg) => send(msg));
      const unsubCode = duelsBus.subscribe(sessionCode, (msg) => send(msg));

      // Keep-alive
      const keep = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(enc.encode(": keep-alive\n\n"));
          } catch {}
        }
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keep);
        try { unsubId?.(); } catch {}
        try { unsubCode?.(); } catch {}
        try { controller.close(); } catch {}
      };

      (controller as any)._close = close;
    },
    cancel() {
      try { (this as any)._close?.(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
