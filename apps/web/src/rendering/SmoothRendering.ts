import Phaser from "phaser";

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

// Keep Phaser's world, pointer hit areas, and canvas in one coordinate system. Text uses a
// separate high-DPI backing texture, improving clarity without offsetting mouse/touch input.
export const TEXT_RESOLUTION = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));

let smoothTextFactoryEnabled = false;

/** Make every Phaser canvas-text texture high-DPI unless a caller explicitly overrides it. */
export function enableSmoothTextRendering(): void {
  if (smoothTextFactoryEnabled) return;
  smoothTextFactoryEnabled = true;

  const prototype = Phaser.GameObjects.GameObjectFactory.prototype;
  const originalTextFactory = prototype.text;
  prototype.text = function smoothTextFactory(
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    return originalTextFactory.call(this, x, y, text, {
      ...style,
      resolution: style.resolution ?? TEXT_RESOLUTION,
    });
  };
}

/** Apply consistent subpixel camera settings without changing input-space coordinates. */
export function configureSmoothCamera(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  camera.setViewport(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  camera.setZoom(1);
  camera.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
  camera.roundPixels = false;
}
