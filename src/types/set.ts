// /src/types/set.ts
export type Card = {
  id?: string;
  term: string;
  definition: string;
  imageUrl?: string | null;
  position?: number;

  /** Per-item skill label if explicitly set; null means explicit None; omitted means inherit default */
  skill?: string | null;

  /** True if this card inherits the set’s default skill; false if explicit (skill string OR explicit None) */
  inheritDefault?: boolean;
};

export type SetFormInitialData = {
  id?: string;
  title?: string;
  description?: string;
  isPublic?: boolean;

  /** Name of the set’s default skill (if any) used to seed the SkillCombo on load */
  defaultSkillName?: string | null;

  cards?: Card[];
};

export type Visibility = "public" | "private" | "friends";