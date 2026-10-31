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
import {
  fighterFaceTextureKey,
  resolveFighterFaceState,
  type FighterFaceRenderState,
} from "./FighterArt";
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

    this.drawBackSilhouette(graphics, presentation, fighter.actionFrame, breathe);
    this.drawLimb(graphics, -14, hipY, pose.rearLeg, 63, 20, presentation.shadow, false, 0.16);
    this.drawLimb(graphics, -18, shoulderY, pose.rearArm, 57, 17, presentation.shadow, true, 0.3);

    graphics.save();
    graphics.rotateCanvas(pose.torsoLean);
    const broad = presentation.silhouette === "armor";
    const shoulderWidth = broad ? 40 : 30;
    const waistWidth = broad ? 33 : 25;
    graphics.fillStyle(presentation.primary, fighter.action === "hitstun" ? 0.62 : 1);
    graphics.beginPath();
    graphics.moveTo(-shoulderWidth, -144 + breathe);
    graphics.lineTo(shoulderWidth, -142 + breathe);
    graphics.lineTo(waistWidth, -64);
    graphics.lineTo(-waistWidth, -64);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(presentation.shadow, 0.8);
    graphics.fillRect(-waistWidth, -103, waistWidth * 2, 10);
    graphics.fillRect(-waistWidth, -72, waistWidth * 2, 9);
    graphics.lineStyle(2.2, presentation.accent, 0.68);
    graphics.lineBetween(0, -132 + breathe, 0, -105);
    graphics.lineBetween(-shoulderWidth + 7, -133 + breathe, -waistWidth + 5, -76);
    graphics.fillStyle(presentation.accent, 0.78);
    graphics.fillTriangle(-13, -141 + breathe, 0, -125 + breathe, 13, -141 + breathe);

    if (presentation.silhouette === "scarf") {
      // Courier harness, relay badge, and side satchel distinguish Vesper from the torso alone.
      graphics.fillStyle(presentation.accent, 0.92);
      graphics.fillRoundedRect(-23, -139, 46, 12, 5);
      graphics.lineStyle(7, presentation.accent, 0.9);
      graphics.lineBetween(-23, -128, 24, -78);
      graphics.fillStyle(presentation.shadow, 1);
      graphics.fillRoundedRect(18, -99, 25, 30, 6);
      graphics.fillStyle(presentation.primary, 1);
      graphics.fillRect(23, -91, 15, 5);
      graphics.fillStyle(0xffffff, 0.95);
      graphics.fillRoundedRect(-18, -119, 17, 8, 3);
    } else if (presentation.silhouette === "crest") {
      // Nova carries a high-contrast comet burst and asymmetric orbital sash.
      graphics.fillStyle(presentation.eye, 0.98);
      graphics.fillTriangle(0, -132, -17, -105, 0, -113);
      graphics.fillTriangle(0, -132, 17, -105, 0, -113);
      graphics.fillStyle(presentation.accent, 0.92);
      graphics.fillTriangle(-27, -100, -3, -83, -10, -63);
      graphics.fillTriangle(27, -100, 3, -83, 10, -63);
      graphics.lineStyle(4, presentation.eye, 0.82);
      graphics.lineBetween(-22, -75, 25, -93);
    } else if (presentation.silhouette === "armor") {
      // Rook's chest is a literal armored citadel: broad pauldrons and hazard-chevron plate.
      graphics.fillStyle(presentation.accent, 0.95);
      graphics.fillRoundedRect(-52, -148, 34, 50, 8);
      graphics.fillRoundedRect(18, -148, 34, 50, 8);
      graphics.fillStyle(presentation.shadow, 1);
      graphics.fillRoundedRect(-32, -126, 64, 43, 7);
      graphics.fillStyle(presentation.primary, 1);
      graphics.fillTriangle(-24, -119, 0, -91, 24, -119);
      graphics.fillStyle(presentation.accent, 1);
      graphics.fillTriangle(-13, -116, 0, -100, 13, -116);
      graphics.fillStyle(presentation.shadow, 1);
      graphics.fillRect(-39, -82, 78, 19);
      for (let rivet = -1; rivet <= 1; rivet += 1) {
        graphics.fillStyle(presentation.accent, 1);
        graphics.fillCircle(rivet * 24, -73, 3);
      }
    } else {
      // Sable's high collar, neon seam, and split coat make a narrow duelist blade silhouette.
      graphics.fillStyle(presentation.shadow, 0.96);
      graphics.beginPath();
      graphics.moveTo(-30, -128);
      graphics.lineTo(-18, -106);
      graphics.lineTo(-33, -75);
      graphics.lineTo(-18, -14);
      graphics.lineTo(1, -69);
      graphics.lineTo(19, -14);
      graphics.lineTo(34, -75);
      graphics.lineTo(18, -106);
      graphics.lineTo(30, -128);
      graphics.lineTo(9, -118);
      graphics.lineTo(0, -96);
      graphics.lineTo(-9, -118);
      graphics.closePath();
      graphics.fillPath();
      graphics.fillStyle(presentation.accent, 0.85);
      graphics.fillRect(-4, -126, 8, 63);
      graphics.lineStyle(3, presentation.accent, 0.8);
      graphics.lineBetween(-20, -58, 21, -107);
    }
    graphics.restore();

    this.drawLimb(graphics, 15, hipY, pose.frontLeg, 65, 21, presentation.primary, false, -0.18);
    this.drawLimb(
      graphics,
      19,
      shoulderY,
      pose.frontArm,
      61,
      18,
      presentation.primary,
      true,
      -0.28,
    );

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

  /** Resolve a cached face sprite transform without issuing any face vector draw commands. */
  public faceRenderState(
    fighter: FighterState,
    presentation: FighterPresentation,
    renderPosition?: FighterRenderPosition,
  ): FighterFaceRenderState {
    const x = renderPosition?.x ?? toPixels(fighter.x);
    const feetY = renderPosition?.feetY ?? toPixels(fighter.y);
    const face = resolveFighterFaceState(fighter);
    const textureKey = fighterFaceTextureKey(presentation.fighterId, face);
    const knockedDown = fighter.action === "knockdown" || fighter.action === "ko";

    if (knockedDown) {
      return {
        textureKey,
        x: x + 60,
        y: feetY - 32 - (fighter.grounded ? 0 : Math.sin(fighter.actionFrame * 0.42) * 9),
        scaleX: 0.82,
        scaleY: 0.82,
        rotation: Math.PI / 2,
      };
    }

    const broadScale = presentation.silhouette === "armor" ? 1.08 : 1;
    const crouch = fighter.crouching ? 35 : 0;
    const breathe = Math.sin(fighter.actionFrame * 0.12) * 1.8;
    return {
      textureKey,
      x,
      y: feetY - crouch + (-176 + breathe) * presentation.bodyScaleY,
      scaleX: fighter.facing * presentation.bodyScaleX * broadScale,
      scaleY: presentation.bodyScaleY * broadScale,
      rotation: 0,
    };
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

  private drawBackSilhouette(
    graphics: Phaser.GameObjects.Graphics,
    presentation: FighterPresentation,
    actionFrame: number,
    breathe: number,
  ): void {
    if (presentation.silhouette === "scarf") {
      const flutter = Math.sin(actionFrame * 0.2) * 13;
      graphics.fillStyle(presentation.accent, 0.96);
      graphics.beginPath();
      graphics.moveTo(-9, -140 + breathe);
      graphics.lineTo(-102 - flutter, -132);
      graphics.lineTo(-51 - flutter * 0.4, -112);
      graphics.lineTo(-111 - flutter, -91);
      graphics.lineTo(-17, -111);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(4, presentation.primary, 0.9);
      graphics.lineBetween(-17, -132, -91 - flutter, -116);
      return;
    }
    if (presentation.silhouette === "crest") {
      const pulse = 3 + Math.sin(actionFrame * 0.12) * 2;
      graphics.lineStyle(7, presentation.accent, 0.5);
      graphics.beginPath();
      graphics.arc(0, -104, 52 + pulse, -2.75, 0.1);
      graphics.strokePath();
      graphics.lineStyle(3, presentation.eye, 0.9);
      graphics.beginPath();
      graphics.arc(0, -104, 60 + pulse, 0.25, 2.85);
      graphics.strokePath();
      return;
    }
    if (presentation.silhouette === "armor") {
      graphics.fillStyle(presentation.shadow, 1);
      graphics.fillRoundedRect(-54, -143, 108, 79, 16);
      graphics.lineStyle(5, presentation.accent, 0.78);
      graphics.strokeRoundedRect(-54, -143, 108, 79, 16);
      return;
    }
    graphics.fillStyle(presentation.shadow, 1);
    graphics.beginPath();
    graphics.moveTo(-28, -92);
    graphics.lineTo(-43, -3);
    graphics.lineTo(-9, -34);
    graphics.lineTo(0, 0);
    graphics.lineTo(10, -34);
    graphics.lineTo(43, -3);
    graphics.lineTo(28, -92);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(4, presentation.accent, 0.65);
    graphics.lineBetween(0, -82, 0, -4);
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
    bend: number,
  ): void {
    const firstLength = length * 0.52;
    const secondLength = length * 0.5;
    const jointX = startX + Math.sin(angle) * firstLength;
    const jointY = startY + Math.cos(angle) * firstLength;
    const endX = jointX + Math.sin(angle + bend) * secondLength;
    const endY = jointY + Math.cos(angle + bend) * secondLength;
    graphics.lineStyle(width, color, 1);
    graphics.lineBetween(startX, startY, jointX, jointY);
    graphics.lineBetween(jointX, jointY, endX, endY);
    graphics.fillStyle(color, 1);
    graphics.fillCircle(startX, startY, width * 0.48);
    graphics.fillCircle(jointX, jointY, width * 0.51);
    if (hand) {
      graphics.fillStyle(0xf4f7ff, 0.98);
      graphics.fillCircle(endX, endY, width * 0.6);
      graphics.lineStyle(2, color, 0.9);
      graphics.strokeCircle(endX, endY, width * 0.6);
    } else {
      graphics.fillStyle(presentationBootColor(color), 1);
      graphics.fillEllipse(endX + Math.sin(angle + bend) * 5, endY + 2, width * 1.45, width * 0.72);
    }
  }
}

function presentationBootColor(color: number): number {
  const red = ((color >> 16) & 0xff) * 0.52;
  const green = ((color >> 8) & 0xff) * 0.52;
  const blue = (color & 0xff) * 0.52;
  return (Math.round(red) << 16) | (Math.round(green) << 8) | Math.round(blue);
}
