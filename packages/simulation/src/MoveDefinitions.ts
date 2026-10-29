// Shared move schema. Every fighter supplies a complete move table in its own reusable
// configuration file under src/fighters; simulation logic never depends on artwork.
export type AttackId = "light" | "crouchLight" | "heavy" | "special" | "super";
export type AttackHeight = "mid" | "low" | "overhead";

export interface AttackDefinition {
  readonly id: AttackId;
  readonly label: string;
  readonly startupFrames: number;
  readonly activeFrames: number;
  readonly recoveryFrames: number;
  readonly damage: number;
  readonly chipDamage: number;
  readonly hitstunFrames: number;
  readonly blockstunFrames: number;
  readonly hitstopFrames: number;
  readonly range: number;
  readonly height: AttackHeight;
  readonly knockbackX: number;
  readonly launchY: number;
  readonly knockdown: boolean;
  readonly meterGain: number;
  readonly meterCost: number;
  readonly travelSpeed?: number;
  readonly cancelTo: readonly AttackId[];
}

export function attackTotalFrames(attack: AttackDefinition): number {
  return attack.startupFrames + attack.activeFrames + attack.recoveryFrames;
}

export function isAttackActive(attack: AttackDefinition, actionFrame: number): boolean {
  return (
    actionFrame >= attack.startupFrames && actionFrame < attack.startupFrames + attack.activeFrames
  );
}
