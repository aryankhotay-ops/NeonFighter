import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

export class ControlsScene extends Phaser.Scene {
  private menu!: ArcadeMenu;

  public constructor() {
    super("controls");
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "Operator manual");
    this.add
      .text(640, 175, "CONTROLS", {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "46px",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(3);

    const rows = [
      ["MOVE / PARRY", "W A S D", "ARROW KEYS"],
      ["GUARD / DEFEND", "F", "J"],
      ["HEAVY ATTACK", "G", "K"],
      ["SPECIAL", "H", "L"],
      ["SUPER ART", "G + H", "K + L"],
      ["QUICK RISE", "DOWN ON LANDING", "DOWN ON LANDING"],
    ];
    this.add
      .text(290, 235, "ACTION", { color: "#ffe45c", fontFamily: "monospace", fontSize: "15px" })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(630, 235, "PLAYER 1", { color: "#51e9ff", fontFamily: "monospace", fontSize: "15px" })
      .setOrigin(0.5)
      .setDepth(3);
    this.add
      .text(970, 235, "PLAYER 2", { color: "#ff6db7", fontFamily: "monospace", fontSize: "15px" })
      .setOrigin(0.5)
      .setDepth(3);

    rows.forEach((row, index) => {
      const y = 280 + index * 48;
      const color = index % 2 === 0 ? 0x0b1728 : 0x111c31;
      this.add.rectangle(640, y + 15, 940, 42, color, 0.88).setDepth(2);
      this.add
        .text(290, y, row[0] ?? "", { color: "#d9e1ef", fontFamily: "monospace", fontSize: "14px" })
        .setOrigin(0.5)
        .setDepth(3);
      this.add
        .text(630, y, row[1] ?? "", { color: "#f5f8ff", fontFamily: "monospace", fontSize: "14px" })
        .setOrigin(0.5)
        .setDepth(3);
      this.add
        .text(970, y, row[2] ?? "", { color: "#f5f8ff", fontFamily: "monospace", fontSize: "14px" })
        .setOrigin(0.5)
        .setDepth(3);
    });

    this.add
      .text(
        640,
        578,
        "HOLD GUARD TO BLOCK · GUARD + DOWN BLOCKS LOW · TAP TOWARD / DOWN TO PARRY",
        {
          color: "#8fa1bb",
          fontFamily: "monospace",
          fontSize: "13px",
        },
      )
      .setOrigin(0.5)
      .setDepth(3);

    this.menu = new ArcadeMenu(
      this,
      [{ label: "Back", detail: "MAIN MENU", onSelect: () => this.scene.start("main-menu") }],
      490,
      620,
      300,
    );
  }

  public override update(): void {
    this.menu.update();
  }
}
