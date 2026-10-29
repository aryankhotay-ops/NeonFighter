import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

export class CreditsScene extends Phaser.Scene {
  private menu!: ArcadeMenu;

  public constructor() {
    super("credits");
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "Made for the next round");
    this.add
      .text(640, 175, "CREDITS", {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "46px",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(3);

    const credits = [
      ["GAME DESIGN & ENGINEERING", "NEON RIVALS PROJECT"],
      ["COMBAT SYSTEM", "ORIGINAL DETERMINISTIC TYPESCRIPT SIMULATION"],
      ["VISUALS", "ORIGINAL PROCEDURAL PHASER PRESENTATION"],
      ["AUDIO", "ORIGINAL WEB AUDIO SYNTHESIS"],
      ["FRAMEWORK", "PHASER 3 · VITE · TYPESCRIPT"],
    ];
    credits.forEach(([role, name], index) => {
      const y = 250 + index * 62;
      this.add
        .text(640, y, role ?? "", {
          color: index % 2 === 0 ? "#51e9ff" : "#ff6db7",
          fontFamily: "monospace",
          fontSize: "13px",
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setDepth(3);
      this.add
        .text(640, y + 25, name ?? "", {
          color: "#f5f7ff",
          fontFamily: "monospace",
          fontSize: "15px",
        })
        .setOrigin(0.5)
        .setDepth(3);
    });

    this.add
      .text(
        640,
        562,
        "Inspired by the discipline of classic arcade fighters.\nNo third-party characters, art, music, or sound assets are included.",
        {
          align: "center",
          color: "#8997ae",
          fontFamily: "monospace",
          fontSize: "12px",
          lineSpacing: 8,
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
