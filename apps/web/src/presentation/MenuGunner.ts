import Phaser from "phaser";
import { getMenuAimTarget, type MenuAimLayout } from "./MenuAim";

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
    const graphics = this.graphics;
    const breathe = Math.sin(this.elapsedMs * 0.0032) * 2;
    const pulse = 0.72 + Math.sin(this.elapsedMs * 0.014) * 0.18;
    const shoulderX = 348;
    const shoulderY = 405 + breathe;
    const target = getMenuAimTarget(this.selectedIndex, this.layout);

    graphics.clear();

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

    // Rear arm remains relaxed; the aiming arm is the only articulated element.
    graphics.lineStyle(21, 0x132a42, 1);
    graphics.lineBetween(275, 380 + breathe, 245, 459 + breathe);
    graphics.fillStyle(0xff4aa2, 0.9);
    graphics.fillCircle(243, 461 + breathe, 12);

    const normalHandX = shoulderX + Math.cos(this.currentAngle) * 75;
    const normalHandY = shoulderY + Math.sin(this.currentAngle) * 75;
    const normalMuzzleX = normalHandX + Math.cos(this.currentAngle) * 43;
    const normalMuzzleY = normalHandY + Math.sin(this.currentAngle) * 43;
    const frontHandX = 386;
    const frontHandY = 410 + breathe;
    const handX = Phaser.Math.Linear(normalHandX, frontHandX, this.viewerAmount);
    const handY = Phaser.Math.Linear(normalHandY, frontHandY, this.viewerAmount);

    graphics.lineStyle(23, 0x1a3b58, 1);
    graphics.lineBetween(shoulderX, shoulderY, handX, handY);
    graphics.fillStyle(0x4ceaff, 0.9);
    graphics.fillCircle(handX, handY, 12);

    if (this.viewerAmount < 0.82) {
      // Side-on pistol and laser aimed at the selected menu row.
      graphics.save();
      graphics.translateCanvas(normalHandX, normalHandY);
      graphics.rotateCanvas(this.currentAngle);
      graphics.fillStyle(0x08111d, 1);
      graphics.fillRoundedRect(-4, -11, 51, 22, 6);
      graphics.fillStyle(0x4ceaff, 0.85);
      graphics.fillRect(4, -8, 32, 4);
      graphics.fillStyle(0xff496f, 1);
      graphics.fillCircle(45, 0, 5);
      graphics.restore();

      graphics.lineStyle(7, 0xff355f, 0.08 * pulse * (1 - this.viewerAmount));
      graphics.lineBetween(normalMuzzleX, normalMuzzleY, target.x, target.y);
      graphics.lineStyle(2, 0xff5577, pulse * (1 - this.viewerAmount));
      graphics.lineBetween(normalMuzzleX, normalMuzzleY, target.x, target.y);
      graphics.lineStyle(2, 0xff7690, 0.8 * (1 - this.viewerAmount));
      graphics.strokeCircle(target.x, target.y, 10 + pulse * 2);
      graphics.lineBetween(target.x - 15, target.y, target.x + 15, target.y);
      graphics.lineBetween(target.x, target.y - 15, target.x, target.y + 15);
    }

    if (this.viewerAmount > 0.04) {
      // Foreshortened barrel and widening beam read as the marshal turning toward the viewer.
      const alpha = this.viewerAmount;
      graphics.fillStyle(0xff355f, 0.045 * alpha * pulse);
      graphics.beginPath();
      graphics.moveTo(frontHandX, frontHandY + 5);
      graphics.lineTo(34, 720);
      graphics.lineTo(1246, 720);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(3, 0xff496f, 0.32 * alpha * pulse);
      graphics.lineBetween(frontHandX, frontHandY, 160, 720);
      graphics.lineBetween(frontHandX, frontHandY, 1120, 720);
      graphics.fillStyle(0x050a12, 1);
      graphics.fillCircle(frontHandX, frontHandY, 30 * alpha + 8);
      graphics.lineStyle(6, 0x4ceaff, 0.78 * alpha);
      graphics.strokeCircle(frontHandX, frontHandY, 26 * alpha + 7);
      graphics.fillStyle(0xff355f, pulse * alpha);
      graphics.fillCircle(frontHandX, frontHandY, 10 * alpha + 2);

      const reticleX = 640;
      const reticleY = 555;
      graphics.lineStyle(3, 0xff496f, 0.82 * alpha);
      graphics.strokeCircle(reticleX, reticleY, 34 + pulse * 4);
      graphics.lineBetween(reticleX - 55, reticleY, reticleX - 20, reticleY);
      graphics.lineBetween(reticleX + 20, reticleY, reticleX + 55, reticleY);
      graphics.lineBetween(reticleX, reticleY - 55, reticleX, reticleY - 20);
      graphics.lineBetween(reticleX, reticleY + 20, reticleX, reticleY + 55);
    }
  }
}
