import type { FighterId } from "@neon-rivals/simulation";
import type { MatchMode } from "./GameFlow";

export type CharacterSelectPhase = "choosing-p1" | "choosing-p2" | "ready";
export type CancelResult = "changed-selection" | "exit-to-menu";

export interface CharacterSelectSnapshot {
  readonly mode: MatchMode;
  readonly phase: CharacterSelectPhase;
  readonly activePlayer: 0 | 1 | null;
  readonly choices: readonly [FighterId | null, FighterId | null];
}

/**
 * Pure selection state with no Phaser dependency. The scene presents this state, while tests
 * verify locking, final matchup confirmation, and cancellation independently from rendering.
 */
export class CharacterSelectController {
  private readonly roster: readonly FighterId[];
  private readonly mode: MatchMode;
  private phase: CharacterSelectPhase = "choosing-p1";
  private choices: [FighterId | null, FighterId | null] = [null, null];

  public constructor(mode: MatchMode, roster: readonly FighterId[]) {
    if (roster.length < 2) throw new Error("Character select requires at least two fighters.");
    this.mode = mode;
    this.roster = [...roster];
  }

  public get snapshot(): CharacterSelectSnapshot {
    return {
      mode: this.mode,
      phase: this.phase,
      activePlayer: this.phase === "choosing-p1" ? 0 : this.phase === "choosing-p2" ? 1 : null,
      choices: [this.choices[0], this.choices[1]],
    };
  }

  public select(fighterId: FighterId): void {
    this.assertRosterFighter(fighterId);
    if (this.phase === "ready") return;

    if (this.phase === "choosing-p1") {
      this.choices[0] = fighterId;
      // Training uses the same explicit two-step selection as versus mode. The second
      // player/dummy must never be silently selected on behalf of the user.
      this.phase = "choosing-p2";
      return;
    }

    this.choices[1] = fighterId;
    this.phase = "ready";
  }

  public cancel(): CancelResult {
    if (this.phase === "ready") {
      this.choices[1] = null;
      this.phase = "choosing-p2";
      return "changed-selection";
    }

    if (this.phase === "choosing-p2") {
      this.choices = [null, null];
      this.phase = "choosing-p1";
      return "changed-selection";
    }

    return "exit-to-menu";
  }

  public confirmedMatchup(): readonly [FighterId, FighterId] | null {
    if (this.phase !== "ready" || !this.choices[0] || !this.choices[1]) return null;
    return [this.choices[0], this.choices[1]];
  }

  private assertRosterFighter(fighterId: FighterId): void {
    if (!this.roster.includes(fighterId)) {
      throw new Error(`Unknown fighter selection: ${fighterId}`);
    }
  }
}
