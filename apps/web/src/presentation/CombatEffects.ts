import { toPixels, type CombatEvent, type GameState } from "@neon-rivals/simulation";
import type Phaser from "phaser";

interface EffectInstance {
  readonly serial: number;
  readonly type: CombatEvent["type"];
  readonly startFrame: number;
  readonly x: number;
  readonly y: number;
  readonly facing: -1 | 1;
  readonly color: number;
}

export class CombatEffects {
  private readonly effects: EffectInstance[] = [];
  private lastSerial = 0;
  private pendingShake = 0;

  public sync(state: GameState, colors: readonly [number, number] = [0x37e6ff, 0xff4aa2]): void {
    const event = state.lastEvent;
    if (!event || event.serial <= this.lastSerial) return;
    this.lastSerial = event.serial;

    const source = state.fighters[event.source];
    const target = state.fighters[event.target];
    const anchor =
      event.type === "attack" || event.type === "special" || event.type === "super"
        ? source
        : target;
    this.effects.push({
      serial: event.serial,
      type: event.type,
      startFrame: state.frame,
      x: toPixels(anchor.x),
      y: toPixels(anchor.y) - (event.type === "ko" ? 65 : 102),
      facing: source.facing,
      color: colors[event.source],
    });
    if (this.effects.length > 48) this.effects.splice(0, this.effects.length - 48);

    this.pendingShake = Math.max(
      this.pendingShake,
      event.type === "super" ? 10 : event.type === "ko" ? 13 : event.type === "hit" ? 6 : 0,
    );
  }

  public draw(
    graphics: Phaser.GameObjects.Graphics,
    currentFrame: number,
    reducedFlash = false,
  ): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      if (!effect) continue;
      const age = currentFrame - effect.startFrame;
      const lifetime = effect.type === "super" ? 34 : effect.type === "ko" ? 28 : 16;
      if (age > lifetime) {
        this.effects.splice(index, 1);
        continue;
      }
      this.drawEffect(graphics, effect, age, lifetime, reducedFlash);
    }
  }

  public consumeShake(): number {
    const shake = this.pendingShake;
    this.pendingShake = 0;
    return shake;
  }

  public reset(): void {
    this.effects.length = 0;
    this.lastSerial = 0;
    this.pendingShake = 0;
  }

  private drawEffect(
    graphics: Phaser.GameObjects.Graphics,
    effect: EffectInstance,
    age: number,
    lifetime: number,
    reducedFlash: boolean,
  ): void {
    const fade = Math.max(0, 1 - age / lifetime);
    if (effect.type === "attack") {
      graphics.lineStyle(5, effect.color, fade * 0.65);
      graphics.beginPath();
      graphics.arc(
        effect.x,
        effect.y,
        58 + age * 4,
        effect.facing === 1 ? -0.8 : Math.PI - 0.8,
        effect.facing === 1 ? 0.55 : Math.PI + 0.55,
      );
      graphics.strokePath();
      return;
    }

    if (effect.type === "special" || effect.type === "super") {
      const count = effect.type === "super" ? 4 : 2;
      for (let ring = 0; ring < count; ring += 1) {
        graphics.lineStyle(
          effect.type === "super" ? 10 - ring * 2 : 6,
          ring % 2 === 0 ? effect.color : 0xffffff,
          fade * (0.65 - ring * 0.1),
        );
        graphics.strokeCircle(effect.x, effect.y, 35 + age * (5 + ring) + ring * 18);
      }
      if (effect.type === "super" && !reducedFlash) {
        graphics.fillStyle(effect.color, fade * 0.08);
        graphics.fillRect(0, 0, 1280, 720);
      }
      return;
    }

    if (effect.type === "parry") {
      graphics.lineStyle(Math.max(2, 10 - age * 0.5), 0xffffff, fade);
      graphics.strokeCircle(effect.x, effect.y, 20 + age * 9);
      graphics.lineStyle(3, effect.color, fade);
      graphics.strokeCircle(effect.x, effect.y, 40 + age * 5);
      return;
    }

    if (effect.type === "block") {
      graphics.lineStyle(6, 0x9ff7ff, fade);
      graphics.beginPath();
      graphics.moveTo(effect.x - 34, effect.y - 45);
      graphics.lineTo(effect.x + 27, effect.y - 24);
      graphics.lineTo(effect.x + 37, effect.y + 30);
      graphics.lineTo(effect.x - 22, effect.y + 47);
      graphics.closePath();
      graphics.strokePath();
      return;
    }

    const rays = effect.type === "ko" ? 18 : 10;
    const radius = 18 + age * (effect.type === "ko" ? 12 : 7);
    for (let ray = 0; ray < rays; ray += 1) {
      const angle = (ray / rays) * Math.PI * 2 + effect.serial * 0.37;
      const inner = radius * 0.35;
      graphics.lineStyle(
        effect.type === "ko" ? 7 : 4,
        ray % 3 === 0 ? 0xffffff : effect.color,
        fade,
      );
      graphics.lineBetween(
        effect.x + Math.cos(angle) * inner,
        effect.y + Math.sin(angle) * inner,
        effect.x + Math.cos(angle) * radius,
        effect.y + Math.sin(angle) * radius,
      );
    }
  }
}
