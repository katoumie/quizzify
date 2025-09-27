// src/server/duelsBus.ts
export type Listener = (msg: any) => void;

const channels = new Map<string, Set<Listener>>();

export function broadcast(sessionId: string, msg: any) {
  const set = channels.get(sessionId);
  if (!set) return;
  for (const fn of set) fn(msg);
}

export function subscribe(sessionId: string, fn: Listener) {
  let set = channels.get(sessionId);
  if (!set) channels.set(sessionId, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}
