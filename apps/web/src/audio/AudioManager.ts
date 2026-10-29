import type { CombatEvent, MatchPhase } from "@neon-rivals/simulation";
import { loadSettings } from "../settings/GameSettings";

// Original procedural audio only. No third-party samples or game soundtrack assets are used.
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private lastEventSerial = 0;
  private nextBeatMs = 0;
  private beat = 0;

  public bindUnlock(element: HTMLElement): void {
    const unlock = (): void => {
      this.unlock();
      element.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    element.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  public unlock(): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.master.gain.value = 0.7;
      const settings = loadSettings();
      this.music.gain.value = settings.musicVolume * 0.34;
      this.effects.gain.value = settings.effectsVolume * 0.9;
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") void this.context.resume();
    const settings = loadSettings();
    if (this.music) this.music.gain.value = settings.musicVolume * 0.34;
    if (this.effects) this.effects.gain.value = settings.effectsVolume * 0.9;
  }

  public update(nowMs: number, phase: MatchPhase, event: CombatEvent | null): void {
    if (event && event.serial > this.lastEventSerial) {
      this.lastEventSerial = event.serial;
      this.playCombatEvent(event);
    }

    if (!this.context || phase === "matchOver" || nowMs < this.nextBeatMs) return;
    this.playMusicBeat(phase === "fight");
    this.nextBeatMs = nowMs + 150;
  }

  public resetEventCursor(): void {
    this.lastEventSerial = 0;
  }

  private playCombatEvent(event: CombatEvent): void {
    switch (event.type) {
      case "attack":
        this.tone(180, 0.07, "sawtooth", 0.12, 0.45);
        break;
      case "special":
        this.tone(145, 0.2, "sawtooth", 0.16, 2.8);
        this.tone(390, 0.12, "triangle", 0.09, 1.5, 0.04);
        break;
      case "super":
        this.tone(82, 0.38, "sawtooth", 0.2, 5.1);
        this.tone(620, 0.24, "square", 0.1, 0.5, 0.08);
        break;
      case "hit":
        this.noise(0.095, 0.2);
        this.tone(92, 0.11, "square", 0.16, 0.45);
        break;
      case "block":
        this.noise(0.055, 0.09);
        this.tone(510, 0.09, "square", 0.12, 0.68);
        break;
      case "parry":
        this.tone(920, 0.13, "sine", 0.17, 1.65);
        this.tone(1320, 0.08, "triangle", 0.08, 0.9, 0.025);
        break;
      case "ko":
        this.noise(0.28, 0.18);
        this.tone(125, 0.55, "sawtooth", 0.2, 0.2);
        break;
    }
  }

  private playMusicBeat(fighting: boolean): void {
    const roots = [55, 55, 65.41, 49, 55, 73.42, 65.41, 49];
    const root = roots[this.beat % roots.length] ?? 55;
    const accent = this.beat % 4 === 0;
    this.tone(root, 0.12, "triangle", fighting ? 0.15 : 0.08, 0.76, 0, this.music);
    if (this.beat % 2 === 0) {
      this.tone(root * 4, 0.035, "square", fighting ? 0.055 : 0.025, 0.82, 0, this.music);
    }
    if (accent) this.noise(0.025, fighting ? 0.035 : 0.018, this.music);
    this.beat += 1;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slide: number,
    delay = 0,
    destination: AudioNode | null = this.effects,
  ): void {
    if (!this.context || !destination) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(24, frequency * slide),
      start + duration,
    );
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private noise(
    duration: number,
    volume: number,
    destination: AudioNode | null = this.effects,
  ): void {
    if (!this.context || !destination) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = (this.lastEventSerial + this.beat + 1) * 0x9e3779b1;
    for (let index = 0; index < length; index += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      channel[index] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.connect(gain).connect(destination);
    source.start();
  }
}
