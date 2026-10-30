import { FLOOR_Y, toPixels } from "@neon-rivals/simulation";
import type Phaser from "phaser";
import type { StageArt } from "../settings/GameSettings";

// Four original animated arenas. Expensive static geometry is drawn only when the setting changes;
// moving scenery updates at 30 Hz while the deterministic fight simulation remains at 60 Hz.
export class StageView {
  private readonly staticLayer: Phaser.GameObjects.Graphics;
  private readonly motionLayer: Phaser.GameObjects.Graphics;
  private stageArt: StageArt;
  private lastMotionFrame = -2;

  public constructor(scene: Phaser.Scene, stageArt: StageArt = "transit") {
    this.stageArt = stageArt;
    this.staticLayer = scene.add.graphics().setDepth(0);
    this.motionLayer = scene.add.graphics().setDepth(1);
    this.drawStaticArena();
  }

  public setStageArt(stageArt: StageArt): void {
    if (stageArt === this.stageArt) return;
    this.stageArt = stageArt;
    this.lastMotionFrame = -2;
    this.staticLayer.clear();
    this.motionLayer.clear();
    this.drawStaticArena();
  }

  public drawMotion(frame: number): void {
    // 30 Hz background animation halves scene-graphics work under online rollback/catch-up load.
    const motionFrame = frame - (frame % 2);
    if (motionFrame === this.lastMotionFrame) return;
    this.lastMotionFrame = motionFrame;
    this.motionLayer.clear();

    switch (this.stageArt) {
      case "transit":
        this.drawTransitMotion(motionFrame);
        break;
      case "rooftop":
        this.drawRooftopMotion(motionFrame);
        break;
      case "reactor":
        this.drawReactorMotion(motionFrame);
        break;
      case "harbor":
        this.drawHarborMotion(motionFrame);
        break;
    }
  }

  private drawStaticArena(): void {
    switch (this.stageArt) {
      case "transit":
        this.drawTransitStatic();
        break;
      case "rooftop":
        this.drawRooftopStatic();
        break;
      case "reactor":
        this.drawReactorStatic();
        break;
      case "harbor":
        this.drawHarborStatic();
        break;
    }
    this.drawFloor();
  }

  private drawTransitStatic(): void {
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
    this.drawSkyline(0x080d1c, 0x32d8ff, 0xff3d9e);
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
  }

  private drawTransitMotion(frame: number): void {
    const graphics = this.motionLayer;
    const trainX = ((frame * 4) % 1760) - 430;
    graphics.fillStyle(0x283a59, 1);
    graphics.fillRoundedRect(trainX, 318, 390, 49, 7);
    graphics.fillStyle(0x79f1ff, 0.85);
    for (let x = trainX + 18; x < trainX + 370; x += 44) graphics.fillRect(x, 330, 27, 14);
    for (let index = 0; index < 16; index += 1) {
      const x = 18 + index * 82;
      const bob = Math.sin(frame * 0.04 + index) * 3;
      graphics.fillStyle(index % 3 === 0 ? 0x17182a : 0x111522, 1);
      graphics.fillCircle(x, 492 + bob, 10);
      graphics.fillRect(x - 13, 500 + bob, 26, 54);
    }
    graphics.lineStyle(1, 0xa9eaff, 0.18);
    for (let index = 0; index < 24; index += 1) {
      const x = ((index * 97 + frame * 3) % 1360) - 40;
      const y = (index * 61 + frame * 7) % 610;
      graphics.lineBetween(x, y, x - 8, y + 24);
    }
  }

  private drawRooftopStatic(): void {
    const graphics = this.staticLayer;
    graphics.fillGradientStyle(0x071023, 0x071023, 0x331251, 0x331251, 1);
    graphics.fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0xc8e8ff, 0.13);
    graphics.fillCircle(205, 150, 100);
    graphics.lineStyle(4, 0x8fd9ff, 0.7);
    graphics.strokeCircle(205, 150, 70);
    this.drawSkyline(0x070a18, 0x766cff, 0x46e4ff);
    graphics.fillStyle(0x15192d, 1);
    graphics.fillRect(0, 420, 1280, 105);
    graphics.lineStyle(4, 0x68779d, 0.65);
    for (let x = 0; x < 1280; x += 72) graphics.lineBetween(x, 420, x + 36, 495);
    graphics.fillStyle(0x2c3254, 1);
    graphics.fillRect(805, 330, 10, 190);
    graphics.lineStyle(4, 0x8b93bc, 0.8);
    graphics.lineBetween(810, 340, 730, 420);
    graphics.lineBetween(810, 340, 890, 420);
  }

  private drawRooftopMotion(frame: number): void {
    const graphics = this.motionLayer;
    graphics.lineStyle(2, 0x8fd9ff, 0.24);
    for (let index = 0; index < 20; index += 1) {
      const x = ((index * 83 + frame * 8) % 1460) - 90;
      const y = (index * 47 + frame * 3) % 505;
      graphics.lineBetween(x, y, x - 48, y + 9);
    }
    const droneX = ((frame * 2.5) % 1500) - 110;
    const droneY = 175 + Math.sin(frame * 0.025) * 32;
    graphics.fillStyle(0x111b34, 1);
    graphics.fillRoundedRect(droneX, droneY, 78, 22, 8);
    graphics.fillStyle(0x6ff3ff, 0.9);
    graphics.fillRect(droneX + 29, droneY + 8, 20, 5);
    graphics.lineStyle(3, 0x8bd7ff, 0.5);
    graphics.lineBetween(droneX - 25, droneY + 11, droneX + 103, droneY + 11);
    const lightning = frame % 180;
    if (lightning < 4) {
      graphics.fillStyle(0xb6c7ff, 0.08 * (4 - lightning));
      graphics.fillRect(0, 0, 1280, 590);
    }
  }

  private drawReactorStatic(): void {
    const graphics = this.staticLayer;
    graphics.fillGradientStyle(0x071512, 0x071512, 0x082933, 0x082933, 1);
    graphics.fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0x071b20, 1);
    for (let x = 35; x < 1280; x += 126) graphics.fillRoundedRect(x, 85, 74, 400, 16);
    graphics.lineStyle(6, 0x47ffc2, 0.38);
    graphics.strokeCircle(640, 245, 150);
    graphics.lineStyle(2, 0x47ffc2, 0.22);
    graphics.strokeCircle(640, 245, 102);
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const angle = (spoke / 8) * Math.PI * 2;
      graphics.lineBetween(640, 245, 640 + Math.cos(angle) * 150, 245 + Math.sin(angle) * 150);
    }
    graphics.fillStyle(0x152c31, 1);
    graphics.fillRect(0, 420, 1280, 100);
    graphics.fillStyle(0x2d5752, 1);
    for (let x = 0; x < 1280; x += 64) graphics.fillRect(x, 438, 36, 10);
  }

  private drawReactorMotion(frame: number): void {
    const graphics = this.motionLayer;
    const pulse = 0.18 + (Math.sin(frame * 0.06) + 1) * 0.1;
    graphics.fillStyle(0x52ffc6, pulse);
    graphics.fillCircle(640, 245, 80 + Math.sin(frame * 0.04) * 10);
    graphics.lineStyle(6, 0x9effdf, 0.7);
    graphics.beginPath();
    graphics.arc(640, 245, 128, frame * 0.018, frame * 0.018 + 2.4);
    graphics.strokePath();
    graphics.lineStyle(3, 0x51bfff, 0.6);
    graphics.beginPath();
    graphics.arc(640, 245, 112, -frame * 0.025, -frame * 0.025 + 1.8);
    graphics.strokePath();
    for (let index = 0; index < 12; index += 1) {
      const y = 105 + index * 31;
      const x = ((frame * 5 + index * 139) % 1340) - 30;
      graphics.fillStyle(index % 2 === 0 ? 0x56ffc5 : 0x51bfff, 0.36);
      graphics.fillRect(x, y, 28, 2);
    }
  }

  private drawHarborStatic(): void {
    const graphics = this.staticLayer;
    graphics.fillGradientStyle(0x030819, 0x030819, 0x101d3a, 0x101d3a, 1);
    graphics.fillRect(0, 0, 1280, 720);
    graphics.fillStyle(0xffd57c, 0.16);
    graphics.fillCircle(1050, 135, 95);
    graphics.lineStyle(4, 0xffd57c, 0.7);
    graphics.strokeCircle(1050, 135, 62);
    graphics.fillStyle(0x080f22, 1);
    graphics.fillRect(0, 360, 1280, 165);
    for (let x = 20; x < 1280; x += 150) {
      graphics.fillStyle(0x111d36, 1);
      graphics.fillRect(x, 315 - (x % 4) * 12, 105, 210);
      graphics.lineStyle(3, 0xffb95c, 0.48);
      graphics.lineBetween(x + 12, 350, x + 88, 350);
    }
    graphics.lineStyle(8, 0x273957, 1);
    graphics.lineBetween(190, 165, 190, 465);
    graphics.lineBetween(190, 175, 360, 300);
    graphics.lineBetween(890, 185, 890, 465);
    graphics.lineBetween(890, 195, 755, 315);
  }

  private drawHarborMotion(frame: number): void {
    const graphics = this.motionLayer;
    const waterY = 485;
    graphics.fillStyle(0x071c36, 0.9);
    graphics.fillRect(0, waterY, 1280, 40);
    for (let index = 0; index < 18; index += 1) {
      const x = ((index * 97 + frame * 2) % 1390) - 55;
      const y = waterY + 4 + (index % 5) * 7;
      graphics.lineStyle(2, index % 3 === 0 ? 0xffbc6b : 0x55cfff, 0.3);
      graphics.lineBetween(x, y, x + 54, y);
    }
    const shipX = 780 - ((frame * 0.7) % 1250);
    graphics.fillStyle(0x172b48, 1);
    graphics.beginPath();
    graphics.moveTo(shipX, 405);
    graphics.lineTo(shipX + 180, 405);
    graphics.lineTo(shipX + 145, 450);
    graphics.lineTo(shipX + 20, 450);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(0xffd073, 0.8);
    for (let x = shipX + 28; x < shipX + 155; x += 32) graphics.fillRect(x, 418, 15, 7);
    graphics.fillStyle(0xb8c7d9, 0.12);
    for (let index = 0; index < 7; index += 1) {
      const drift = (frame * (0.16 + index * 0.01)) % 80;
      graphics.fillCircle(shipX + 142 + index * 4, 385 - drift, 8 + index);
    }
  }

  private drawSkyline(buildingColor: number, windowA: number, windowB: number): void {
    const graphics = this.staticLayer;
    graphics.fillStyle(buildingColor, 1);
    for (let index = 0; index < 17; index += 1) {
      const width = 54 + ((index * 37) % 58);
      const height = 90 + ((index * 53) % 235);
      graphics.fillRect(index * 82 - 18, 560 - height, width, height);
      graphics.fillStyle(index % 3 === 0 ? windowA : windowB, 0.22);
      for (let y = 580 - height; y < 535; y += 27) graphics.fillRect(index * 82 + 2, y, 8, 12);
      graphics.fillStyle(buildingColor, 1);
    }
  }

  private drawFloor(): void {
    const graphics = this.staticLayer;
    graphics.fillGradientStyle(0x222b40, 0x222b40, 0x080b13, 0x080b13, 1);
    graphics.fillRect(0, 520, 1280, 200);
    graphics.lineStyle(1, 0x50dfff, 0.16);
    for (let x = -280; x <= 1560; x += 80) graphics.lineBetween(640, 520, x, 720);
    for (let y = 545; y < 720; y += 32) graphics.lineBetween(0, y, 1280, y);
    graphics.fillStyle(0xff3d9e, 0.85);
    graphics.fillRect(0, toPixels(FLOOR_Y), 1280, 3);
  }
}
