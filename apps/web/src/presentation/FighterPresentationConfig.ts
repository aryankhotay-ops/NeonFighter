import type { FighterId } from "@neon-rivals/simulation";

// Original procedural character art stays independent from deterministic combat data.
// A future licensed/original sprite sheet can replace this presentation layer alone.
export type FighterSilhouette = "scarf" | "crest" | "armor" | "coat";
export type FighterFaceStyle = "courier" | "comet" | "warden" | "duelist";

export interface FighterPresentation {
  readonly fighterId: FighterId;
  readonly silhouette: FighterSilhouette;
  readonly primary: number;
  readonly shadow: number;
  readonly accent: number;
  readonly skin: number;
  readonly hair: number;
  readonly eye: number;
  readonly faceStyle: FighterFaceStyle;
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
    hair: 0x111b2e,
    eye: 0x58efff,
    faceStyle: "courier",
    bodyScaleX: 0.84,
    bodyScaleY: 0.98,
  },
  nova: {
    fighterId: "nova",
    silhouette: "crest",
    primary: 0xff4aa2,
    shadow: 0x531d4c,
    accent: 0xffd6eb,
    skin: 0xb87654,
    hair: 0x4a164b,
    eye: 0xffe45c,
    faceStyle: "comet",
    bodyScaleX: 0.92,
    bodyScaleY: 1.11,
  },
  rook: {
    fighterId: "rook",
    silhouette: "armor",
    primary: 0xffc547,
    shadow: 0x5b3418,
    accent: 0xff6947,
    skin: 0x6f4435,
    hair: 0x211716,
    eye: 0xff8a54,
    faceStyle: "warden",
    bodyScaleX: 1.32,
    bodyScaleY: 1.02,
  },
  sable: {
    fighterId: "sable",
    silhouette: "coat",
    primary: 0xa77bff,
    shadow: 0x29264f,
    accent: 0x70ffb7,
    skin: 0xd09a77,
    hair: 0x17182d,
    eye: 0x70ffb7,
    faceStyle: "duelist",
    bodyScaleX: 0.94,
    bodyScaleY: 1.15,
  },
};

export function getFighterPresentation(fighterId: FighterId): FighterPresentation {
  return FIGHTER_PRESENTATIONS[fighterId];
}
