import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

export class ExitScene extends Phaser.Scene {
  private menu!: ArcadeMenu;

  public constructor() {
    super("exit-screen");
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "Session ended");

    const overlay = this.add.graphics().setDepth(2);
    overlay.fillStyle(0x02050c, 0.8);
    overlay.fillRoundedRect(280, 175, 720, 380, 24);
    overlay.lineStyle(3, 0xff4d75, 0.75);
    overlay.strokeRoundedRect(280, 175, 720, 380, 24);

    this.add
      .text(640, 245, "SESSION ENDED", {
        align: "center",
        color: "#ff5b7b",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "55px",
        fontStyle: "italic",
        stroke: "#03050c",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(
        640,
        345,
        "THE CIRCUIT IS STILL WATCHING.\nYOU MAY CLOSE THIS TAB OR RETURN FOR ANOTHER ROUND.",
        {
          align: "center",
          color: "#aeb9ca",
          fontFamily: "monospace",
          fontSize: "14px",
          lineSpacing: 9,
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5)
      .setDepth(3);

    this.menu = new ArcadeMenu(
      this,
      [
        {
          label: "Return to Main Menu",
          detail: "CONTINUE",
          onSelect: () => this.scene.start("main-menu"),
        },
      ],
      425,
      435,
      430,
    );
  }

  public override update(): void {
    this.menu.update();
  }
}
