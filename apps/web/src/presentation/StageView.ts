import { FLOOR_Y, toPixels } from "@neon-rivals/simulation";
import type Phaser from "phaser";

// Original Neon Transit Deck stage. Static geometry is drawn once; only lightweight moving
// elements are redrawn each render frame.
export class StageView {
  private readonly staticLayer: Phaser.GameObjects.Graphics;
  private readonly motionLayer: Phaser.GameObjects.Graphics;

  public constructor(scene: Phaser.Scene) {
    this.staticLayer = scene.add.graphics().setDepth(0);
    this.motionLayer = scene.add.graphics().setDepth(1);
    this.drawStaticArena();
  }

  public drawMotion(frame: number): void {
    const graphics = this.motionLayer;
    graphics.clear();

    const trainX = ((frame * 4) % 1760) - 430;
    graphics.fillStyle(0x283a59, 1);
    graphics.fillRoundedRect(trainX, 318, 390, 49, 7);
    graphics.fillStyle(0x79f1ff, 0.85);
    for (let x = trainX + 18; x < trainX + 370; x += 44) graphics.fillRect(x, 330, 27, 14);

    for (let index = 0; index < 22; index += 1) {
      const x = 18 + index * 59;
      const bob = Math.sin(frame * 0.04 + index) * 3;
      graphics.fillStyle(index % 3 === 0 ? 0x17182a : 0x111522, 1);
      graphics.fillCircle(x, 492 + bob, 10);
      graphics.fillRect(x - 13, 500 + bob, 26, 54);
      if (index % 5 === 0) {
        graphics.lineStyle(4, 0xffd85a, 0.55);
        graphics.lineBetween(x, 505 + bob, x + 16, 479 + bob);
      }
    }

    graphics.lineStyle(1, 0xa9eaff, 0.18);
    for (let index = 0; index < 42; index += 1) {
      const x = ((index * 97 + frame * 3) % 1360) - 40;
      const y = (index * 61 + frame * 7) % 610;
      graphics.lineBetween(x, y, x - 8, y + 24);
    }
  }

  private drawStaticArena(): void {
    const graphics = this.staticLayer;
    graphics.fillGradientStyle(0x061027, 0x061027, 0x38183f, 0x38183f, 1);
    graphics.fillRect(0, 0, 1280, 720);

    graphics.fillStyle(0xff4aa2, 0.13);
    graphics.fillCircle(1020, 175, 128);
    graphics.lineStyle(5, 0xff77bd, 0.62);
    graphics.strokeCircle(1020, 175, 80);
    graphics.lineStyle(2, 0xff77bd, 0.3);
    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = (spoke / 12) * Math.PI * 2;
      graphics.lineBetween(1020, 175, 1020 + Math.cos(angle) * 80, 175 + Math.sin(angle) * 80);
    }

    graphics.fillStyle(0x080d1c, 1);
    for (let index = 0; index < 17; index += 1) {
      const width = 54 + ((index * 37) % 58);
      const height = 90 + ((index * 53) % 235);
      graphics.fillRect(index * 82 - 18, 560 - height, width, height);
      graphics.fillStyle(index % 3 === 0 ? 0x32d8ff : 0xff3d9e, 0.22);
      for (let y = 580 - height; y < 535; y += 27) graphics.fillRect(index * 82 + 2, y, 8, 12);
      graphics.fillStyle(0x080d1c, 1);
    }

    graphics.fillStyle(0x172942, 1);
    graphics.fillRect(0, 372, 1280, 18);
    graphics.fillStyle(0x4bdfff, 0.72);
    graphics.fillRect(0, 372, 1280, 3);
    for (let x = 34; x < 1280; x += 96) {
      graphics.fillStyle(0x0a0d19, 1);
      graphics.fillRect(x, 390, 13, 126);
    }

    graphics.fillStyle(0x10243a, 0.95);
    graphics.fillRoundedRect(52, 405, 180, 62, 8);
    graphics.lineStyle(3, 0x38e8ff, 0.8);
    graphics.strokeRoundedRect(52, 405, 180, 62, 8);
    graphics.fillStyle(0x38e8ff, 0.75);
    graphics.fillRect(73, 431, 138, 9);

    graphics.fillGradientStyle(0x222b40, 0x222b40, 0x080b13, 0x080b13, 1);
    graphics.fillRect(0, 520, 1280, 200);
    graphics.lineStyle(1, 0x50dfff, 0.16);
    for (let x = -280; x <= 1560; x += 80) graphics.lineBetween(640, 520, x, 720);
    for (let y = 545; y < 720; y += 32) graphics.lineBetween(0, y, 1280, y);
    graphics.fillStyle(0xff3d9e, 0.85);
    graphics.fillRect(0, toPixels(FLOOR_Y), 1280, 3);
  }
}
