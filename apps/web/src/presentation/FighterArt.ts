import type Phaser from "phaser";
import type { FighterPresentation } from "./FighterPresentationConfig";

export type FighterExpression = "neutral" | "focused" | "hurt" | "knockout";

export interface FighterFaceState {
  readonly expression: FighterExpression;
  readonly blink: boolean;
}

export interface FighterFaceRenderState {
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly rotation: number;
}

export interface CollectiblePortraitProfile {
  readonly headWidth: number;
  readonly headHeight: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
  readonly signature: "courier-kit" | "comet-crest" | "warden-armor" | "duelist-coat";
}

// Five tiny cached textures replace dozens of vector draw commands per fighter per frame.
// They are generated only for fighters entering a match, never during room creation.
export const FIGHTER_FACE_TEXTURE_VARIANTS: readonly FighterFaceState[] = [
  { expression: "neutral", blink: false },
  { expression: "neutral", blink: true },
  { expression: "focused", blink: false },
  { expression: "hurt", blink: false },
  { expression: "knockout", blink: false },
];

export const FIGHTER_FACE_TEXTURE_SIZE = 112;
export const FIGHTER_FACE_BYTES_PER_IDENTITY =
  FIGHTER_FACE_TEXTURE_VARIANTS.length * FIGHTER_FACE_TEXTURE_SIZE * FIGHTER_FACE_TEXTURE_SIZE * 4;
export const MAX_MATCH_FACE_TEXTURE_BYTES = FIGHTER_FACE_BYTES_PER_IDENTITY * 2;
const FACE_TEXTURE_SIZE = FIGHTER_FACE_TEXTURE_SIZE;
const FACE_TEXTURE_CENTER = FACE_TEXTURE_SIZE / 2;

export function collectiblePortraitProfile(
  presentation: FighterPresentation,
): CollectiblePortraitProfile {
  switch (presentation.faceStyle) {
    case "courier":
      return {
        headWidth: 86,
        headHeight: 68,
        bodyWidth: 46,
        bodyHeight: 63,
        signature: "courier-kit",
      };
    case "comet":
      return {
        headWidth: 82,
        headHeight: 70,
        bodyWidth: 42,
        bodyHeight: 67,
        signature: "comet-crest",
      };
    case "warden":
      return {
        headWidth: 94,
        headHeight: 72,
        bodyWidth: 60,
        bodyHeight: 59,
        signature: "warden-armor",
      };
    case "duelist":
      return {
        headWidth: 84,
        headHeight: 73,
        bodyWidth: 43,
        bodyHeight: 69,
        signature: "duelist-coat",
      };
  }
}

export function resolveFighterFaceState(fighter: {
  readonly action: string;
  readonly actionFrame: number;
}): FighterFaceState {
  if (fighter.action === "ko") return FIGHTER_FACE_TEXTURE_VARIANTS[4]!;
  if (fighter.action === "hitstun" || fighter.action === "knockdown") {
    return FIGHTER_FACE_TEXTURE_VARIANTS[3]!;
  }
  if (fighter.action === "attack" || fighter.action === "parry") {
    return FIGHTER_FACE_TEXTURE_VARIANTS[2]!;
  }
  return fighter.actionFrame % 150 >= 145
    ? FIGHTER_FACE_TEXTURE_VARIANTS[1]!
    : FIGHTER_FACE_TEXTURE_VARIANTS[0]!;
}

export function fighterFaceTextureKey(fighterId: string, face: FighterFaceState): string {
  return `fighter-face-v2-${fighterId}-${face.expression}-${face.blink ? "blink" : "open"}`;
}

/** Lazily rasterize the five small face states for one selected fighter. */
export function ensureFighterFaceTextures(
  scene: Phaser.Scene,
  presentation: FighterPresentation,
): void {
  const missing = FIGHTER_FACE_TEXTURE_VARIANTS.filter(
    (variant) => !scene.textures.exists(fighterFaceTextureKey(presentation.fighterId, variant)),
  );
  if (missing.length === 0) return;

  // The hidden painter exists only during scene creation and is destroyed before the first frame.
  const painter = scene.add.graphics().setVisible(false);
  for (const variant of missing) {
    painter.clear();
    drawFighterHead(painter, presentation, {
      centerX: FACE_TEXTURE_CENTER,
      centerY: FACE_TEXTURE_CENTER,
      expression: variant.expression,
      blink: variant.blink,
    });
    painter.generateTexture(
      fighterFaceTextureKey(presentation.fighterId, variant),
      FACE_TEXTURE_SIZE,
      FACE_TEXTURE_SIZE,
    );
  }
  painter.destroy();
}

interface HeadOptions {
  readonly centerX: number;
  readonly centerY: number;
  readonly expression: FighterExpression;
  readonly blink: boolean;
  readonly scale?: number;
}

/**
 * Draws an original face into a setup-time cache or static portrait. Gameplay uses the cached
 * textures, so these vector commands are not rebuilt on every rendered frame.
 */
export function drawFighterHead(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  options: HeadOptions,
): void {
  const scale = options.scale ?? 1;
  const x = options.centerX;
  const y = options.centerY;
  const sx = (value: number): number => x + value * scale;
  const sy = (value: number): number => y + value * scale;
  const focused = options.expression === "focused";
  const hurt = options.expression === "hurt";
  const knockout = options.expression === "knockout";

  const headWidth =
    presentation.faceStyle === "warden" ? 52 : presentation.faceStyle === "duelist" ? 43 : 46;
  const headHeight =
    presentation.faceStyle === "duelist" ? 54 : presentation.faceStyle === "warden" ? 47 : 50;

  // Neck, ears, and a strongly fighter-specific head silhouette replace the old circle.
  graphics.fillStyle(presentation.skin, 1);
  graphics.fillRoundedRect(sx(-8), sy(17), 16 * scale, 19 * scale, 5 * scale);
  graphics.fillCircle(sx(-22), sy(1), 5.4 * scale);
  graphics.fillCircle(sx(22), sy(1), 5.4 * scale);
  graphics.fillEllipse(x, y, headWidth * scale, headHeight * scale);
  graphics.lineStyle(Math.max(1, 2 * scale), presentation.shadow, 0.72);
  graphics.strokeEllipse(x, y, headWidth * scale, headHeight * scale);

  drawHair(graphics, presentation, x, y, scale);

  const eyeY = hurt ? 1 : -2;
  if (knockout) {
    graphics.lineStyle(2.2 * scale, presentation.shadow, 1);
    for (const eyeX of [-10, 10]) {
      graphics.lineBetween(sx(eyeX - 3), sy(eyeY - 3), sx(eyeX + 3), sy(eyeY + 3));
      graphics.lineBetween(sx(eyeX + 3), sy(eyeY - 3), sx(eyeX - 3), sy(eyeY + 3));
    }
  } else if (options.blink || hurt) {
    graphics.lineStyle(2.4 * scale, presentation.shadow, 1);
    graphics.lineBetween(sx(-15), sy(eyeY), sx(-5), sy(eyeY + (hurt ? 2 : 0)));
    graphics.lineBetween(sx(5), sy(eyeY + (hurt ? 2 : 0)), sx(15), sy(eyeY));
  } else {
    graphics.fillStyle(0xf4f7ff, 1);
    graphics.fillEllipse(sx(-10), sy(eyeY), 10 * scale, (focused ? 5.5 : 7) * scale);
    graphics.fillEllipse(sx(10), sy(eyeY), 10 * scale, (focused ? 5.5 : 7) * scale);
    graphics.fillStyle(presentation.eye, 1);
    graphics.fillCircle(sx(-8), sy(eyeY), 2.8 * scale);
    graphics.fillCircle(sx(12), sy(eyeY), 2.8 * scale);
    graphics.fillStyle(0x10131c, 1);
    graphics.fillCircle(sx(-7.4), sy(eyeY), 1.3 * scale);
    graphics.fillCircle(sx(12.6), sy(eyeY), 1.3 * scale);
  }

  // Brows and mouth react to combat state while the nose anchors the face at gameplay scale.
  graphics.lineStyle(2.2 * scale, presentation.hair, 0.96);
  graphics.lineBetween(sx(-16), sy(-9 + (focused ? 2 : 0)), sx(-5), sy(-10 - (focused ? 2 : 0)));
  graphics.lineBetween(sx(5), sy(-10 - (focused ? 2 : 0)), sx(16), sy(-9 + (focused ? 2 : 0)));
  graphics.lineStyle(1.4 * scale, presentation.shadow, 0.72);
  graphics.lineBetween(sx(1), sy(-1), sx(-1), sy(7));
  graphics.lineBetween(sx(-1), sy(7), sx(3), sy(8));
  graphics.lineStyle(2 * scale, presentation.shadow, 0.9);
  if (hurt) {
    graphics.beginPath();
    graphics.arc(x, sy(18), 6 * scale, Math.PI + 0.2, Math.PI * 2 - 0.2);
    graphics.strokePath();
  } else {
    graphics.lineBetween(sx(-6), sy(15), sx(focused ? 7 : 5), sy(focused ? 14 : 16));
  }

  drawFaceSignature(graphics, presentation, x, y, scale);
}

/** Draws an original big-head vinyl-collectible portrait for character selection. */
export function drawFighterPortrait(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
): void {
  const profile = collectiblePortraitProfile(presentation);
  const headY = -35;
  const bodyTop = 3;
  const bodyBottom = bodyTop + profile.bodyHeight;

  // Toy-display plinth and rim light make each static portrait read as a collectible figure.
  graphics.fillStyle(presentation.shadow, 0.42);
  graphics.fillEllipse(0, 101, 92, 17);
  graphics.fillStyle(0x08101d, 0.96);
  graphics.fillRoundedRect(-48, 92, 96, 13, 6);
  graphics.lineStyle(2, presentation.primary, 0.9);
  graphics.strokeRoundedRect(-48, 92, 96, 13, 6);

  drawCollectibleBackAccessories(graphics, presentation);

  // Small body and stubby limbs deliberately contrast with the oversized head.
  const legSpread = presentation.faceStyle === "warden" ? 20 : 14;
  drawPortraitLimb(graphics, -10, bodyBottom - 7, -legSpread, 91, 13, presentation.shadow, false);
  drawPortraitLimb(graphics, 10, bodyBottom - 7, legSpread, 91, 13, presentation.primary, false);
  drawPortraitLimb(
    graphics,
    -profile.bodyWidth * 0.42,
    bodyTop + 15,
    presentation.faceStyle === "courier" ? -43 : -35,
    presentation.faceStyle === "comet" ? 36 : 50,
    presentation.faceStyle === "warden" ? 17 : 13,
    presentation.shadow,
    true,
  );

  graphics.fillStyle(presentation.primary, 1);
  graphics.fillRoundedRect(
    -profile.bodyWidth / 2,
    bodyTop,
    profile.bodyWidth,
    profile.bodyHeight,
    presentation.faceStyle === "warden" ? 10 : 15,
  );
  graphics.fillStyle(presentation.shadow, 0.94);
  graphics.fillRoundedRect(
    -profile.bodyWidth * 0.43,
    bodyBottom - 18,
    profile.bodyWidth * 0.86,
    10,
    4,
  );
  graphics.lineStyle(2, presentation.accent, 0.72);
  graphics.lineBetween(0, bodyTop + 4, 0, bodyBottom - 20);
  drawCollectibleCostume(graphics, presentation, profile, bodyTop, bodyBottom);

  drawPortraitLimb(
    graphics,
    profile.bodyWidth * 0.42,
    bodyTop + 15,
    presentation.faceStyle === "comet" ? 43 : 36,
    presentation.faceStyle === "warden" ? 47 : 45,
    presentation.faceStyle === "warden" ? 18 : 14,
    presentation.primary,
    true,
  );

  drawCollectibleHead(graphics, presentation, profile, headY);
}

function drawHair(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  x: number,
  y: number,
  scale: number,
): void {
  const sx = (value: number): number => x + value * scale;
  const sy = (value: number): number => y + value * scale;
  graphics.fillStyle(presentation.hair, 1);

  if (presentation.faceStyle === "courier") {
    graphics.beginPath();
    graphics.moveTo(sx(-21), sy(-5));
    graphics.lineTo(sx(-18), sy(-21));
    graphics.lineTo(sx(-7), sy(-26));
    graphics.lineTo(sx(4), sy(-23));
    graphics.lineTo(sx(18), sy(-14));
    graphics.lineTo(sx(21), sy(-6));
    graphics.lineTo(sx(12), sy(-13));
    graphics.lineTo(sx(1), sy(-12));
    graphics.lineTo(sx(-9), sy(-15));
    graphics.closePath();
    graphics.fillPath();
  } else if (presentation.faceStyle === "comet") {
    graphics.beginPath();
    graphics.moveTo(sx(-22), sy(2));
    graphics.lineTo(sx(-18), sy(-18));
    graphics.lineTo(sx(-7), sy(-28));
    graphics.lineTo(sx(-2), sy(-39));
    graphics.lineTo(sx(5), sy(-27));
    graphics.lineTo(sx(14), sy(-36));
    graphics.lineTo(sx(13), sy(-22));
    graphics.lineTo(sx(22), sy(-17));
    graphics.lineTo(sx(17), sy(-4));
    graphics.lineTo(sx(7), sy(-13));
    graphics.lineTo(sx(-4), sy(-11));
    graphics.closePath();
    graphics.fillPath();
  } else if (presentation.faceStyle === "warden") {
    graphics.fillRoundedRect(sx(-22), sy(-25), 44 * scale, 17 * scale, 7 * scale);
    graphics.fillRect(sx(-22), sy(-17), 7 * scale, 20 * scale);
    graphics.fillRect(sx(15), sy(-17), 7 * scale, 20 * scale);
  } else {
    graphics.beginPath();
    graphics.moveTo(sx(-23), sy(-2));
    graphics.lineTo(sx(-19), sy(-21));
    graphics.lineTo(sx(-6), sy(-28));
    graphics.lineTo(sx(13), sy(-23));
    graphics.lineTo(sx(22), sy(-10));
    graphics.lineTo(sx(13), sy(3));
    graphics.lineTo(sx(5), sy(-13));
    graphics.lineTo(sx(-2), sy(4));
    graphics.lineTo(sx(-10), sy(-14));
    graphics.lineTo(sx(-20), sy(8));
    graphics.closePath();
    graphics.fillPath();
  }
}

function drawFaceSignature(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  x: number,
  y: number,
  scale: number,
): void {
  const sx = (value: number): number => x + value * scale;
  const sy = (value: number): number => y + value * scale;
  if (presentation.faceStyle === "courier") {
    graphics.lineStyle(2.6 * scale, presentation.eye, 0.96);
    graphics.strokeRoundedRect(sx(-17), sy(-8), 18 * scale, 14 * scale, 4 * scale);
    graphics.lineBetween(sx(1), sy(-2), sx(18), sy(4));
    graphics.fillStyle(presentation.eye, 0.95);
    graphics.fillCircle(sx(-20), sy(2), 2.6 * scale);
  } else if (presentation.faceStyle === "comet") {
    graphics.fillStyle(presentation.accent, 0.95);
    graphics.fillTriangle(sx(-18), sy(8), sx(-14), sy(10), sx(-17), sy(15));
    graphics.fillStyle(presentation.eye, 1);
    graphics.fillTriangle(sx(13), sy(6), sx(19), sy(8), sx(14), sy(16));
  } else if (presentation.faceStyle === "warden") {
    graphics.lineStyle(3.6 * scale, presentation.accent, 1);
    graphics.lineBetween(sx(-18), sy(-10), sx(-5), sy(-13));
    graphics.lineBetween(sx(5), sy(-13), sx(18), sy(-10));
    graphics.lineBetween(sx(-18), sy(15), sx(-11), sy(21));
    graphics.lineBetween(sx(18), sy(15), sx(11), sy(21));
    graphics.lineStyle(1.4 * scale, presentation.shadow, 0.85);
    graphics.lineBetween(sx(13), sy(-11), sx(17), sy(-4));
  } else {
    graphics.lineStyle(2.4 * scale, presentation.eye, 1);
    graphics.strokeCircle(sx(10), sy(-2), 8 * scale);
    graphics.lineBetween(sx(16), sy(4), sx(21), sy(11));
    graphics.fillStyle(presentation.eye, 0.8);
    graphics.fillCircle(sx(21), sy(11), 2 * scale);
  }
}

function drawCollectibleBackAccessories(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
): void {
  if (presentation.faceStyle === "courier") {
    // Vesper: a huge wind-swept courier scarf reads even at thumbnail size.
    graphics.fillStyle(presentation.accent, 0.96);
    graphics.beginPath();
    graphics.moveTo(-17, -5);
    graphics.lineTo(-76, 17);
    graphics.lineTo(-39, 29);
    graphics.lineTo(-78, 45);
    graphics.lineTo(-16, 31);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(3, presentation.primary, 0.9);
    graphics.lineBetween(-20, 3, -70, 20);
  } else if (presentation.faceStyle === "comet") {
    // Nova: twin orbital ribbons reinforce the aerial, high-energy identity.
    graphics.lineStyle(7, presentation.accent, 0.66);
    graphics.beginPath();
    graphics.arc(0, 37, 48, -0.3, 1.95);
    graphics.strokePath();
    graphics.lineStyle(3, presentation.eye, 0.95);
    graphics.beginPath();
    graphics.arc(0, 37, 54, 2.7, 5.25);
    graphics.strokePath();
  } else if (presentation.faceStyle === "warden") {
    // Rook: squared shoulder armor makes the whole portrait fortress-like.
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(-49, 3, 30, 41, 7);
    graphics.fillRoundedRect(19, 3, 30, 41, 7);
    graphics.fillStyle(presentation.accent, 0.95);
    graphics.fillRoundedRect(-53, 7, 28, 25, 6);
    graphics.fillRoundedRect(25, 7, 28, 25, 6);
  } else {
    // Sable: long split coat tails create a narrow, blade-like silhouette.
    graphics.fillStyle(presentation.shadow, 1);
    graphics.beginPath();
    graphics.moveTo(-23, 36);
    graphics.lineTo(-42, 92);
    graphics.lineTo(-9, 73);
    graphics.lineTo(0, 96);
    graphics.lineTo(9, 73);
    graphics.lineTo(42, 92);
    graphics.lineTo(23, 36);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(3, presentation.accent, 0.84);
    graphics.lineBetween(0, 45, 0, 92);
  }
}

function drawCollectibleCostume(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  profile: CollectiblePortraitProfile,
  bodyTop: number,
  bodyBottom: number,
): void {
  if (profile.signature === "courier-kit") {
    graphics.lineStyle(6, presentation.accent, 0.95);
    graphics.lineBetween(-18, bodyTop + 4, 16, bodyBottom - 18);
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(10, bodyBottom - 32, 22, 20, 5);
    graphics.fillStyle(presentation.primary, 1);
    graphics.fillRect(14, bodyBottom - 27, 14, 4);
    graphics.fillStyle(0xffffff, 0.92);
    graphics.fillRoundedRect(-21, bodyTop + 20, 14, 8, 3);
  } else if (profile.signature === "comet-crest") {
    graphics.fillStyle(presentation.eye, 0.96);
    graphics.fillTriangle(0, bodyTop + 8, -10, bodyTop + 28, 0, bodyTop + 24);
    graphics.fillTriangle(0, bodyTop + 8, 10, bodyTop + 28, 0, bodyTop + 24);
    graphics.fillStyle(presentation.accent, 0.9);
    graphics.fillTriangle(-16, bodyBottom - 12, -3, bodyTop + 24, -2, bodyBottom - 13);
    graphics.fillTriangle(16, bodyBottom - 12, 3, bodyTop + 24, 2, bodyBottom - 13);
  } else if (profile.signature === "warden-armor") {
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(-25, bodyTop + 8, 50, 31, 7);
    graphics.fillStyle(presentation.accent, 1);
    graphics.fillTriangle(-20, bodyTop + 13, 0, bodyTop + 31, 20, bodyTop + 13);
    graphics.fillStyle(presentation.primary, 1);
    graphics.fillTriangle(-12, bodyTop + 16, 0, bodyTop + 26, 12, bodyTop + 16);
    graphics.fillStyle(presentation.accent, 0.9);
    for (let rivet = -1; rivet <= 1; rivet += 1) {
      graphics.fillCircle(rivet * 18, bodyBottom - 13, 2.5);
    }
  } else {
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillTriangle(-22, bodyTop + 3, -5, bodyTop + 31, -2, bodyTop + 4);
    graphics.fillTriangle(22, bodyTop + 3, 5, bodyTop + 31, 2, bodyTop + 4);
    graphics.fillStyle(presentation.accent, 0.96);
    graphics.fillRect(-3, bodyTop + 4, 6, bodyBottom - bodyTop - 24);
    graphics.lineStyle(2, presentation.accent, 0.8);
    graphics.lineBetween(-16, bodyBottom - 18, 16, bodyTop + 17);
  }
}

function drawCollectibleHead(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  profile: CollectiblePortraitProfile,
  centerY: number,
): void {
  const left = -profile.headWidth / 2;
  const top = centerY - profile.headHeight / 2;

  graphics.fillStyle(presentation.skin, 1);
  graphics.fillCircle(left - 1, centerY + 2, 8);
  graphics.fillCircle(-left + 1, centerY + 2, 8);
  graphics.fillRoundedRect(left, top, profile.headWidth, profile.headHeight, 19);
  graphics.lineStyle(3, presentation.shadow, 0.88);
  graphics.strokeRoundedRect(left, top, profile.headWidth, profile.headHeight, 19);

  // Vinyl-like soft highlight without a per-frame shader.
  graphics.fillStyle(0xffffff, 0.16);
  graphics.fillRoundedRect(left + 8, top + 6, profile.headWidth - 16, 9, 5);

  drawCollectibleHair(graphics, presentation, profile, centerY);

  const eyeY = centerY + 5;
  const eyeSpread = presentation.faceStyle === "warden" ? 18 : 17;
  const eyeWidth = presentation.faceStyle === "duelist" ? 13 : 14;
  graphics.fillStyle(0x070911, 1);
  graphics.fillEllipse(-eyeSpread, eyeY, eyeWidth, 17);
  graphics.fillEllipse(eyeSpread, eyeY, eyeWidth, 17);
  graphics.fillStyle(0xffffff, 0.9);
  graphics.fillCircle(-eyeSpread - 2.5, eyeY - 4, 2.3);
  graphics.fillCircle(eyeSpread - 2.5, eyeY - 4, 2.3);

  drawCollectibleFaceSignature(graphics, presentation, centerY, eyeSpread);
}

function drawCollectibleHair(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  profile: CollectiblePortraitProfile,
  centerY: number,
): void {
  const left = -profile.headWidth / 2;
  const right = profile.headWidth / 2;
  const top = centerY - profile.headHeight / 2;
  graphics.fillStyle(presentation.hair, 1);

  if (presentation.faceStyle === "courier") {
    graphics.beginPath();
    graphics.moveTo(left + 2, centerY - 5);
    graphics.lineTo(left + 8, top + 8);
    graphics.lineTo(-20, top - 5);
    graphics.lineTo(-5, top + 2);
    graphics.lineTo(10, top - 8);
    graphics.lineTo(18, top + 4);
    graphics.lineTo(right - 4, top + 14);
    graphics.lineTo(21, centerY - 8);
    graphics.lineTo(4, centerY - 15);
    graphics.lineTo(-14, centerY - 10);
    graphics.closePath();
    graphics.fillPath();
  } else if (presentation.faceStyle === "comet") {
    graphics.beginPath();
    graphics.moveTo(left + 3, centerY - 4);
    graphics.lineTo(left + 9, top + 9);
    graphics.lineTo(-24, top - 3);
    graphics.lineTo(-14, top - 16);
    graphics.lineTo(-2, top - 6);
    graphics.lineTo(8, top - 25);
    graphics.lineTo(17, top - 7);
    graphics.lineTo(31, top - 13);
    graphics.lineTo(27, top + 7);
    graphics.lineTo(right - 3, top + 13);
    graphics.lineTo(21, centerY - 7);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(presentation.accent, 0.92);
    graphics.fillTriangle(4, top - 7, 9, top - 21, 15, top - 6);
  } else if (presentation.faceStyle === "warden") {
    graphics.fillRoundedRect(left + 1, top - 2, profile.headWidth - 2, 24, 12);
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(left - 3, top + 12, 15, 32, 5);
    graphics.fillRoundedRect(right - 12, top + 12, 15, 32, 5);
    graphics.fillStyle(presentation.accent, 1);
    graphics.fillRect(-16, top + 5, 32, 5);
  } else {
    graphics.beginPath();
    graphics.moveTo(left + 1, centerY + 2);
    graphics.lineTo(left + 5, top + 10);
    graphics.lineTo(-23, top - 3);
    graphics.lineTo(-5, top - 8);
    graphics.lineTo(20, top + 1);
    graphics.lineTo(right - 2, top + 15);
    graphics.lineTo(24, centerY + 12);
    graphics.lineTo(9, centerY - 14);
    graphics.lineTo(-2, centerY + 18);
    graphics.lineTo(-14, centerY - 11);
    graphics.lineTo(-28, centerY + 11);
    graphics.closePath();
    graphics.fillPath();
  }
}

function drawCollectibleFaceSignature(
  graphics: Phaser.GameObjects.Graphics,
  presentation: FighterPresentation,
  centerY: number,
  eyeSpread: number,
): void {
  if (presentation.faceStyle === "courier") {
    graphics.lineStyle(4, presentation.eye, 0.95);
    graphics.strokeRoundedRect(-eyeSpread - 10, centerY - 5, 21, 20, 6);
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(36, centerY - 3, 10, 20, 4);
    graphics.fillStyle(presentation.eye, 1);
    graphics.fillRect(38, centerY + 1, 6, 8);
  } else if (presentation.faceStyle === "comet") {
    graphics.fillStyle(presentation.eye, 1);
    graphics.fillTriangle(-32, centerY + 13, -24, centerY + 15, -29, centerY + 23);
    graphics.fillCircle(eyeSpread + 7, centerY - 3, 2.6);
    graphics.lineStyle(3, presentation.accent, 0.9);
    graphics.lineBetween(23, centerY + 18, 33, centerY + 11);
  } else if (presentation.faceStyle === "warden") {
    graphics.lineStyle(5, presentation.accent, 1);
    graphics.lineBetween(-31, centerY - 8, -8, centerY - 13);
    graphics.lineBetween(8, centerY - 13, 31, centerY - 8);
    graphics.fillStyle(presentation.shadow, 1);
    graphics.fillRoundedRect(-24, centerY + 20, 48, 8, 4);
    graphics.lineStyle(2, presentation.accent, 0.85);
    graphics.lineBetween(11, centerY - 2, 19, centerY + 12);
  } else {
    graphics.lineStyle(4, presentation.eye, 1);
    graphics.strokeCircle(eyeSpread, centerY + 5, 11);
    graphics.lineBetween(28, centerY + 13, 38, centerY + 22);
    graphics.fillStyle(presentation.eye, 0.96);
    graphics.fillCircle(38, centerY + 22, 3);
  }
}

function drawPortraitLimb(
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  color: number,
  hand: boolean,
): void {
  const jointX = startX + (endX - startX) * 0.52 + (hand ? 3 : -2);
  const jointY = startY + (endY - startY) * 0.48;
  graphics.lineStyle(width, color, 1);
  graphics.lineBetween(startX, startY, jointX, jointY);
  graphics.lineBetween(jointX, jointY, endX, endY);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(jointX, jointY, width * 0.48);
  if (hand) {
    graphics.fillStyle(0xf4f7ff, 1);
    graphics.fillCircle(endX, endY, width * 0.58);
  } else {
    graphics.fillStyle(darken(color), 1);
    graphics.fillEllipse(endX + 5, endY, width * 1.45, width * 0.72);
  }
}

function darken(color: number): number {
  const red = ((color >> 16) & 0xff) * 0.55;
  const green = ((color >> 8) & 0xff) * 0.55;
  const blue = (color & 0xff) * 0.55;
  return (Math.round(red) << 16) | (Math.round(green) << 8) | Math.round(blue);
}
