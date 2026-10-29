import Phaser from "phaser";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { loadSettings, saveSettings, type GameSettings } from "../settings/GameSettings";
import { ArcadeMenu, drawArcadeBackdrop, type MenuItem } from "../ui/ArcadeUi";

export class SettingsScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private settings!: GameSettings;

  public constructor() {
    super("settings");
  }

  public create(): void {
    configureSmoothCamera(this);
    this.settings = loadSettings();
    drawArcadeBackdrop(this, "Cabinet configuration");
    this.add
      .text(640, 170, "SETTINGS", {
        color: "#ffffff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "46px",
        fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.rebuildMenu();
  }

  public override update(): void {
    this.menu.update();
  }

  private rebuildMenu(): void {
    this.children.list
      .filter((child) => child.name === "settings-menu")
      .forEach((child) => child.destroy());

    const percent = (value: number): string => `${Math.round(value * 100)}%`;
    const items: MenuItem[] = [
      {
        label: "Music Volume",
        detail: percent(this.settings.musicVolume),
        onSelect: () => {
          this.settings.musicVolume = this.nextVolume(this.settings.musicVolume);
          this.commit();
        },
      },
      {
        label: "Effects Volume",
        detail: percent(this.settings.effectsVolume),
        onSelect: () => {
          this.settings.effectsVolume = this.nextVolume(this.settings.effectsVolume);
          this.commit();
        },
      },
      {
        label: "Screen Shake",
        detail: this.settings.screenShake ? "ON" : "OFF",
        onSelect: () => {
          this.settings.screenShake = !this.settings.screenShake;
          this.commit();
        },
      },
      {
        label: "Reduced Flash",
        detail: this.settings.reducedFlash ? "ON" : "OFF",
        onSelect: () => {
          this.settings.reducedFlash = !this.settings.reducedFlash;
          this.commit();
        },
      },
      { label: "Back", detail: "SAVE & RETURN", onSelect: () => this.scene.start("main-menu") },
    ];
    this.menu = new ArcadeMenu(this, items, 390, 245, 500);
  }

  private commit(): void {
    saveSettings(this.settings);
    this.scene.restart();
  }

  private nextVolume(value: number): number {
    return value >= 1 ? 0 : Math.round((value + 0.25) * 100) / 100;
  }
}
