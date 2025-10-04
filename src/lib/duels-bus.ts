// src/lib/duels-bus.ts
type Listener = (msg: any) => void;

class DuelsBus {
  private subs = new Map<string, Set<Listener>>();

  subscribe(code: string, fn: Listener) {
    let set = this.subs.get(code);
    if (!set) {
      set = new Set();
      this.subs.set(code, set);
    }
    set.add(fn);
    return () => {
      const s = this.subs.get(code);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.subs.delete(code);
    };
  }

  publish(code: string, msg: any) {
    const set = this.subs.get(code);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try { fn(msg); } catch { /* ignore */ }
    }
  }
}

// persist across HMR / dev server reloads
export const duelsBus: DuelsBus =
  (globalThis as any).__DUELS_BUS__ || ((globalThis as any).__DUELS_BUS__ = new DuelsBus());
