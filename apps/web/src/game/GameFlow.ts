import type { FighterId } from "@neon-rivals/simulation";

export type MatchMode = "local" | "training" | "online";

export interface MatchSetup {
  readonly mode: MatchMode;
  readonly fighters: readonly [FighterId, FighterId];
}

export interface MatchResultData extends MatchSetup {
  readonly winner: 0 | 1 | -1;
  readonly scores: readonly [number, number];
  readonly roundsPlayed: number;
}

export const DEFAULT_MATCH_SETUP: MatchSetup = {
  mode: "local",
  fighters: ["vesper", "nova"],
};

export function normalizeMatchSetup(data: Partial<MatchSetup> | undefined): MatchSetup {
  const fighters = data?.fighters ?? DEFAULT_MATCH_SETUP.fighters;
  return {
    mode: data?.mode ?? "local",
    fighters: [fighters[0], fighters[1]],
  };
}
