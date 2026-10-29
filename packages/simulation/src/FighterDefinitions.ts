import type { FighterDefinition, FighterId } from "./FighterConfig";
import { NOVA } from "./fighters/nova";
import { ROOK } from "./fighters/rook";
import { SABLE } from "./fighters/sable";
import { VESPER } from "./fighters/vesper";

export const FIGHTER_IDS = [
  "vesper",
  "nova",
  "rook",
  "sable",
] as const satisfies readonly FighterId[];

export const FIGHTERS: Readonly<Record<FighterId, FighterDefinition>> = {
  vesper: VESPER,
  nova: NOVA,
  rook: ROOK,
  sable: SABLE,
};

export const FIGHTER_ROSTER: readonly FighterDefinition[] = FIGHTER_IDS.map(
  (fighterId) => FIGHTERS[fighterId],
);

export function getFighterDefinition(fighterId: FighterId): FighterDefinition {
  return FIGHTERS[fighterId];
}
