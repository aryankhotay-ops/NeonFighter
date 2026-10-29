import type { AttackDefinition, AttackId } from "./MoveDefinitions";

export type FighterId = "vesper" | "nova" | "rook" | "sable";

export interface FighterMovementDefinition {
  readonly walkSpeed: number;
  readonly airSpeed: number;
  readonly dashSpeed: number;
  readonly dashDurationFrames: number;
  readonly jumpVelocity: number;
  readonly superJumpVelocity: number;
  readonly gravity: number;
}

export interface FighterBodyDefinition {
  readonly pushboxWidth: number;
  readonly standingHeight: number;
  readonly crouchingHeight: number;
}

export interface FighterDefinition {
  readonly id: FighterId;
  readonly name: string;
  readonly epithet: string;
  readonly fightingStyle: string;
  readonly playStyle: string;
  readonly description: string;
  readonly maxHealth: number;
  readonly movement: FighterMovementDefinition;
  readonly body: FighterBodyDefinition;
  readonly moves: Readonly<Record<AttackId, AttackDefinition>>;
}
