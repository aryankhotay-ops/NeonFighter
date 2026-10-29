import Phaser from "phaser";

export interface MenuItem {
  readonly label: string;
  readonly detail?: string;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}

export interface ArcadeMenuOptions {
  readonly parent?: Phaser.GameObjects.Container;
  readonly onSelectionChange?: (index: number) => void;
}

export function drawArcadeBackdrop(scene: Phaser.Scene, subtitle: string): void {
  const graphics = scene.add.graphics().setDepth(0);
  graphics.fillGradientStyle(0x030611, 0x030611, 0x1b0b2b, 0x1b0b2b, 1);
  graphics.fillRect(0, 0, 1280, 720);

  graphics.lineStyle(1, 0x36e6ff, 0.13);
  for (let x = -360; x <= 1640; x += 70) graphics.lineBetween(640, 408, x, 720);
  for (let y = 420; y <= 720; y += 34) graphics.lineBetween(0, y, 1280, y);

  graphics.fillStyle(0x081126, 1);
  for (let index = 0; index < 18; index += 1) {
    const height = 70 + ((index * 61) % 235);
    graphics.fillRect(index * 76 - 12, 415 - height, 52 + ((index * 19) % 39), height);
    graphics.fillStyle(index % 3 === 0 ? 0x35e7ff : 0xff3f9f, 0.18);
    graphics.fillRect(index * 76 + 2, 430 - height, 8, 13);
    graphics.fillStyle(0x081126, 1);
  }

  graphics.fillStyle(0xff3f9f, 0.13);
  graphics.fillCircle(1025, 150, 118);
  graphics.lineStyle(4, 0xff5eb2, 0.55);
  graphics.strokeCircle(1025, 150, 78);

  scene.add
    .text(68, 46, "NEON", {
      color: "#f7f9ff",
      fontFamily: "Arial Black, sans-serif",
      fontSize: "74px",
      fontStyle: "italic",
      stroke: "#07101f",
      strokeThickness: 10,
    })
    .setDepth(1);
  scene.add
    .text(284, 46, "RIVALS", {
      color: "#ff48a4",
      fontFamily: "Arial Black, sans-serif",
      fontSize: "74px",
      fontStyle: "italic",
      stroke: "#07101f",
      strokeThickness: 10,
    })
    .setDepth(1);
  scene.add
    .text(76, 132, subtitle.toUpperCase(), {
      color: "#51e9ff",
      fontFamily: "monospace",
      fontSize: "13px",
      letterSpacing: 4,
    })
    .setDepth(1);

  // A clean edge treatment keeps the arcade mood without a pixelating scanline overlay.
  const frame = scene.add.graphics().setDepth(20);
  frame.lineStyle(2, 0x6ceaff, 0.16);
  frame.strokeRoundedRect(12, 12, 1256, 696, 12);
  frame.lineStyle(1, 0xff5db0, 0.12);
  frame.strokeRoundedRect(18, 18, 1244, 684, 10);
  frame.setScrollFactor(0);
}

export class ArcadeMenu {
  private readonly scene: Phaser.Scene;
  private readonly entries: Phaser.GameObjects.Container[] = [];
  private readonly items: readonly MenuItem[];
  private readonly baseX: number;
  private readonly onSelectionChange: ((index: number) => void) | undefined;
  private selected = 0;
  private keyUp: Phaser.Input.Keyboard.Key;
  private keyDown: Phaser.Input.Keyboard.Key;
  private keyConfirm: Phaser.Input.Keyboard.Key;
  private keySpace: Phaser.Input.Keyboard.Key;

  public constructor(
    scene: Phaser.Scene,
    items: readonly MenuItem[],
    x: number,
    y: number,
    width = 480,
    options: ArcadeMenuOptions = {},
  ) {
    this.scene = scene;
    this.items = items;
    this.baseX = x;
    this.onSelectionChange = options.onSelectionChange;
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input is unavailable.");
    this.keyUp = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyConfirm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    items.forEach((item, index) => {
      const background = scene.add.rectangle(0, 0, width, 56, 0x07101f, 0.9).setOrigin(0);
      background.setStrokeStyle(2, 0x344561, 0.9);
      const label = scene.add.text(22, 9, item.label.toUpperCase(), {
        color: item.disabled ? "#586276" : "#f6f8ff",
        fontFamily: "Arial Black, sans-serif",
        fontSize: "20px",
        fontStyle: "italic",
      });
      const detail = scene.add.text(width - 18, 20, item.detail ?? "", {
        align: "right",
        color: "#8997ae",
        fontFamily: "monospace",
        fontSize: "11px",
      });
      detail.setOrigin(1, 0);
      const container = scene.add
        .container(x, y + index * 64, [background, label, detail])
        .setDepth(3);
      options.parent?.add(container);
      container.setSize(width, 56).setInteractive({ useHandCursor: !item.disabled });
      container.on("pointerover", () => this.select(index));
      container.on("pointerdown", () => this.activate(index));
      this.entries.push(container);
    });
    this.selected = this.firstEnabled(0, 1);
    this.renderSelection();
    this.onSelectionChange?.(this.selected);
  }

  public update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyUp))
      this.select(this.firstEnabled(this.selected - 1, -1));
    if (Phaser.Input.Keyboard.JustDown(this.keyDown))
      this.select(this.firstEnabled(this.selected + 1, 1));
    if (
      Phaser.Input.Keyboard.JustDown(this.keyConfirm) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace)
    ) {
      this.activate(this.selected);
    }
  }

  private select(index: number): void {
    if (this.items[index]?.disabled) return;
    this.selected = index;
    this.renderSelection();
    this.onSelectionChange?.(this.selected);
  }

  private activate(index: number): void {
    const item = this.items[index];
    if (!item || item.disabled) return;
    this.scene.cameras.main.flash(70, 50, 230, 255, false);
    this.scene.time.delayedCall(75, item.onSelect);
  }

  private firstEnabled(index: number, direction: -1 | 1): number {
    let candidate = index;
    for (let count = 0; count < this.items.length; count += 1) {
      if (candidate < 0) candidate = this.items.length - 1;
      if (candidate >= this.items.length) candidate = 0;
      if (!this.items[candidate]?.disabled) return candidate;
      candidate += direction;
    }
    return 0;
  }

  private renderSelection(): void {
    this.entries.forEach((container, index) => {
      const background = container.getAt(0) as Phaser.GameObjects.Rectangle;
      const label = container.getAt(1) as Phaser.GameObjects.Text;
      const selected = index === this.selected;
      background.setFillStyle(selected ? 0x173652 : 0x07101f, selected ? 0.96 : 0.9);
      background.setStrokeStyle(2, selected ? 0x4ceaff : 0x344561, selected ? 1 : 0.9);
      if (!this.items[index]?.disabled) label.setColor(selected ? "#ffe45c" : "#f6f8ff");
      container.x = this.baseX + (selected ? 8 : 0);
    });
  }
}
