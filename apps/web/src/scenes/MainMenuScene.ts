import Phaser from "phaser";
import { MenuGunner } from "../presentation/MenuGunner";
import { configureSmoothCamera } from "../rendering/SmoothRendering";
import { ArcadeMenu, drawArcadeBackdrop } from "../ui/ArcadeUi";

const MENU_X = 706;
const MENU_Y = 178;
const MENU_SPACING = 64;
const EXIT_INDEX = 6;

export class MainMenuScene extends Phaser.Scene {
  private menu!: ArcadeMenu;
  private gunner!: MenuGunner;

  public constructor() {
    super("main-menu");
  }

  public create(): void {
    configureSmoothCamera(this);
    drawArcadeBackdrop(this, "A new challenger enters the circuit");

    this.gunner = new MenuGunner(this, {
      menuX: MENU_X,
      menuY: MENU_Y,
      itemSpacing: MENU_SPACING,
      itemHeight: 56,
      exitIndex: EXIT_INDEX,
    });

    this.add
      .text(718, 147, "INSERT COURAGE", {
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
          detail: "2P / CPU",
          onSelect: () => this.scene.start("opponent-select", { mode: "local" }),
        },
        {
          label: "Online Play",
          detail: "PRIVATE LOBBY",
          onSelect: () => this.scene.start("online-lobby"),
        },
        {
          label: "Training",
          detail: "2P / CPU LAB",
          onSelect: () => this.scene.start("opponent-select", { mode: "training" }),
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
        {
          label: "Exit Game",
          detail: "END SESSION",
          onSelect: () => this.scene.start("exit-screen"),
        },
      ],
      MENU_X,
      MENU_Y,
      494,
      { onSelectionChange: (index) => this.gunner.aimAt(index) },
    );

    this.add
      .text(74, 662, "ARROWS / HOVER TO AIM · ENTER TO CONFIRM", {
        color: "#7d8ba3",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(3);
    this.add
      .text(1205, 662, "BUILD 0.2 · NEON CIRCUIT", {
        align: "right",
        color: "#7d8ba3",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(1, 0)
      .setDepth(3);
  }

  public override update(_time: number, delta: number): void {
    this.menu.update();
    this.gunner.update(delta);
  }
}
