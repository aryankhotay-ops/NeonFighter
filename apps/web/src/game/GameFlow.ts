import type { FighterId } from "@neon-rivals/simulation";

export type MatchMode = "local" | "training" | "online";
export type OpponentType = "human" | "cpu";
export type CpuDifficulty = "easy" | "medium" | "hard";

export interface MatchSetup {
  readonly mode: MatchMode;
  readonly fighters: readonly [FighterId, FighterId];
  readonly opponent: OpponentType;
  readonly cpuDifficulty: CpuDifficulty;
}

export interface MatchResultData extends MatchSetup {
  readonly winner: 0 | 1 | -1;
  readonly scores: readonly [number, number];
  readonly roundsPlayed: number;
}

export const DEFAULT_MATCH_SETUP: MatchSetup = {
  mode: "local",
  fighters: ["vesper", "nova"],
  opponent: "human",
  cpuDifficulty: "medium",
};

export function normalizeMatchSetup(data: Partial<MatchSetup> | undefined): MatchSetup {
  const fighters = data?.fighters ?? DEFAULT_MATCH_SETUP.fighters;
  return {
    mode: data?.mode ?? "local",
    fighters: [fighters[0], fighters[1]],
    opponent: data?.mode === "online" ? "human" : (data?.opponent ?? "human"),
    cpuDifficulty: data?.cpuDifficulty ?? "medium",
  };
}

export function cpuDifficultyLabel(difficulty: CpuDifficulty): string {
  return difficulty.toUpperCase();
}
