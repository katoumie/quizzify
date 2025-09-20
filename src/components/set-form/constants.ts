// /src/components/set-form/constants.ts
export const SESSION_KEY = "qz_auth";

// Limits
export const AI_MAX_CARDS = 50;      // AI hard cap (client; server also caps)
export const SOFT_CARD_LIMIT = 200;  // warn after this many manual cards
export const HARD_CARD_LIMIT = 500;  // absolute max manual cards
export const DEF_MAX = 500;          // definition character cap

// NavSearch-matched inputs
export const INPUT_BG = "#18062e";
export const INPUT_BASE = [
  "no-native-clear",
  "w-full",
  "rounded-md",
  "text-white",
  "placeholder-white/60",
  "ring-1 ring-white/12",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
  "focus:outline-none",
  "focus:ring-[#a8b1ff]/80",
].join(" ");
