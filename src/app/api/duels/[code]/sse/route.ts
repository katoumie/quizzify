// /src/app/api/duels/[code]/sse/route.ts
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

/** Helper to format SSE line */
function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** Build a compact signature for cheap diffing (status + roster) */
function buildSig(session: {
  status: string;
  startedAt?: Date | null;
  players: Array<any>;
}) {
  return JSON.stringify({
    status: session.status,
    startedAt: session.startedAt ? +new Date(session.startedAt) : null,
    players: session.players.map((p) => ({
      id: p.id,
      userId: p.userId ?? null,
      displayName: p.displayName ?? p.user?.username ?? "",
      isReady: !!p.isReady,
      lives: p.lives ?? 3,
      role: p.role ?? "PLAYER",
      avatar: p.user?.avatar ?? null,
      username: p.user?.username ?? null,
    })),
  });
}

/** Load current lobby snapshot */
async function getLobbySnapshot(code: string) {
  const session = await prisma.duelSession.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      status: true,
      hostId: true,
      setId: true,
      startedAt: true,
      players: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          isReady: true,
          lives: true,
          role: true,
          connectedAt: true,
          user: { select: { id: true, username: true, avatar: true } },
        },
        orderBy: { connectedAt: "asc" },
      },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    code: session.code,
    status: session.status,
    hostId: session.hostId,
    setId: session.setId,
    startedAt: session.startedAt,
    players: session.players.map((p) => ({
      id: p.id,
      userId: p.userId ?? null,
      displayName: p.displayName ?? p.user?.username ?? "Player",
      isReady: !!p.isReady,
      lives: p.lives ?? 3,
      role: p.role ?? "PLAYER",
      username: p.user?.username ?? null,
      avatar: p.user?.avatar ?? null,
      connectedAt: p.connectedAt,
    })),
  };
}

export async function GET(_req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let lastSig = "";

      const send = (obj: any) => {
        try {
          controller.enqueue(new TextEncoder().encode(sse(obj)));
        } catch {
          // ignore
        }
      };

      // Initial snapshot
      (async () => {
        const snap = await getLobbySnapshot(code);
        if (!snap) {
          send({ type: "error", message: "Lobby not found." });
          controller.close();
          closed = true;
          return;
        }
        lastSig = buildSig({ status: snap.status, startedAt: snap.startedAt, players: snap.players });
        send({ type: "hello", mode: "lobby", code, sessionId: snap.id });
        send({ type: "lobby-state", session: snap });
      })();

      // Polling loop: emit when status OR roster changes
      const pollMs = 1200;
      const poll = setInterval(async () => {
        if (closed) return;
        try {
          const snap = await getLobbySnapshot(code);
          if (!snap) return;
          const sig = buildSig({ status: snap.status, startedAt: snap.startedAt, players: snap.players });
          if (sig !== lastSig) {
            lastSig = sig;
            send({ type: "lobby-state", session: snap });
          }
        } catch (err: any) {
          send({ type: "warn", message: err?.message ?? "poll-failed" });
        }
      }, pollMs);

      // Heartbeat
      const hb = setInterval(() => {
        if (closed) return;
        send({ type: "hb", ts: Date.now() });
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(hb);
        try {
          controller.close();
        } catch {}
      };

      // no explicit abort controller here; rely on client closing
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
