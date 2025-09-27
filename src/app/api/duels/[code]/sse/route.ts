export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { duelsBus } from "@/lib/duels-bus";

function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  // Resolve session by code once so we can subscribe by both id & code
  const base = await prisma.duelSession.findUnique({
    where: { code },
    select: { id: true, code: true },
  });
  if (!base) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const enc = new TextEncoder();

      const send = (obj: any) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(sse(obj)));
        } catch {
          // ignore enqueue when closed
        }
      };

      const sendSnapshot = async () => {
        if (closed) return;
        try {
          const snap = await prisma.duelSession.findUnique({
            where: { id: base.id },
            select: {
              id: true,
              code: true,
              hostId: true,
              mode: true,
              status: true,
              options: true,
              players: {
                select: {
                  id: true,
                  userId: true,
                  displayName: true,
                  team: true,
                  lives: true,
                  score: true,
                  isReady: true,
                  eliminatedAt: true,
                  user: { select: { avatar: true, username: true } },
                },
                orderBy: { connectedAt: "asc" },
              },
            },
          });
          if (snap) send({ type: "snapshot", payload: snap });
        } catch {
          // ignore transient DB errors
        }
      };

      // Initial snapshot
      sendSnapshot();

      // Subscribe to BOTH keys (defensive against dev/HMR/runtime splits)
      const unsubId = duelsBus.subscribe(base.id, (msg) => send(msg));
      const unsubCode = duelsBus.subscribe(base.code, (msg) => send(msg));

      // Keep-alive
      const keep = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(": keep-alive\n\n"));
        } catch {}
      }, 15000);

      // Cleanup
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keep);
        try {
          unsubId?.();
        } catch {}
        try {
          unsubCode?.();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      // @ts-ignore expose closer for cancel()
      controller._close = close;
    },

    cancel() {
      // @ts-ignore
      if (typeof this._close === "function") this._close();
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
