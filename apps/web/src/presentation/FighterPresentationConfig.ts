import type { FighterId } from "@neon-rivals/simulation";

// Temporary vector-sprite presentation. Final licensed/original sprite sheets can replace
// these values and FighterView without changing deterministic fighter or move definitions.
export type TemporarySilhouette = "scarf" | "crest" | "armor" | "coat";

export interface FighterPresentation {
  readonly fighterId: FighterId;
  readonly silhouette: TemporarySilhouette;
  readonly primary: number;
  readonly shadow: number;
  readonly accent: number;
  readonly skin: number;
  readonly bodyScaleX: number;
  readonly bodyScaleY: number;
}

export const FIGHTER_PRESENTATIONS: Readonly<Record<FighterId, FighterPresentation>> = {
  vesper: {
    fighterId: "vesper",
    silhouette: "scarf",
    primary: 0x37e6ff,
    shadow: 0x123d61,
    accent: 0xf3fdff,
    skin: 0x9b5e48,
    bodyScaleX: 0.92,
    bodyScaleY: 0.98,
  },
  nova: {
    fighterId: "nova",
    silhouette: "crest",
    primary: 0xff4aa2,
    shadow: 0x531d4c,
    accent: 0xffd6eb,
    skin: 0xb87654,
    bodyScaleX: 0.96,
    bodyScaleY: 1.04,
  },
  rook: {
    fighterId: "rook",
    silhouette: "armor",
    primary: 0xffc547,
    shadow: 0x5b3418,
    accent: 0xff6947,
    skin: 0x6f4435,
    bodyScaleX: 1.2,
    bodyScaleY: 1.05,
  },
  sable: {
    fighterId: "sable",
    silhouette: "coat",
    primary: 0xa77bff,
    shadow: 0x29264f,
    accent: 0x70ffb7,
    skin: 0xd09a77,
    bodyScaleX: 1,
    bodyScaleY: 1.08,
  },
};

export function getFighterPresentation(fighterId: FighterId): FighterPresentation {
  return FIGHTER_PRESENTATIONS[fighterId];
}
