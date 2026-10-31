import {
  FIGHTER_IDS,
  FIGHTER_ROSTER,
  getFighterDefinition,
  type FighterId,
} from "@neon-rivals/simulation";
import Phaser from "phaser";
import { CharacterSelectController } from "../game/CharacterSelectController";
import {
  cpuDifficultyLabel,
  type CpuDifficulty,
  type MatchMode,
  type OpponentType,
} from "../game/GameFlow";
import {
  getFighterPresentation,
  type FighterPresentation,
} from "../presentation/FighterPresentationConfig";
import { drawFighterPortrait } from "../presentation/FighterArt";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { drawArcadeBackdrop } from "../ui/ArcadeUi";

interface CharacterSelectData {
  readonly mode?: MatchMode;
  readonly opponent?: OpponentType;
  readonly cpuDifficulty?: CpuDifficulty;
}

export class CharacterSelectScene extends Phaser.Scene {
  private mode: MatchMode = "local";
  private opponent: OpponentType = "human";
  private cpuDifficulty: CpuDifficulty = "medium";
  private selection!: CharacterSelectController;
  private cards: Phaser.GameObjects.Container[] = [];
  private lockLabels: Phaser.GameObjects.Text[] = [];
  private instruction!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private matchupPanel!: Phaser.GameObjects.Container;
  private p1Summary!: Phaser.GameObjects.Text;
  private p2Summary!: Phaser.GameObjects.Text;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyConfirm!: Phaser.Input.Keyboard.Key;
  private keyBack!: Phaser.Input.Keyboard.Key;
  private cursorIndex = 0;

  public constructor() {
    super("character-select");
  }

  public init(data: CharacterSelectData): void {
    this.mode = data.mode ?? "local";
    this.opponent = data.opponent ?? "human";
    this.cpuDifficulty = data.cpuDifficulty ?? "medium";
    this.selection = new CharacterSelectController(this.mode, FIGHTER_IDS);
    this.cursorIndex = 0;
    this.cards = [];
    this.lockLabels = [];
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(
      this,
      this.mode === "training" ? "Choose your training fighter" : "Choose your rival",
    );
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable.");
    this.keyLeft = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyUp = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyConfirm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keyBack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.add
      .text(770, 84, "SELECT YOUR FIGHTER", {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "32px",
        fontStyle: "italic",
        stroke: "#050711",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(3);

    FIGHTER_ROSTER.forEach((fighter, index) => {
      const presentation = getFighterPresentation(fighter.id);
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 345 + column * 590;
      const y = 246 + row * 183;
      const panel = this.add.rectangle(0, 0, 520, 158, presentation.shadow, 0.94).setOrigin(0.5);
      panel.setStrokeStyle(4, presentation.primary, 0.72);
      const portraitHalo = this.add.circle(-191, -6, 62, presentation.primary, 0.13);
      portraitHalo.setStrokeStyle(2, presentation.accent, 0.38);
      const portrait = this.createFighterPortrait(presentation);
      portrait.setPosition(-191, -7).setScale(0.9);

      const name = this.add.text(-118, -69, fighter.name.toUpperCase(), {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "27px",
        fontStyle: "italic",
        stroke: "#050711",
        strokeThickness: 6,
      });
      const epithet = this.add.text(-116, -35, fighter.epithet.toUpperCase(), {
        color: `#${presentation.accent.toString(16).padStart(6, "0")}`,
        fontFamily: "monospace",
        fontSize: "10px",
      });
      const style = this.add.text(-116, -11, `STYLE  ${fighter.fightingStyle}`, {
        color: "#d8e0ed",
        fontFamily: "monospace",
        fontSize: "11px",
      });
      const superArt = this.add.text(-116, 14, `SUPER ART  ${fighter.moves.super.label}`, {
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "11px",
      });
      const description = this.add.text(-116, 39, fighter.description, {
        color: "#9faec3",
        fontFamily: "monospace",
        fontSize: "9px",
        wordWrap: { width: 330 },
      });
      const lockLabel = this.add
        .text(241, -69, "", {
          align: "right",
          color: "#67f28a",
          fontFamily: "Arial Black, sans-serif",
          fontSize: "11px",
          stroke: "#050711",
          strokeThickness: 4,
        })
        .setOrigin(1, 0);

      const container = this.add
        .container(x, y, [
          panel,
          portraitHalo,
          portrait,
          name,
          epithet,
          style,
          superArt,
          description,
          lockLabel,
        ])
        .setDepth(3);
      container.setSize(520, 158).setInteractive({ useHandCursor: true });
      container.on("pointerover", () => {
        if (this.selection.snapshot.phase === "ready") return;
        this.cursorIndex = index;
        this.renderSelection();
      });
      container.on("pointerdown", () => {
        if (this.selection.snapshot.phase !== "ready") this.confirmChoice(fighter.id);
      });
      this.cards.push(container);
      this.lockLabels.push(lockLabel);
    });

    this.createMatchupPanel();

    this.instruction = this.add
      .text(640, 650, "", {
        align: "center",
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "15px",
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.controlsText = this.add
      .text(640, 688, "", {
        align: "center",
        color: "#7f8da5",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5)
      .setDepth(6);
    this.renderSelection();
  }

  public override update(): void {
    if (this.selection.snapshot.phase !== "ready") {
      if (Phaser.Input.Keyboard.JustDown(this.keyLeft)) this.moveCursor(-1, 0);
      if (Phaser.Input.Keyboard.JustDown(this.keyRight)) this.moveCursor(1, 0);
      if (Phaser.Input.Keyboard.JustDown(this.keyUp)) this.moveCursor(0, -1);
      if (Phaser.Input.Keyboard.JustDown(this.keyDown)) this.moveCursor(0, 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyConfirm)) {
      if (this.selection.snapshot.phase === "ready") {
        this.startConfirmedMatch();
      } else {
        const fighter = FIGHTER_ROSTER[this.cursorIndex];
        if (fighter) this.confirmChoice(fighter.id);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyBack)) this.cancelSelection();
  }

  private createMatchupPanel(): void {
    const background = this.add.rectangle(0, 0, 1080, 88, 0x030711, 0.96);
    background.setStrokeStyle(3, 0xffe45c, 0.88);
    this.p1Summary = this.add.text(-505, -29, "", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "12px",
      lineSpacing: 4,
    });
    this.p2Summary = this.add
      .text(505, -29, "", {
        align: "right",
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "12px",
        lineSpacing: 4,
      })
      .setOrigin(1, 0);
    const versus = this.add
      .text(0, -20, "VS", {
        color: "#ff4aa2",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "32px",
        fontStyle: "italic",
      })
      .setOrigin(0.5);
    const begin = this.add
      .text(0, 25, "ENTER / CLICK TO BEGIN", {
        color: "#ffe45c",
        fontFamily: "monospace",
        fontSize: "10px",
        letterSpacing: 2,
      })
      .setOrigin(0.5);
    this.matchupPanel = this.add
      .container(640, 580, [background, this.p1Summary, this.p2Summary, versus, begin])
      .setDepth(5)
      .setSize(1080, 88)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.matchupPanel.on("pointerdown", () => this.startConfirmedMatch());
  }

  private moveCursor(deltaColumn: number, deltaRow: number): void {
    const column = this.cursorIndex % 2;
    const row = Math.floor(this.cursorIndex / 2);
    const nextColumn = (column + deltaColumn + 2) % 2;
    const nextRow = (row + deltaRow + 2) % 2;
    this.cursorIndex = nextRow * 2 + nextColumn;
    this.renderSelection();
  }

  private confirmChoice(choice: FighterId): void {
    this.selection.select(choice);
    const snapshot = this.selection.snapshot;
    if (snapshot.phase === "choosing-p2") {
      const selectedIndex = FIGHTER_IDS.indexOf(choice);
      this.cursorIndex = (selectedIndex + 1) % FIGHTER_IDS.length;
    }
    this.renderSelection();
  }

  private cancelSelection(): void {
    const before = this.selection.snapshot;
    const canceledChoice = before.phase === "ready" ? before.choices[1] : before.choices[0];
    const result = this.selection.cancel();
    if (result === "exit-to-menu") {
      this.scene.start("main-menu");
      return;
    }
    if (canceledChoice) {
      const canceledIndex = FIGHTER_IDS.indexOf(canceledChoice);
      if (canceledIndex >= 0) this.cursorIndex = canceledIndex;
    }
    this.renderSelection();
  }

  private startConfirmedMatch(): void {
    const fighters = this.selection.confirmedMatchup();
    if (!fighters) return;
    this.scene.start("fight", {
      mode: this.mode,
      fighters,
      opponent: this.opponent,
      cpuDifficulty: this.cpuDifficulty,
    });
  }

  private renderSelection(): void {
    const snapshot = this.selection.snapshot;
    this.cards.forEach((card, index) => {
      const panel = card.getAt(0) as Phaser.GameObjects.Rectangle;
      const portraitHalo = card.getAt(1) as Phaser.GameObjects.Arc;
      const fighter = FIGHTER_ROSTER[index];
      const lockLabel = this.lockLabels[index];
      if (!fighter || !lockLabel) return;
      const presentation = getFighterPresentation(fighter.id);
      const isCursor = index === this.cursorIndex && snapshot.phase !== "ready";
      const selectedBy: string[] = [];
      if (snapshot.choices[0] === fighter.id) selectedBy.push("P1");
      if (snapshot.choices[1] === fighter.id) {
        selectedBy.push(this.opponent === "cpu" ? "CPU" : "P2");
      }
      const isLocked = selectedBy.length > 0;
      panel.setStrokeStyle(
        isCursor ? 8 : isLocked ? 6 : 4,
        isCursor ? 0xffe45c : isLocked ? 0x67f28a : presentation.primary,
        isCursor || isLocked ? 1 : 0.72,
      );
      portraitHalo.setFillStyle(presentation.primary, isCursor ? 0.3 : isLocked ? 0.22 : 0.13);
      portraitHalo.setScale(isCursor ? 1.08 : 1);
      lockLabel.setText(isLocked ? `${selectedBy.join(" + ")} LOCKED` : "");
      card.setScale(isCursor ? 1.025 : 1);
      card.setAlpha(snapshot.phase === "ready" && !isLocked ? 0.45 : 1);
    });

    const highlighted = FIGHTER_ROSTER[this.cursorIndex];
    if (snapshot.phase === "ready") {
      this.renderConfirmedMatchup();
      this.instruction.setText("MATCHUP CONFIRMED");
      this.controlsText.setText(
        this.mode === "training"
          ? `ENTER BEGIN TRAINING · ESC CHANGE ${this.opponent === "cpu" ? "CPU" : "PLAYER 2"}`
          : `ENTER BEGIN MATCH · ESC CHANGE ${this.opponent === "cpu" ? "CPU" : "PLAYER 2"}`,
      );
    } else {
      this.matchupPanel.setVisible(false);
      const player = snapshot.activePlayer ?? 0;
      this.instruction.setText(
        this.mode === "training"
          ? `${player === 1 && this.opponent === "cpu" ? `CPU ${cpuDifficultyLabel(this.cpuDifficulty)}` : `TRAINING PLAYER ${player + 1}`} · ${highlighted?.name.toUpperCase() ?? "CHOOSE"} · ENTER TO LOCK`
          : `${player === 1 && this.opponent === "cpu" ? `CPU ${cpuDifficultyLabel(this.cpuDifficulty)}` : `PLAYER ${player + 1}`} · ${highlighted?.name.toUpperCase() ?? "CHOOSE"} · ENTER TO LOCK`,
      );
      this.controlsText.setText("ARROWS SELECT · ENTER CONFIRM · ESC CANCEL / BACK");
    }
  }

  private renderConfirmedMatchup(): void {
    const fighters = this.selection.confirmedMatchup();
    if (!fighters) return;
    const first = getFighterDefinition(fighters[0]);
    const second = getFighterDefinition(fighters[1]);
    const firstPresentation = getFighterPresentation(fighters[0]);
    const secondPresentation = getFighterPresentation(fighters[1]);
    this.p1Summary
      .setText(
        `P1  ${first.name.toUpperCase()}\n${first.fightingStyle}\nSUPER  ${first.moves.super.label}`,
      )
      .setColor(`#${firstPresentation.primary.toString(16).padStart(6, "0")}`);
    this.p2Summary
      .setText(
        `${this.opponent === "cpu" ? `CPU ${cpuDifficultyLabel(this.cpuDifficulty)}` : "P2"}  ${second.name.toUpperCase()}\n${second.fightingStyle}\nSUPER  ${second.moves.super.label}`,
      )
      .setColor(`#${secondPresentation.primary.toString(16).padStart(6, "0")}`);
    this.matchupPanel.setVisible(true);
  }

  private createFighterPortrait(presentation: FighterPresentation): Phaser.GameObjects.Graphics {
    const portrait = this.add.graphics();
    drawFighterPortrait(portrait, presentation);
    return portrait;
  }
}
