import Phaser from "phaser";
import type { MatchSetup } from "../game/GameFlow";
import { pauseDestination, shouldPauseSimulation } from "../game/PausePolicy";
import type { OnlineFightClient } from "../net/OnlineFightClient";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import {
  loadSettings,
  nextStageArt,
  saveSettings,
  stageArtLabel,
  type GameSettings,
  type StageArt,
} from "../settings/GameSettings";
import { ArcadeMenu, type MenuItem } from "../ui/ArcadeUi";
import type { FightScene } from "./FightScene";

export interface PauseSceneData extends MatchSetup {
  readonly onlineClient?: OnlineFightClient;
  readonly fightTheme?: StageArt;
}

export class PauseScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private pauseData!: PauseSceneData;
  private settings!: GameSettings;
  private escapeKey!: Phaser.Input.Keyboard.Key;
  private acceptsInputAt = 0;
  private exiting = false;

  public constructor() {
    super("pause-menu");
  }

  public init(data: PauseSceneData): void {
    this.pauseData = data;
    this.settings = loadSettings();
    if (data.fightTheme) this.settings.stageArt = data.fightTheme;
    this.exiting = false;
  }

  public create(): void {
    configureSmoothCamera(this);
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable.");
    this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.acceptsInputAt = this.time.now + 180;

    const overlay = this.add.graphics().setDepth(0);
    overlay.fillStyle(0x02040b, 0.88);
    overlay.fillRect(0, 0, 1280, 720);
    overlay.fillGradientStyle(0x071727, 0x071727, 0x1b0b28, 0x1b0b28, 0.74);
    overlay.fillRoundedRect(294, 52, 692, 616, 20);
    overlay.lineStyle(3, 0x51e9ff, 0.72);
    overlay.strokeRoundedRect(294, 52, 692, 616, 20);
    overlay.lineStyle(1, 0xff4aa2, 0.54);
    overlay.strokeRoundedRect(305, 63, 670, 594, 16);

    this.add
      .text(640, 92, shouldPauseSimulation(this.pauseData.mode) ? "FIGHT PAUSED" : "FIGHT MENU", {
        align: "center",
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "45px",
        fontStyle: "italic",
        stroke: "#03050c",
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(
        640,
        139,
        shouldPauseSimulation(this.pauseData.mode)
          ? "SIMULATION STOPPED · ESC RESUMES"
          : "ONLINE MATCH CONTINUES · LOCAL INPUT IS NEUTRAL",
        {
          align: "center",
          color: this.pauseData.mode === "online" ? "#ffcf54" : "#67f28a",
          fontFamily: "monospace",
          fontSize: "12px",
          letterSpacing: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    this.menu = new ArcadeMenu(this, this.createMenuItems(), 390, 165, 500);

    this.add
      .text(
        640,
        635,
        "CONTROLS  P1: WASD + F/G/H   ·   P2: ARROWS + J/K/L\nF / J GUARD   ·   GUARD + DOWN BLOCKS LOW   ·   TAP TOWARD / DOWN TO PARRY",
        {
          align: "center",
          color: "#91a1b8",
          fontFamily: "monospace",
          fontSize: "11px",
          lineSpacing: 7,
        },
      )
      .setOrigin(0.5)
      .setDepth(2);
  }

  public override update(): void {
    if (this.time.now < this.acceptsInputAt || this.exiting) return;
    this.menu.update();
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) this.resumeFight();
  }

  private createMenuItems(): MenuItem[] {
    const percent = (value: number): string => `${Math.round(value * 100)}%`;
    return [
      {
        label: "Resume Fight",
        detail: "ESC",
        onSelect: () => this.resumeFight(),
      },
      {
        label: "Music Volume",
        detail: percent(this.settings.musicVolume),
        onSelect: () => {
          this.settings.musicVolume = this.nextVolume(this.settings.musicVolume);
          this.commitAndRefresh();
        },
      },
      {
        label: "Effects Volume",
        detail: percent(this.settings.effectsVolume),
        onSelect: () => {
          this.settings.effectsVolume = this.nextVolume(this.settings.effectsVolume);
          this.commitAndRefresh();
        },
      },
      {
        label: "Screen Shake",
        detail: this.settings.screenShake ? "ON" : "OFF",
        onSelect: () => {
          this.settings.screenShake = !this.settings.screenShake;
          this.commitAndRefresh();
        },
      },
      {
        label: "Reduced Flash",
        detail: this.settings.reducedFlash ? "ON" : "OFF",
        onSelect: () => {
          this.settings.reducedFlash = !this.settings.reducedFlash;
          this.commitAndRefresh();
        },
      },
      {
        label: "Fight Theme",
        detail: stageArtLabel(this.settings.stageArt),
        onSelect: () => {
          this.settings.stageArt = nextStageArt(this.settings.stageArt);
          this.commitAndRefresh();
        },
      },
      {
        label: "Exit Fight",
        detail: this.pauseData.mode === "online" ? "ONLINE LOBBY" : "MAIN MENU",
        onSelect: () => void this.exitFight(),
      },
    ];
  }

  private resumeFight(): void {
    if (this.exiting) return;
    const fight = this.scene.get("fight") as FightScene;
    fight.resumeFromPauseMenu();
    this.scene.stop();
  }

  private commitAndRefresh(): void {
    saveSettings(this.settings);
    const fight = this.scene.get("fight") as FightScene;
    fight.refreshFightSettings();
    this.scene.restart(this.pauseData);
  }

  private async exitFight(): Promise<void> {
    if (this.exiting) return;
    this.exiting = true;
    if (this.pauseData.mode === "online") await this.pauseData.onlineClient?.leave();
    this.scene.stop("fight");
    this.scene.start(pauseDestination(this.pauseData.mode));
  }

  private nextVolume(value: number): number {
    return value >= 1 ? 0 : Math.round((value + 0.25) * 100) / 100;
  }
}
