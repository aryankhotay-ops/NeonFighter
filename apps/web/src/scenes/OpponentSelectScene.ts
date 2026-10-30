import Phaser from "phaser";
import type { CpuDifficulty, MatchMode, OpponentType } from "../game/GameFlow";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

interface OpponentSelectData {
  readonly mode?: MatchMode;
}

/** Selects who controls Player 2 before fighter selection for local and training matches. */
export class OpponentSelectScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private mode: MatchMode = "local";

  public constructor() {
    super("opponent-select");
  }

  public init(data: OpponentSelectData): void {
    this.mode = data.mode === "training" ? "training" : "local";
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(
      this,
      this.mode === "training" ? "Choose a training opponent" : "Choose your opponent",
    );

    this.add
      .text(640, 112, this.mode === "training" ? "TRAINING SETUP" : "LOCAL VERSUS SETUP", {
        align: "center",
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "38px",
        fontStyle: "italic",
        stroke: "#050711",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.add
      .text(640, 157, "CHOOSE WHO CONTROLS PLAYER 2", {
        align: "center",
        color: "#51e9ff",
        fontFamily: "monospace",
        fontSize: "13px",
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.menu = new ArcadeMenu(
      this,
      [
        {
          label: "Two Players",
          detail: "ONE KEYBOARD",
          onSelect: () => this.startCharacterSelect("human", "medium"),
        },
        {
          label: "Vs Computer — Easy",
          detail: "SLOW / FORGIVING",
          onSelect: () => this.startCharacterSelect("cpu", "easy"),
        },
        {
          label: "Vs Computer — Medium",
          detail: "BALANCED",
          onSelect: () => this.startCharacterSelect("cpu", "medium"),
        },
        {
          label: "Vs Computer — Hard",
          detail: "FAST / TACTICAL",
          onSelect: () => this.startCharacterSelect("cpu", "hard"),
        },
        {
          label: "Back",
          detail: "MAIN MENU",
          onSelect: () => this.scene.start("main-menu"),
        },
      ],
      390,
      205,
      500,
    );

    this.add
      .text(
        640,
        555,
        "EASY reacts slowly and attacks less · MEDIUM balances offense and defense\nHARD reacts quickly, spaces carefully, blocks, parries and uses meter",
        {
          align: "center",
          color: "#9aa9bf",
          fontFamily: "monospace",
          fontSize: "12px",
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5)
      .setDepth(3);

    this.add
      .text(640, 650, "ARROWS / HOVER TO SELECT · ENTER / CLICK TO CONFIRM", {
        align: "center",
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "12px",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  public override update(): void {
    this.menu.update();
  }

  private startCharacterSelect(opponent: OpponentType, cpuDifficulty: CpuDifficulty): void {
    this.scene.start("character-select", {
      mode: this.mode,
      opponent,
      cpuDifficulty,
    });
  }
}
