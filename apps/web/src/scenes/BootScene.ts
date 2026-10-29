import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("boot");
  }

  public create(): void {
    configureSmoothCamera(this);
    this.scene.start("main-menu");
  }
}
