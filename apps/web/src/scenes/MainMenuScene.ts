import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

export class MainMenuScene extends Phaser.Scene {
  private menu!: ArcadeMenu;

  public constructor() {
    super("main-menu");
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "A new challenger enters the circuit");

    this.add
      .text(718, 173, "INSERT COURAGE", {
        color: "#ffde57",
        fontFamily: "monospace",
        fontSize: "12px",
        letterSpacing: 4,
      })
      .setDepth(3);

    this.menu = new ArcadeMenu(
      this,
      [
        {
          label: "Local Versus",
          detail: "2 PLAYERS",
          onSelect: () => this.scene.start("character-select", { mode: "local" }),
        },
        {
          label: "Online Play",
          detail: "PRIVATE LOBBY",
          onSelect: () => this.scene.start("online-lobby"),
        },
        {
          label: "Training",
          detail: "COMBAT LAB",
          onSelect: () => this.scene.start("character-select", { mode: "training" }),
        },
        {
          label: "Controls",
          detail: "INPUT GUIDE",
          onSelect: () => this.scene.start("controls"),
        },
        {
          label: "Settings",
          detail: "AUDIO / EFFECTS",
          onSelect: () => this.scene.start("settings"),
        },
        {
          label: "Credits",
          detail: "THE CREW",
          onSelect: () => this.scene.start("credits"),
        },
      ],
      706,
      204,
      494,
    );

    this.add
      .text(74, 628, "ARROWS TO NAVIGATE · ENTER TO CONFIRM", {
        color: "#7d8ba3",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setDepth(3);
    this.add
      .text(1205, 628, "BUILD 0.2 · LOCAL COMBAT SLICE", {
        align: "right",
        color: "#7d8ba3",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setOrigin(1, 0)
      .setDepth(3);
  }

  public override update(): void {
    this.menu.update();
  }
}
