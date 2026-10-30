import {
  FLOOR_Y,
  InputButton,
  getFighterDefinition,
  hasInput,
  isAttackActive,
  toPixels,
  type FighterState,
} from "@neon-rivals/simulation";
import type Phaser from "phaser";
import { getFighterPresentation, type FighterPresentation } from "./FighterPresentationConfig";

interface Pose {
  readonly torsoLean: number;
  readonly frontArm: number;
  readonly rearArm: number;
  readonly frontLeg: number;
  readonly rearLeg: number;
  readonly crouch: number;
}

export interface FighterRenderPosition {
  readonly x: number;
  readonly feetY: number;
}

export class FighterView {
  public draw(
    graphics: Phaser.GameObjects.Graphics,
    fighter: FighterState,
    presentation: FighterPresentation = getFighterPresentation(fighter.fighterId),
    renderPosition?: FighterRenderPosition,
  ): void {
    const definition = getFighterDefinition(fighter.fighterId);
    const x = renderPosition?.x ?? toPixels(fighter.x);
    const feetY = renderPosition?.feetY ?? toPixels(fighter.y);
    const knockedDown = fighter.action === "knockdown" || fighter.action === "ko";

    graphics.fillStyle(0x000000, 0.34);
    graphics.fillEllipse(
      x,
      toPixels(FLOOR_Y) + 8,
      knockedDown ? 160 : toPixels(definition.body.pushboxWidth) * 1.5,
      18,
    );

    if (knockedDown) {
      this.drawKnockdown(graphics, fighter, presentation, x, feetY);
      return;
    }

    const pose = this.resolvePose(fighter, presentation);
    this.drawDefense(graphics, fighter, presentation, x, feetY, pose.crouch);

    graphics.save();
    graphics.translateCanvas(x, feetY - pose.crouch);
    graphics.scaleCanvas(fighter.facing * presentation.bodyScaleX, presentation.bodyScaleY);

    const shoulderY = -130;
    const hipY = -65;
    const breathe = Math.sin(fighter.actionFrame * 0.12) * 1.8;

    this.drawLimb(graphics, -14, hipY, pose.rearLeg, 63, 20, presentation.shadow, false);
    this.drawLimb(graphics, -18, shoulderY, pose.rearArm, 57, 17, presentation.shadow, true);

    graphics.save();
    graphics.rotateCanvas(pose.torsoLean);
    graphics.fillStyle(presentation.primary, fighter.action === "hitstun" ? 0.62 : 1);
    graphics.beginPath();
    graphics.moveTo(-29, -145 + breathe);
    graphics.lineTo(25, -142 + breathe);
    graphics.lineTo(32, -64);
    graphics.lineTo(-27, -64);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(presentation.shadow, 0.8);
    graphics.fillRect(-25, -103, 53, 10);

    if (presentation.silhouette === "scarf") {
      graphics.fillStyle(presentation.accent, 0.92);
      graphics.beginPath();
      graphics.moveTo(-10, -139);
      graphics.lineTo(-72 - Math.sin(fighter.actionFrame * 0.2) * 9, -124);
      graphics.lineTo(-16, -113);
      graphics.closePath();
      graphics.fillPath();
    } else if (presentation.silhouette === "crest") {
      graphics.fillStyle(presentation.accent, 0.95);
      graphics.beginPath();
      graphics.moveTo(-12, -148);
      graphics.lineTo(2, -178);
      graphics.lineTo(13, -145);
      graphics.closePath();
      graphics.fillPath();
    } else if (presentation.silhouette === "armor") {
      graphics.fillStyle(presentation.accent, 0.95);
      graphics.fillRoundedRect(-41, -145, 24, 48, 7);
      graphics.fillRoundedRect(18, -145, 24, 48, 7);
      graphics.fillStyle(presentation.shadow, 1);
      graphics.fillRect(-34, -83, 68, 19);
    } else {
      graphics.fillStyle(presentation.shadow, 0.96);
      graphics.beginPath();
      graphics.moveTo(-27, -79);
      graphics.lineTo(-14, -20);
      graphics.lineTo(2, -68);
      graphics.lineTo(20, -20);
      graphics.lineTo(29, -78);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(presentation.accent, 0.85);
      graphics.fillRect(-4, -145, 8, 73);
    }
    graphics.restore();

    graphics.fillStyle(presentation.skin, 1);
    graphics.fillRect(-7, -158 + breathe, 15, 20);
    graphics.fillCircle(0, -176 + breathe, 22);
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillCircle(-3, -184 + breathe, 21);
    graphics.fillStyle(presentation.skin, 1);
    graphics.fillRect(-20, -180 + breathe, 40, 18);
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillRect(11, -177 + breathe, 7, 3);

    this.drawLimb(graphics, 15, hipY, pose.frontLeg, 65, 21, presentation.primary, false);
    this.drawLimb(graphics, 19, shoulderY, pose.frontArm, 61, 18, presentation.primary, true);

    if (fighter.action === "attack" && fighter.attack) {
      const attack = definition.moves[fighter.attack];
      const active = isAttackActive(attack, fighter.actionFrame);
      if (fighter.attack === "special" || fighter.attack === "super") {
        graphics.lineStyle(
          fighter.attack === "super" ? 14 : 8,
          presentation.primary,
          active ? 0.75 : 0.3,
        );
        graphics.beginPath();
        graphics.arc(4, -91, fighter.attack === "super" ? 112 : 83, -1.2, 1.08);
        graphics.strokePath();
      }
    }

    graphics.restore();
  }

  private resolvePose(fighter: FighterState, presentation: FighterPresentation): Pose {
    const cycle = Math.sin(fighter.actionFrame * 0.35);
    let pose: Pose = {
      torsoLean: 0,
      frontArm: -0.18,
      rearArm: 0.45,
      frontLeg: 0.08,
      rearLeg: -0.1,
      crouch: fighter.crouching ? 35 : 0,
    };

    if (fighter.action === "walk") {
      pose = {
        ...pose,
        frontArm: -cycle * 0.5,
        rearArm: cycle * 0.5,
        frontLeg: cycle * 0.48,
        rearLeg: -cycle * 0.48,
      };
    } else if (fighter.action === "jump") {
      pose = {
        ...pose,
        frontArm: -0.75,
        rearArm: 0.72,
        frontLeg: -0.62,
        rearLeg: 0.56,
        torsoLean: 0.08,
      };
    } else if (fighter.action === "dash") {
      pose = {
        ...pose,
        frontArm: 0.8,
        rearArm: 1.1,
        frontLeg: -0.32,
        rearLeg: 0.55,
        torsoLean: 0.3,
      };
    } else if (fighter.action === "blockstun") {
      pose = {
        ...pose,
        frontArm: -1.55,
        rearArm: -1.05,
        frontLeg: -0.1,
        rearLeg: 0.17,
        torsoLean: -0.14,
      };
    } else if (hasInput(fighter.previousButtons, InputButton.Guard)) {
      pose = {
        ...pose,
        frontArm: -1.45,
        rearArm: -1.0,
        torsoLean: -0.08,
      };
    } else if (fighter.action === "parry") {
      pose = { ...pose, frontArm: -1.62, rearArm: 0.2, torsoLean: 0.1 };
    } else if (fighter.action === "hitstun") {
      pose = {
        ...pose,
        frontArm: 0.9,
        rearArm: 1.15,
        frontLeg: 0.32,
        rearLeg: -0.25,
        torsoLean: -0.24,
      };
    }

    if (fighter.action !== "attack" || !fighter.attack) return pose;
    const attack = getFighterDefinition(fighter.fighterId).moves[fighter.attack];
    const progress = fighter.actionFrame / Math.max(1, attack.startupFrames + attack.activeFrames);
    const snap = Math.sin(Math.min(1, progress) * Math.PI);

    if (fighter.attack === "light") {
      return { ...pose, frontArm: -1.55, rearArm: -0.35, torsoLean: 0.1 * snap };
    }
    if (fighter.attack === "crouchLight") {
      return { ...pose, frontArm: -1.25, rearArm: -0.2, frontLeg: -0.95 * snap, crouch: 38 };
    }
    if (fighter.attack === "heavy") {
      return presentation.silhouette === "scarf" || presentation.silhouette === "armor"
        ? { ...pose, frontArm: -1.75 * snap, rearArm: 0.85, torsoLean: 0.22 * snap }
        : { ...pose, frontLeg: -1.52 * snap, rearArm: 0.9, torsoLean: -0.18 * snap };
    }
    if (fighter.attack === "special") {
      return presentation.silhouette === "scarf" || presentation.silhouette === "armor"
        ? { ...pose, frontArm: -1.65, rearArm: -1.18, torsoLean: 0.3 * snap }
        : { ...pose, frontLeg: -1.3 * snap, rearLeg: 0.45, frontArm: -0.75, torsoLean: 0.18 };
    }
    return {
      ...pose,
      frontArm: -1.7,
      rearArm: -1.15,
      frontLeg: -1.22 * snap,
      torsoLean: 0.34 * snap,
    };
  }

  private drawDefense(
    graphics: Phaser.GameObjects.Graphics,
    fighter: FighterState,
    presentation: FighterPresentation,
    x: number,
    feetY: number,
    crouch: number,
  ): void {
    const centerY = feetY - 90 + crouch * 0.5;
    if (fighter.action === "parry") {
      graphics.lineStyle(9, 0xffffff, 0.78);
      graphics.strokeCircle(x, centerY, 60 + fighter.actionFrame * 3);
      graphics.lineStyle(4, presentation.primary, 1);
      graphics.strokeCircle(x, centerY, 48);
    } else if (fighter.action === "blockstun") {
      graphics.fillStyle(0x9ff7ff, 0.2);
      graphics.fillCircle(x + fighter.facing * 42, centerY, 47);
      graphics.lineStyle(4, 0xbffbff, 0.92);
      graphics.strokeCircle(x + fighter.facing * 42, centerY, 42);
    } else if (hasInput(fighter.previousButtons, InputButton.Guard)) {
      graphics.fillStyle(presentation.primary, 0.08);
      graphics.fillCircle(x + fighter.facing * 38, centerY, 50);
      graphics.lineStyle(3, presentation.primary, 0.55);
      graphics.beginPath();
      graphics.arc(x + fighter.facing * 38, centerY, 44, -1.2, 1.2);
      graphics.strokePath();
    }
  }

  private drawKnockdown(
    graphics: Phaser.GameObjects.Graphics,
    fighter: FighterState,
    presentation: FighterPresentation,
    x: number,
    feetY: number,
  ): void {
    const bounce = fighter.grounded ? 0 : Math.sin(fighter.actionFrame * 0.42) * 9;
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(x - 73, feetY - 38 - bounce, 146, 31, 13);
    graphics.fillStyle(presentation.primary, fighter.action === "ko" ? 0.7 : 1);
    graphics.fillRoundedRect(x - 44, feetY - 53 - bounce, 91, 35, 12);
    graphics.fillStyle(presentation.skin, 1);
    graphics.fillCircle(x + 60, feetY - 31 - bounce, 20);
  }

  private drawLimb(
    graphics: Phaser.GameObjects.Graphics,
    startX: number,
    startY: number,
    angle: number,
    length: number,
    width: number,
    color: number,
    hand: boolean,
  ): void {
    const endX = startX + Math.sin(angle) * length;
    const endY = startY + Math.cos(angle) * length;
    graphics.lineStyle(width, color, 1);
    graphics.lineBetween(startX, startY, endX, endY);
    graphics.fillStyle(hand ? 0xffffff : color, 0.96);
    graphics.fillCircle(endX, endY, width * 0.52);
  }
}
