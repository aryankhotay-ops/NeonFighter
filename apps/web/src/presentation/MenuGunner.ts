import Phaser from "phaser";
import { getMenuAimTarget, type MenuAimLayout } from "./MenuAim";

// Muzzle-on "aiming at the viewer" pose. The pistol is held two-handed at eye level, centred
// under the visor, so the shooter is visibly sighting down the barrel straight out of the
// screen. Coordinates are the unscaled gun centre in design space.
const VIEWER_GUN_X = 320;
const VIEWER_GUN_Y = 378;

/**
 * Lightweight procedural main-menu character. Only one Graphics object is redrawn, so the
 * aiming pose and laser respond to hover/keyboard selection without loading an animation atlas.
 */
export class MenuGunner {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly callout: Phaser.GameObjects.Text;
  private selectedIndex = 0;
  private targetAngle = -0.2;
  private currentAngle = -0.2;
  private viewerTarget = 0;
  private viewerAmount = 0;
  private elapsedMs = 0;

  public constructor(
    scene: Phaser.Scene,
    private readonly layout: MenuAimLayout,
  ) {
    this.graphics = scene.add.graphics().setDepth(2);
    this.callout = scene.add
      .text(326, 628, "CIRCUIT MARSHAL · TARGETING MENU", {
        align: "center",
        color: "#6f839c",
        fontFamily: "monospace",
        fontSize: "10px",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.aimAt(0);
    this.draw();
  }

  public aimAt(index: number): void {
    this.selectedIndex = index;
    const target = getMenuAimTarget(index, this.layout);
    this.targetAngle = Phaser.Math.Angle.Between(348, 405, target.x, target.y);
    this.viewerTarget = target.pointsAtViewer ? 1 : 0;
    this.callout
      .setText(
        target.pointsAtViewer
          ? "CIRCUIT MARSHAL · TARGET: YOU"
          : "CIRCUIT MARSHAL · TARGETING MENU",
      )
      .setColor(target.pointsAtViewer ? "#ff667f" : "#6f839c");
  }

  public update(delta: number): void {
    this.elapsedMs += delta;
    this.currentAngle = Phaser.Math.Angle.RotateTo(
      this.currentAngle,
      this.targetAngle,
      Math.min(0.16, delta * 0.009),
    );
    this.viewerAmount = Phaser.Math.Linear(
      this.viewerAmount,
      this.viewerTarget,
      Math.min(1, delta * 0.012),
    );
    this.draw();
  }

  private draw(): void {
    const breathe = Math.sin(this.elapsedMs * 0.0032) * 2;
    const pulse = 0.72 + Math.sin(this.elapsedMs * 0.014) * 0.18;
    // Cross-fade: the side-on menu pose swings in and fades before the viewer pose punches in.
    const sideAlpha = Phaser.Math.Clamp(1 - this.viewerAmount / 0.6, 0, 1);
    const viewerAlpha = Phaser.Math.Clamp((this.viewerAmount - 0.3) / 0.7, 0, 1);

    this.graphics.clear();
    this.drawBody(breathe, sideAlpha, viewerAlpha);
    if (sideAlpha > 0.01) this.drawMenuAim(breathe, pulse, sideAlpha);
    if (viewerAlpha > 0.01) this.drawViewerAim(breathe, pulse, viewerAlpha);
  }

  private drawBody(breathe: number, sideAlpha: number, viewerAlpha: number): void {
    const graphics = this.graphics;

    // Soft ground contact and coat tails establish the silhouette without sprite assets.
    graphics.fillStyle(0x000000, 0.35);
    graphics.fillEllipse(319, 608, 190, 30);
    graphics.fillStyle(0x0b1829, 1);
    graphics.beginPath();
    graphics.moveTo(270, 397 + breathe);
    graphics.lineTo(372, 397 + breathe);
    graphics.lineTo(389, 550);
    graphics.lineTo(343, 520);
    graphics.lineTo(318, 576);
    graphics.lineTo(294, 520);
    graphics.lineTo(249, 550);
    graphics.closePath();
    graphics.fillPath();

    // Legs and boots.
    graphics.lineStyle(25, 0x11273d, 1);
    graphics.lineBetween(294, 525, 283, 594);
    graphics.lineBetween(342, 525, 358, 594);
    graphics.lineStyle(12, 0x4ceaff, 0.78);
    graphics.lineBetween(270, 598, 293, 598);
    graphics.lineBetween(351, 598, 376, 598);

    // Torso armor, collar, and a bright visor keep the character readable at small sizes.
    graphics.fillStyle(0x173652, 1);
    graphics.fillRoundedRect(269, 343 + breathe, 103, 151, 22);
    graphics.fillStyle(0xff4aa2, 0.86);
    graphics.fillRect(275, 411 + breathe, 91, 9);
    graphics.fillStyle(0x102237, 1);
    graphics.fillCircle(320, 310 + breathe, 43);
    graphics.fillStyle(0x263e56, 1);
    graphics.fillRoundedRect(283, 304 + breathe, 74, 37, 12);
    graphics.lineStyle(9, 0x68efff, 1);
    graphics.lineBetween(289, 314 + breathe, 351, 314 + breathe);
    graphics.lineStyle(3, 0xffffff, 0.72);
    graphics.lineBetween(296, 311 + breathe, 333, 311 + breathe);
    if (viewerAlpha > 0.01) {
      // Red laser glint reflected in the visor while sighting down the barrel at the viewer.
      graphics.lineStyle(4, 0xff3d63, 0.9 * viewerAlpha);
      graphics.lineBetween(311, 315 + breathe, 329, 315 + breathe);
    }

    // Rear arm hangs relaxed in the menu pose; it joins the two-handed grip when aiming at you.
    if (sideAlpha > 0.01) {
      graphics.lineStyle(21, 0x132a42, sideAlpha);
      graphics.lineBetween(275, 380 + breathe, 245, 459 + breathe);
      graphics.fillStyle(0xff4aa2, 0.9 * sideAlpha);
      graphics.fillCircle(243, 461 + breathe, 12);
    }
  }

  /** Side-on pistol and laser aimed at the selected menu row. */
  private drawMenuAim(breathe: number, pulse: number, alpha: number): void {
    const graphics = this.graphics;
    const shoulderX = 348;
    const shoulderY = 405 + breathe;
    const target = getMenuAimTarget(this.selectedIndex, this.layout);

    const normalHandX = shoulderX + Math.cos(this.currentAngle) * 75;
    const normalHandY = shoulderY + Math.sin(this.currentAngle) * 75;
    // While turning toward the viewer the arm swings in toward the centre line.
    const swing = 1 - alpha;
    const handX = Phaser.Math.Linear(normalHandX, VIEWER_GUN_X + 20, swing);
    const handY = Phaser.Math.Linear(normalHandY, VIEWER_GUN_Y + breathe, swing);
    const muzzleX = handX + Math.cos(this.currentAngle) * 43;
    const muzzleY = handY + Math.sin(this.currentAngle) * 43;

    graphics.lineStyle(23, 0x1a3b58, alpha);
    graphics.lineBetween(shoulderX, shoulderY, handX, handY);
    graphics.fillStyle(0x4ceaff, 0.9 * alpha);
    graphics.fillCircle(handX, handY, 12);

    graphics.save();
    graphics.translateCanvas(handX, handY);
    graphics.rotateCanvas(this.currentAngle);
    graphics.fillStyle(0x08111d, alpha);
    graphics.fillRoundedRect(-4, -11, 51, 22, 6);
    graphics.fillStyle(0x4ceaff, 0.85 * alpha);
    graphics.fillRect(4, -8, 32, 4);
    graphics.fillStyle(0xff496f, alpha);
    graphics.fillCircle(45, 0, 5);
    graphics.restore();

    if (swing > 0.05) return;
    graphics.lineStyle(7, 0xff355f, 0.08 * pulse * alpha);
    graphics.lineBetween(muzzleX, muzzleY, target.x, target.y);
    graphics.lineStyle(2, 0xff5577, pulse * alpha);
    graphics.lineBetween(muzzleX, muzzleY, target.x, target.y);
    graphics.lineStyle(2, 0xff7690, 0.8 * alpha);
    graphics.strokeCircle(target.x, target.y, 10 + pulse * 2);
    graphics.lineBetween(target.x - 15, target.y, target.x + 15, target.y);
    graphics.lineBetween(target.x, target.y - 15, target.x, target.y + 15);
  }

  /**
   * Two-handed stance aimed straight out of the screen: foreshortened arms converge on the
   * grip, the pistol is seen muzzle-first with its sights lined up under the visor, and the
   * laser emitter flares into the camera because the beam is pointed directly at the viewer.
   */
  private drawViewerAim(breathe: number, pulse: number, alpha: number): void {
    const graphics = this.graphics;
    // The gun "punches" toward the camera as the pose settles.
    const settle = 1 - (1 - alpha) * (1 - alpha);
    const scale = 0.85 + 0.4 * settle;
    const gx = VIEWER_GUN_X;
    const gy = VIEWER_GUN_Y + breathe;

    // Red edge vignette: the whole screen is now the target.
    graphics.lineStyle(26, 0xff2a55, 0.07 * alpha * pulse);
    graphics.strokeRect(0, 0, 1280, 720);
    graphics.lineStyle(8, 0xff2a55, 0.1 * alpha * pulse);
    graphics.strokeRect(6, 6, 1268, 708);

    // Raised shoulders and foreshortened arms that widen toward the hands (nearer the camera).
    // A dark outline pass separates the arms from the torso armour behind them.
    const shoulderY = 372 + breathe;
    const gripY = gy + 32 * scale;
    for (const [color, grow] of [
      [0x07101c, 6],
      [0x234b6e, 0],
    ] as const) {
      graphics.fillStyle(color, alpha);
      graphics.fillCircle(279, shoulderY, 17 + grow / 2);
      graphics.fillCircle(361, shoulderY, 17 + grow / 2);
      this.fillTaperedLimb(
        279,
        shoulderY,
        22 + grow,
        gx - 24 * scale,
        gripY,
        30 * scale + grow,
        color,
        alpha,
      );
      this.fillTaperedLimb(
        361,
        shoulderY,
        22 + grow,
        gx + 24 * scale,
        gripY,
        30 * scale + grow,
        color,
        alpha,
      );
    }

    graphics.save();
    graphics.translateCanvas(gx, gy);
    graphics.scaleCanvas(scale, scale);

    // Fists wrapped around the grip, flanking the under-barrel laser module.
    graphics.fillStyle(0x112a40, alpha);
    graphics.fillCircle(-24, 32, 18);
    graphics.fillCircle(24, 32, 18);
    graphics.fillStyle(0x4ceaff, 0.9 * alpha);
    graphics.fillCircle(-24, 32, 13);
    graphics.fillCircle(24, 32, 13);
    graphics.lineStyle(2, 0x0b1829, alpha);
    for (const side of [-1, 1]) {
      graphics.lineBetween(side * 16, 25, side * 32, 25);
      graphics.lineBetween(side * 14, 32, side * 34, 32);
      graphics.lineBetween(side * 16, 39, side * 32, 39);
    }

    // Rear of the slide recedes up toward the shooter's eye; the rear sight sits under the visor.
    graphics.fillStyle(0x060c16, alpha);
    graphics.fillRoundedRect(-22, -42, 44, 30, 7);
    graphics.fillRect(-14, -48, 8, 7);
    graphics.fillRect(6, -48, 8, 7);
    // Top face of the slide, lit from above, joining the rear to the muzzle face.
    graphics.fillStyle(0x24425f, alpha);
    graphics.beginPath();
    graphics.moveTo(-22, -38);
    graphics.lineTo(22, -38);
    graphics.lineTo(30, -22);
    graphics.lineTo(-30, -22);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(2, 0x4ceaff, 0.55 * alpha);
    graphics.lineBetween(-22, -38, 22, -38);

    // Muzzle face of the slide with the front sight post centred on the sight line.
    graphics.fillStyle(0x0c1626, alpha);
    graphics.fillRoundedRect(-30, -26, 60, 46, 9);
    graphics.lineStyle(2, 0x4ceaff, 0.75 * alpha);
    graphics.strokeRoundedRect(-30, -26, 60, 46, 9);
    graphics.fillStyle(0x0c1626, alpha);
    graphics.fillRect(-3, -35, 6, 10);
    graphics.fillStyle(0x7ff3ff, alpha);
    graphics.fillCircle(0, -32, 2);

    // Barrel bore: a dark tunnel with rifling rings reads as looking straight down the barrel.
    graphics.fillStyle(0x2c4560, alpha);
    graphics.fillCircle(0, -3, 16);
    graphics.fillStyle(0x000000, alpha);
    graphics.fillCircle(0, -3, 13);
    graphics.lineStyle(1, 0x223649, alpha);
    graphics.strokeCircle(0, -3, 9);
    graphics.strokeCircle(0, -3, 5.5);
    graphics.lineStyle(2, 0x9ff6ff, 0.5 * alpha);
    graphics.beginPath();
    graphics.arc(0, -3, 15, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(290));
    graphics.strokePath();

    // Frame, accessory rail, and the under-barrel laser module.
    graphics.fillStyle(0x08111d, alpha);
    graphics.fillRect(-22, 20, 44, 8);
    graphics.fillStyle(0x111f31, alpha);
    graphics.fillRoundedRect(-19, 26, 38, 24, 7);
    graphics.lineStyle(2, 0xff4aa2, 0.75 * alpha);
    graphics.strokeRoundedRect(-19, 26, 38, 24, 7);
    graphics.fillStyle(0x2a0710, alpha);
    graphics.fillCircle(0, 38, 8);
    graphics.restore();

    // Laser pointed into the lens: halo, anamorphic streak, and a hot core at the emitter.
    const ex = gx;
    const ey = gy + 38 * scale;
    const glow = alpha * pulse;
    graphics.fillStyle(0xff2a55, 0.07 * glow);
    graphics.fillCircle(ex, ey, 70);
    graphics.fillStyle(0xff2a55, 0.14 * glow);
    graphics.fillCircle(ex, ey, 36);
    graphics.fillStyle(0xff4466, 0.45 * glow);
    graphics.fillCircle(ex, ey, 16);
    graphics.lineStyle(10, 0xff2a55, 0.07 * glow);
    graphics.lineBetween(ex - 220, ey, ex + 220, ey);
    graphics.lineStyle(2, 0xff6f8a, 0.55 * glow);
    graphics.lineBetween(ex - 200, ey, ex + 200, ey);
    graphics.lineStyle(2, 0xff6f8a, 0.3 * glow);
    graphics.lineBetween(ex, ey - 52, ex, ey + 52);
    graphics.fillStyle(0xffe1e7, alpha);
    graphics.fillCircle(ex, ey, 6 + pulse * 1.5);
  }

  /** Quad from (x1,y1) to (x2,y2) whose width grows, faking an arm reaching toward the camera. */
  private fillTaperedLimb(
    x1: number,
    y1: number,
    width1: number,
    x2: number,
    y2: number,
    width2: number,
    color: number,
    alpha: number,
  ): void {
    const graphics = this.graphics;
    const normal = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
    const nx = Math.cos(normal) / 2;
    const ny = Math.sin(normal) / 2;
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(x1 + nx * width1, y1 + ny * width1);
    graphics.lineTo(x2 + nx * width2, y2 + ny * width2);
    graphics.lineTo(x2 - nx * width2, y2 - ny * width2);
    graphics.lineTo(x1 - nx * width1, y1 - ny * width1);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillCircle(x2, y2, width2 / 2);
  }
}
