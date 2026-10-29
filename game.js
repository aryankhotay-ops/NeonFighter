"use strict";

// NEON RIVALS
// Original browser fighting game. All visuals are drawn at runtime; all audio is synthesized.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const FLOOR = 590;
const STEP_MS = 1000 / 60;
const GRAVITY = 1.12;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const choose = (items) => items[Math.floor(Math.random() * items.length)];

const FIGHTERS = [
  {
    id: "vesper",
    name: "VESPER",
    epithet: "RUSHDOWN COURIER",
    color: "#36e4ff",
    dark: "#103b55",
    accent: "#f2fdff",
    skin: "#b86f58",
    speed: 8.0,
    jump: 21.5,
    power: 0.92,
    defense: 0.96,
    reach: 0.96,
    build: 0.92,
    style: "scarf"
  },
  {
    id: "rook",
    name: "ROOK",
    epithet: "IRON DISTRICT ENFORCER",
    color: "#ffca3a",
    dark: "#5b3418",
    accent: "#ff5d3d",
    skin: "#6f3f2f",
    speed: 5.6,
    jump: 18.2,
    power: 1.22,
    defense: 1.13,
    reach: 1.08,
    build: 1.2,
    style: "armor"
  },
  {
    id: "nova",
    name: "NOVA",
    epithet: "SKYLINE KICKBOXER",
    color: "#ff4aa2",
    dark: "#531c4a",
    accent: "#ffd7ed",
    skin: "#8c503c",
    speed: 7.2,
    jump: 22.4,
    power: 1.0,
    defense: 0.98,
    reach: 1.08,
    build: 0.98,
    style: "mohawk"
  },
  {
    id: "sable",
    name: "SABLE",
    epithet: "ZERO-POINT STRIKER",
    color: "#a77bff",
    dark: "#27244f",
    accent: "#70ffb7",
    skin: "#d09a77",
    speed: 6.6,
    jump: 20.2,
    power: 1.08,
    defense: 1.04,
    reach: 1.02,
    build: 1.04,
    style: "coat"
  }
];

const ATTACKS = {
  light: { duration: 280, activeStart: 75, activeEnd: 145, damage: 7, range: 78, height: 74, knockback: 6.5, hitstun: 190, meter: 9 },
  heavy: { duration: 520, activeStart: 185, activeEnd: 300, damage: 14, range: 118, height: 94, knockback: 11, hitstun: 300, meter: 15 },
  projectile: { duration: 570, activeStart: 235, activeEnd: 270, damage: 11, range: 0, height: 0, knockback: 8.5, hitstun: 240, meter: 0 },
  super: { duration: 980, activeStart: 390, activeEnd: 575, damage: 31, range: 205, height: 128, knockback: 18, hitstun: 620, meter: 0 }
};

class InputManager {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.bind();
  }

  bind() {
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
      if (!this.down.has(key)) this.pressed.add(key);
      this.down.add(key);
      audio.unlock();

      if (key === "escape") game.togglePause();
      if (key === "enter") {
        if (game.state === "title") game.beginSelection("arcade");
        else if (game.state === "matchOver") game.returnToSelection();
      }
      if (key === "r" && game.state === "matchOver") game.rematch();
    });

    window.addEventListener("keyup", (event) => this.down.delete(event.key.toLowerCase()));
    window.addEventListener("blur", () => this.down.clear());
  }

  isDown(key) { return this.down.has(key); }
  wasPressed(key) { return this.pressed.has(key); }
  endFrame() { this.pressed.clear(); }
}

class AudioSystem {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.musicStep = 0;
    this.nextBeat = 0;
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(frequency, duration = 0.08, type = "square", volume = 0.035, slide = 1) {
    if (!this.enabled) return;
    this.unlock();
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  noise(duration = 0.08, volume = 0.045) {
    if (!this.enabled) return;
    this.unlock();
    const frames = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(this.context.destination);
    source.start();
  }

  ui() { this.tone(620, 0.055, "square", 0.028, 1.35); }
  swing(heavy = false) { this.tone(heavy ? 130 : 240, heavy ? 0.15 : 0.08, "sawtooth", 0.035, 0.45); }
  hit(heavy = false) { this.noise(heavy ? 0.15 : 0.08, heavy ? 0.075 : 0.05); this.tone(heavy ? 75 : 115, 0.11, "square", 0.05, 0.55); }
  block() { this.tone(430, 0.09, "square", 0.038, 0.7); }
  special() { this.tone(180, 0.34, "sawtooth", 0.05, 4.2); }
  announce() { this.tone(220, 0.12, "square", 0.04, 2); setTimeout(() => this.tone(440, 0.14, "square", 0.04, 1.5), 100); }
  knockout() { this.tone(150, 0.5, "sawtooth", 0.06, 0.25); this.noise(0.28, 0.055); }

  updateMusic(now, active) {
    if (!this.enabled || !this.context || !active) return;
    if (now < this.nextBeat) return;
    const bass = [55, 55, 65.4, 49, 55, 73.4, 65.4, 49][this.musicStep % 8];
    this.tone(bass, 0.11, "triangle", 0.018, 0.72);
    if (this.musicStep % 2 === 0) this.tone(880, 0.025, "square", 0.009, 0.85);
    this.musicStep += 1;
    this.nextBeat = now + 235;
  }
}

class Particle {
  constructor(x, y, color, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = options.vx ?? (Math.random() - 0.5) * 12;
    this.vy = options.vy ?? (Math.random() - 0.7) * 11;
    this.life = options.life ?? 420;
    this.maxLife = this.life;
    this.size = options.size ?? 6 + Math.random() * 8;
    this.color = color;
    this.gravity = options.gravity ?? 0.32;
    this.square = options.square ?? true;
  }

  update(dt) {
    const step = dt / STEP_MS;
    this.life -= dt;
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.vy += this.gravity * step;
  }

  draw(context) {
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = this.color;
    context.shadowColor = this.color;
    context.shadowBlur = 10;
    if (this.square) context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    else { context.beginPath(); context.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); context.fill(); }
    context.restore();
  }
}

class Projectile {
  constructor(owner) {
    this.owner = owner;
    this.x = owner.x + owner.facing * 68;
    this.y = owner.y - 102;
    this.vx = owner.facing * (10.5 + owner.profile.speed * 0.3);
    this.radius = 26;
    this.life = 1550;
    this.dead = false;
    this.pulse = 0;
  }

  update(dt, target, gameRef) {
    const step = dt / STEP_MS;
    this.life -= dt;
    this.pulse += dt;
    this.x += this.vx * step;
    const box = { x: this.x - 22, y: this.y - 22, w: 44, h: 44 };
    if (overlaps(box, target.getHurtbox())) {
      target.receiveHit(this.owner, { ...ATTACKS.projectile, damage: ATTACKS.projectile.damage * this.owner.profile.power }, gameRef, this.x, this.y);
      this.dead = true;
    }
    if (this.life <= 0 || this.x < -50 || this.x > W + 50) this.dead = true;
    if (Math.random() < 0.48) gameRef.particles.push(new Particle(this.x, this.y, this.owner.profile.color, { vx: -this.vx * 0.2 + (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 180, size: 4, gravity: 0 }));
  }

  draw(context) {
    const pulse = 1 + Math.sin(this.pulse * 0.025) * 0.15;
    context.save();
    context.translate(this.x, this.y);
    context.scale(pulse, pulse);
    context.globalCompositeOperation = "lighter";
    const gradient = context.createRadialGradient(0, 0, 2, 0, 0, 36);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.25, this.owner.profile.accent);
    gradient.addColorStop(0.62, this.owner.profile.color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.beginPath(); context.arc(0, 0, 38, 0, Math.PI * 2); context.fill();
    context.strokeStyle = this.owner.profile.accent;
    context.lineWidth = 3;
    context.rotate(this.pulse * 0.005);
    context.strokeRect(-20, -20, 40, 40);
    context.restore();
  }
}

class Fighter {
  constructor(profile, x, facing, controller, index) {
    this.profile = profile;
    this.x = x;
    this.y = FLOOR;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.controller = controller;
    this.index = index;
    this.width = 66 * profile.build;
    this.height = 168 * Math.sqrt(profile.build);
    this.health = 100;
    this.displayHealth = 100;
    this.meter = 0;
    this.state = "idle";
    this.attack = null;
    this.hitTimer = 0;
    this.grounded = true;
    this.crouching = false;
    this.blocking = false;
    this.currentInput = {};
    this.animTime = Math.random() * 500;
    this.combo = 0;
    this.comboTimer = 0;
    this.flash = 0;
  }

  getHurtbox() {
    const crouch = this.crouching ? 38 : 0;
    return {
      x: this.x - this.width * 0.42,
      y: this.y - this.height + 12 + crouch,
      w: this.width * 0.84,
      h: this.height - 18 - crouch
    };
  }

  canAct() { return this.hitTimer <= 0 && this.state !== "attack"; }

  startAttack(type, gameRef) {
    if (!this.canAct() || !this.grounded) return;
    let attackType = type;
    if (type === "special") {
      if (this.meter >= 100) {
        attackType = "super";
        this.meter = 0;
        gameRef.superFlash = 330;
        gameRef.screenShake = 14;
        audio.special();
      } else if (this.meter >= 25) {
        attackType = "projectile";
        this.meter -= 25;
        audio.special();
      } else {
        audio.tone(90, 0.06, "square", 0.018, 0.7);
        return;
      }
    } else {
      audio.swing(type === "heavy");
    }
    this.state = "attack";
    this.attack = { type: attackType, elapsed: 0, resolved: false, spawned: false };
    this.vx *= 0.3;
  }

  wantsToBlock(attacker) {
    if (!this.grounded || this.state === "attack" || this.hitTimer > 0) return false;
    const attackerOnRight = attacker.x > this.x;
    return attackerOnRight ? this.currentInput.left : this.currentInput.right;
  }

  receiveHit(attacker, attackDef, gameRef, hitX, hitY) {
    const blocked = this.wantsToBlock(attacker);
    const damage = attackDef.damage / this.profile.defense;
    if (blocked) {
      const chip = Math.max(1, damage * 0.16);
      this.health = Math.max(0, this.health - chip);
      this.meter = clamp(this.meter + 4, 0, 100);
      this.state = "block";
      this.blocking = true;
      this.hitTimer = 125;
      this.vx = attacker.facing * attackDef.knockback * 0.36;
      gameRef.hitStop = 42;
      gameRef.spawnImpact(hitX, hitY, "#8ff7ff", 9);
      audio.block();
      return;
    }

    const wasInHitstun = this.hitTimer > 0;
    this.health = Math.max(0, this.health - damage);
    this.meter = clamp(this.meter + damage * 0.75, 0, 100);
    this.state = "hit";
    this.attack = null;
    this.hitTimer = attackDef.hitstun;
    this.vx = attacker.facing * attackDef.knockback;
    if (attackDef === ATTACKS.super || attackDef.damage > 24) this.vy = -5;
    this.flash = 95;
    attacker.meter = clamp(attacker.meter + attackDef.meter, 0, 100);
    attacker.combo = wasInHitstun ? attacker.combo + 1 : 1;
    attacker.comboTimer = 950;
    gameRef.hitStop = attackDef.damage > 20 ? 145 : attackDef.damage > 10 ? 85 : 52;
    gameRef.screenShake = attackDef.damage > 20 ? 18 : attackDef.damage > 10 ? 10 : 5;
    gameRef.spawnImpact(hitX, hitY, attacker.profile.color, attackDef.damage > 20 ? 30 : 15);
    audio.hit(attackDef.damage > 10);
  }

  update(dt, input, opponent, gameRef) {
    const step = dt / STEP_MS;
    this.currentInput = input;
    this.animTime += dt;
    this.displayHealth = lerp(this.displayHealth, this.health, Math.min(1, dt * 0.007));
    this.flash = Math.max(0, this.flash - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    this.blocking = false;

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.state = "idle";
    }

    if (this.state !== "attack" && this.hitTimer <= 0) {
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.crouching = Boolean(input.down && this.grounded);
      const targetSpeed = this.crouching ? dir * this.profile.speed * 0.28 : dir * this.profile.speed;
      this.vx = approach(this.vx, targetSpeed, this.grounded ? 1.8 * step : 0.5 * step);
      if (dir !== 0 && this.grounded) this.state = this.crouching ? "crouch" : "walk";
      else if (this.grounded) this.state = this.crouching ? "crouch" : "idle";

      if (input.jump && this.grounded && !this.crouching) {
        this.vy = -this.profile.jump;
        this.grounded = false;
        this.state = "jump";
        audio.tone(150, 0.08, "triangle", 0.02, 1.7);
      }
      if (input.light) this.startAttack("light", gameRef);
      else if (input.heavy) this.startAttack("heavy", gameRef);
      else if (input.special) this.startAttack("special", gameRef);
    }

    if (this.state === "attack" && this.attack) {
      const def = ATTACKS[this.attack.type];
      this.attack.elapsed += dt;
      if (this.attack.type === "super" && this.attack.elapsed > 260 && this.attack.elapsed < 560) {
        this.vx = this.facing * 11.5;
      }
      if (this.attack.type === "projectile" && !this.attack.spawned && this.attack.elapsed >= def.activeStart) {
        this.attack.spawned = true;
        gameRef.projectiles.push(new Projectile(this));
      }
      if (!this.attack.resolved && this.attack.type !== "projectile" && this.attack.elapsed >= def.activeStart) {
        this.attack.resolved = true;
        gameRef.resolveMelee(this, opponent, def);
      }
      if (this.attack.elapsed >= def.duration) {
        this.attack = null;
        this.state = "idle";
      }
    }

    if (!this.grounded) {
      this.vy += GRAVITY * step;
      this.state = this.hitTimer > 0 ? "hit" : (this.state === "attack" ? "attack" : "jump");
    }

    if (this.state !== "walk" && this.grounded && this.hitTimer <= 0 && this.state !== "attack") this.vx = approach(this.vx, 0, 1.25 * step);
    this.x += this.vx * step;
    this.y += this.vy * step;

    if (this.y >= FLOOR) {
      this.y = FLOOR;
      this.vy = 0;
      this.grounded = true;
      if (this.state === "jump") this.state = "idle";
    }
    this.x = clamp(this.x, 58, W - 58);

    if (this.state !== "attack" && this.hitTimer <= 0 && Math.abs(opponent.x - this.x) > 4) {
      this.facing = opponent.x > this.x ? 1 : -1;
    }
  }

  draw(context) {
    const p = this.profile;
    const idle = Math.sin(this.animTime * 0.007);
    const walk = Math.sin(this.animTime * 0.022);
    const attackType = this.attack?.type;
    const attackProgress = this.attack ? this.attack.elapsed / ATTACKS[attackType].duration : 0;
    const crouch = this.crouching ? 32 : 0;
    const jumpTilt = this.grounded ? 0 : clamp(this.vy * 0.01, -0.16, 0.22);
    const hitTilt = this.state === "hit" ? -0.22 : 0;

    context.save();
    context.translate(this.x, this.y);

    context.save();
    context.scale(1, 0.28);
    const shadowScale = this.grounded ? 1 : clamp(1 - (FLOOR - this.y) / 450, 0.35, 0.9);
    context.globalAlpha = 0.32 * shadowScale;
    context.fillStyle = "#000";
    context.beginPath(); context.ellipse(0, 14, 52 * p.build, 26, 0, 0, Math.PI * 2); context.fill();
    context.restore();

    context.scale(this.facing, 1);
    context.rotate(jumpTilt + hitTilt);
    context.translate(0, crouch - Math.abs(idle) * 2);
    context.scale(p.build, Math.sqrt(p.build));

    if (attackType === "super") {
      const aura = Math.sin(this.animTime * 0.04) * 8 + 58;
      context.save();
      context.globalAlpha = 0.24;
      context.globalCompositeOperation = "lighter";
      context.fillStyle = p.color;
      context.beginPath(); context.ellipse(5, -86, aura, 108, 0, 0, Math.PI * 2); context.fill();
      context.restore();
    }

    let frontArm = -0.15 + idle * 0.06;
    let backArm = 0.45 - idle * 0.05;
    let frontLeg = 0.1;
    let backLeg = -0.12;
    let torsoTilt = 0;

    if (this.state === "walk") {
      frontLeg = walk * 0.5;
      backLeg = -walk * 0.5;
      frontArm = -walk * 0.45;
      backArm = walk * 0.45;
    }
    if (this.state === "jump") { frontLeg = -0.62; backLeg = 0.55; frontArm = -0.7; backArm = 0.7; }
    if (this.state === "block") { frontArm = -1.45; backArm = -0.92; torsoTilt = -0.08; }
    if (attackType === "light") {
      const snap = Math.sin(Math.min(1, attackProgress * 1.8) * Math.PI);
      frontArm = -1.45 - snap * 0.2;
      torsoTilt = snap * 0.13;
    }
    if (attackType === "heavy") {
      const snap = Math.sin(Math.min(1, attackProgress * 1.55) * Math.PI);
      frontLeg = -1.4 * snap;
      backArm = 0.9 * snap;
      torsoTilt = -snap * 0.12;
    }
    if (attackType === "projectile") { frontArm = -1.42; backArm = -1.28; torsoTilt = 0.16; }
    if (attackType === "super") {
      const snap = Math.sin(clamp((attackProgress - 0.22) * 1.6, 0, 1) * Math.PI);
      frontArm = -1.45; backArm = -0.8; frontLeg = -1.28 * snap; torsoTilt = snap * 0.2;
    }

    const drawLimb = (x, y, length, angle, width, color, glove = false) => {
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.strokeStyle = color;
      context.lineWidth = width;
      context.lineCap = "round";
      context.beginPath(); context.moveTo(0, 0); context.lineTo(0, length); context.stroke();
      context.fillStyle = glove ? p.accent : color;
      context.beginPath(); context.arc(0, length, width * 0.52, 0, Math.PI * 2); context.fill();
      context.restore();
    };

    // Rear limbs.
    drawLimb(-15, -64, 70, backLeg, 20, p.dark);
    drawLimb(-15, -132, 64, backArm, 18, p.dark, true);

    context.save();
    context.rotate(torsoTilt);
    const torsoGradient = context.createLinearGradient(-30, -150, 30, -70);
    torsoGradient.addColorStop(0, p.color);
    torsoGradient.addColorStop(1, p.dark);
    context.fillStyle = torsoGradient;
    context.beginPath();
    context.moveTo(-29, -141); context.lineTo(24, -145); context.lineTo(33, -65); context.lineTo(-26, -65); context.closePath(); context.fill();
    context.strokeStyle = p.accent; context.lineWidth = 4;
    context.beginPath(); context.moveTo(-23, -121); context.lineTo(20, -112); context.stroke();

    if (p.style === "armor") {
      context.fillStyle = p.accent;
      context.fillRect(-36, -139, 17, 43);
      context.fillRect(20, -139, 17, 43);
    } else if (p.style === "coat") {
      context.fillStyle = p.dark;
      context.beginPath(); context.moveTo(-25, -75); context.lineTo(0, -30); context.lineTo(28, -72); context.closePath(); context.fill();
    } else if (p.style === "scarf") {
      context.fillStyle = p.accent;
      context.beginPath(); context.moveTo(-8, -139); context.lineTo(-74 - idle * 10, -122); context.lineTo(-18, -113); context.closePath(); context.fill();
    }
    context.restore();

    // Neck and head.
    context.fillStyle = p.skin;
    context.fillRect(-8, -157, 16, 19);
    context.beginPath(); context.ellipse(0, -173, 23, 26, 0.08, 0, Math.PI * 2); context.fill();
    context.fillStyle = p.dark;
    context.beginPath(); context.arc(-3, -181, 23, Math.PI, Math.PI * 2.1); context.lineTo(21, -166); context.lineTo(14, -181); context.fill();
    if (p.style === "mohawk") {
      context.fillStyle = p.accent;
      context.beginPath(); context.moveTo(-12, -196); context.lineTo(3, -222); context.lineTo(13, -194); context.closePath(); context.fill();
    }
    context.fillStyle = "#fff";
    context.fillRect(11, -176, 7, 3);

    // Front limbs.
    drawLimb(17, -67, 72, frontLeg, 22, p.color);
    drawLimb(20, -129, attackType === "light" ? 78 : 66, frontArm, 19, p.color, true);

    // Shoe accents and attack trails.
    context.fillStyle = p.accent;
    context.fillRect(2, -1, 31, 10);
    if ((attackType === "heavy" || attackType === "super") && attackProgress > 0.2 && attackProgress < 0.72) {
      context.save();
      context.globalAlpha = 0.48;
      context.strokeStyle = p.color;
      context.lineWidth = attackType === "super" ? 20 : 10;
      context.beginPath(); context.arc(8, -70, 93, -1.15, 0.25); context.stroke();
      context.restore();
    }

    if (this.flash > 0) {
      context.globalCompositeOperation = "source-atop";
      context.globalAlpha = this.flash / 100;
      context.fillStyle = "#fff";
      context.fillRect(-100, -240, 220, 260);
    }
    context.restore();
  }
}

class CPUController {
  constructor() {
    this.decisionTimer = 0;
    this.intent = { left: false, right: false, down: false, jump: false, light: false, heavy: false, special: false };
  }

  update(dt, fighter, opponent) {
    this.decisionTimer -= dt;
    const distance = Math.abs(opponent.x - fighter.x);
    const towardKey = opponent.x > fighter.x ? "right" : "left";
    const awayKey = opponent.x > fighter.x ? "left" : "right";
    this.intent.jump = false;
    this.intent.light = false;
    this.intent.heavy = false;
    this.intent.special = false;

    if (this.decisionTimer <= 0) {
      this.decisionTimer = 75 + Math.random() * 105;
      this.intent.left = false;
      this.intent.right = false;
      this.intent.down = false;

      const threatened = opponent.state === "attack" && distance < 190;
      if (threatened && Math.random() < 0.78) {
        this.intent[awayKey] = true;
        if (Math.random() < 0.25) this.intent.down = true;
      } else if (distance > 235) {
        this.intent[towardKey] = true;
        if (fighter.meter >= 25 && Math.random() < 0.14) this.intent.special = true;
        else if (Math.random() < 0.06) this.intent.jump = true;
      } else if (distance > 105) {
        this.intent[towardKey] = Math.random() < 0.62;
        if (fighter.meter >= 100 && Math.random() < 0.32) this.intent.special = true;
        else if (fighter.meter >= 25 && Math.random() < 0.16) this.intent.special = true;
        else if (Math.random() < 0.28) this.intent.heavy = true;
      } else {
        const roll = Math.random();
        if (roll < 0.44) this.intent.light = true;
        else if (roll < 0.71) this.intent.heavy = true;
        else if (roll < 0.83 && fighter.meter >= 25) this.intent.special = true;
        else this.intent[awayKey] = true;
      }
    }
    return { ...this.intent };
  }
}

class NeonRivals {
  constructor() {
    this.state = "title";
    this.mode = "arcade";
    this.selectedP1 = null;
    this.selectedP2 = null;
    this.players = [];
    this.controllers = [];
    this.matchScore = [0, 0];
    this.roundNumber = 0;
    this.roundTimer = 99;
    this.timerCarry = 0;
    this.preFight = 0;
    this.introCue = 0;
    this.roundEndTimer = 0;
    this.roundWinner = -1;
    this.roundEndReason = "K.O.";
    this.projectiles = [];
    this.particles = [];
    this.hitStop = 0;
    this.screenShake = 0;
    this.superFlash = 0;
    this.ai = new CPUController();
    this.lastTime = performance.now();
    this.pausedFrom = null;
    this.stageTime = 0;
    this.bindUI();
    this.buildFighterGrid();
    this.buildTouchControls();
    requestAnimationFrame((time) => this.loop(time));
  }

  bindUI() {
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      audio.ui();
      this.beginSelection(button.dataset.mode);
    }));
    document.querySelector("#how-to-button").addEventListener("click", () => { audio.ui(); this.showScreen("help-screen"); });
    document.querySelector("#help-back").addEventListener("click", () => { audio.ui(); this.showTitle(); });
    document.querySelector("#select-back").addEventListener("click", () => { audio.ui(); this.showTitle(); });
    document.querySelector("#resume-button").addEventListener("click", () => this.togglePause());
    document.querySelector("#quit-button").addEventListener("click", () => this.showTitle());
    document.querySelector("#sound-toggle").addEventListener("click", (event) => {
      audio.enabled = !audio.enabled;
      event.currentTarget.textContent = `SOUND: ${audio.enabled ? "ON" : "OFF"}`;
      event.currentTarget.setAttribute("aria-pressed", String(audio.enabled));
      if (audio.enabled) audio.ui();
    });
    canvas.addEventListener("pointerdown", () => {
      audio.unlock();
      if (this.state === "matchOver") this.returnToSelection();
    });
  }

  buildFighterGrid() {
    const grid = document.querySelector("#fighter-grid");
    grid.innerHTML = "";
    FIGHTERS.forEach((fighter) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "fighter-card";
      card.dataset.fighter = fighter.id;
      card.style.setProperty("--fighter", fighter.color);
      card.style.setProperty("--fighter-dark", fighter.dark);
      card.innerHTML = `
        <span class="fighter-silhouette" aria-hidden="true">
          <span class="head"></span><span class="torso"></span><span class="arm-a"></span>
          <span class="arm-b"></span><span class="leg-a"></span><span class="leg-b"></span>
        </span>
        <span class="fighter-card-copy"><strong>${fighter.name}</strong><small>${fighter.epithet}</small></span>`;
      card.addEventListener("click", () => this.chooseFighter(fighter));
      grid.appendChild(card);
    });
  }

  buildTouchControls() {
    const controls = document.createElement("div");
    controls.className = "touch-controls";
    controls.setAttribute("aria-label", "Touch controls for player one");
    controls.innerHTML = `
      <div class="touch-cluster movement">
        <button class="touch-control" data-key="w" aria-label="Jump">▲</button>
        <button class="touch-control" data-key="a" aria-label="Move left">◀</button>
        <button class="touch-control" data-key="s" aria-label="Crouch">▼</button>
        <button class="touch-control" data-key="d" aria-label="Move right">▶</button>
      </div>
      <div class="touch-cluster actions">
        <button class="touch-control" data-key="f">LIGHT</button>
        <button class="touch-control" data-key="g">HEAVY</button>
        <button class="touch-control" data-key="h">DRIVE</button>
      </div>`;
    document.body.appendChild(controls);
    controls.querySelectorAll("[data-key]").forEach((button) => {
      const key = button.dataset.key;
      const press = (event) => {
        event.preventDefault();
        audio.unlock();
        if (!input.down.has(key)) input.pressed.add(key);
        input.down.add(key);
        button.setPointerCapture?.(event.pointerId);
      };
      const release = (event) => { event.preventDefault(); input.down.delete(key); };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  }

  showScreen(id = null) {
    document.querySelectorAll(".screen-panel").forEach((panel) => panel.classList.toggle("active", panel.id === id));
  }

  showTitle() {
    this.state = "title";
    this.players = [];
    this.projectiles = [];
    this.particles = [];
    this.selectedP1 = null;
    this.selectedP2 = null;
    document.body.classList.remove("fighting");
    document.querySelectorAll(".fighter-card").forEach((card) => card.classList.remove("locked-p1", "locked-p2"));
    this.showScreen("title-screen");
  }

  beginSelection(mode) {
    this.mode = mode;
    this.state = "select";
    this.selectedP1 = null;
    this.selectedP2 = null;
    document.querySelector("#select-instruction").textContent = "PLAYER 1 — CHOOSE";
    document.querySelectorAll(".fighter-card").forEach((card) => card.classList.remove("locked-p1", "locked-p2"));
    this.showScreen("select-screen");
  }

  chooseFighter(profile) {
    audio.ui();
    const card = document.querySelector(`[data-fighter="${profile.id}"]`);
    if (!this.selectedP1) {
      this.selectedP1 = profile;
      card.classList.add("locked-p1");
      if (this.mode === "arcade") {
        const candidates = FIGHTERS.filter((fighter) => fighter.id !== profile.id);
        this.selectedP2 = choose(candidates);
        setTimeout(() => this.startMatch(), 260);
      } else {
        document.querySelector("#select-instruction").textContent = "PLAYER 2 — CHOOSE";
      }
      return;
    }
    if (this.mode === "versus" && !this.selectedP2) {
      this.selectedP2 = profile;
      card.classList.add("locked-p2");
      setTimeout(() => this.startMatch(), 260);
    }
  }

  startMatch() {
    this.matchScore = [0, 0];
    this.roundNumber = 0;
    this.setupRound();
  }

  setupRound() {
    this.roundNumber += 1;
    this.roundTimer = 99;
    this.timerCarry = 0;
    this.preFight = 2350;
    this.introCue = 0;
    this.roundEndTimer = 0;
    this.roundWinner = -1;
    this.projectiles = [];
    this.particles = [];
    this.players = [
      new Fighter(this.selectedP1, 330, 1, "human", 0),
      new Fighter(this.selectedP2, 950, -1, this.mode === "arcade" ? "cpu" : "human", 1)
    ];
    this.ai = new CPUController();
    this.state = "fight";
    document.body.classList.add("fighting");
    this.showScreen();
  }

  rematch() { this.startMatch(); }
  returnToSelection() { this.beginSelection(this.mode); }

  togglePause() {
    if (this.state === "paused") {
      this.state = this.pausedFrom || "fight";
      this.showScreen();
      document.body.classList.add("fighting");
      return;
    }
    if (this.state === "fight" || this.state === "roundEnd") {
      this.pausedFrom = this.state;
      this.state = "paused";
      document.body.classList.remove("fighting");
      this.showScreen("pause-screen");
    }
  }

  humanInput(playerIndex) {
    const c = playerIndex === 0
      ? { left: "a", right: "d", jump: "w", down: "s", light: "f", heavy: "g", special: "h" }
      : { left: "arrowleft", right: "arrowright", jump: "arrowup", down: "arrowdown", light: "j", heavy: "k", special: "l" };
    return {
      left: input.isDown(c.left), right: input.isDown(c.right), down: input.isDown(c.down),
      jump: input.wasPressed(c.jump), light: input.wasPressed(c.light), heavy: input.wasPressed(c.heavy), special: input.wasPressed(c.special)
    };
  }

  resolveMelee(attacker, target, def) {
    const range = def.range * attacker.profile.reach;
    const attackBox = {
      x: attacker.facing > 0 ? attacker.x + attacker.width * 0.22 : attacker.x - attacker.width * 0.22 - range,
      y: attacker.y - def.height - 28,
      w: range,
      h: def.height
    };
    if (overlaps(attackBox, target.getHurtbox())) {
      const hitX = attacker.facing > 0 ? attackBox.x + attackBox.w : attackBox.x;
      const hitY = attackBox.y + attackBox.h * 0.45;
      target.receiveHit(attacker, { ...def, damage: def.damage * attacker.profile.power }, this, hitX, hitY);
    }
  }

  spawnImpact(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      this.particles.push(new Particle(x, y, i % 4 === 0 ? "#fff" : color, {
        vx: (Math.random() - 0.5) * 19,
        vy: (Math.random() - 0.55) * 17,
        life: 240 + Math.random() * 330,
        size: 3 + Math.random() * 10,
        gravity: 0.38
      }));
    }
  }

  separateFighters() {
    const [a, b] = this.players;
    const minDistance = (a.width + b.width) * 0.47;
    const distance = Math.abs(a.x - b.x);
    if (distance < minDistance) {
      const push = (minDistance - distance) / 2;
      const direction = a.x < b.x ? -1 : 1;
      a.x = clamp(a.x + push * direction, 58, W - 58);
      b.x = clamp(b.x - push * direction, 58, W - 58);
    }
  }

  finishRound(winner, reason) {
    if (this.state !== "fight") return;
    this.state = "roundEnd";
    this.roundWinner = winner;
    this.roundEndReason = reason;
    this.roundEndTimer = 2700;
    if (winner >= 0) this.matchScore[winner] += 1;
    audio.knockout();
    document.body.classList.remove("fighting");
  }

  update(dt, now) {
    this.stageTime += dt;
    audio.updateMusic(now, this.state === "fight" && this.preFight <= 0);
    if (this.state === "paused") return;

    this.superFlash = Math.max(0, this.superFlash - dt);
    this.screenShake = approach(this.screenShake, 0, dt * 0.02);
    this.particles.forEach((particle) => particle.update(dt));
    this.particles = this.particles.filter((particle) => particle.life > 0);

    if (this.state === "fight") {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        return;
      }

      if (this.preFight > 0) {
        this.preFight -= dt;
        if (this.preFight < 1450 && this.introCue === 0) { this.introCue = 1; audio.announce(); }
        input.endFrame();
        return;
      }

      const [p1, p2] = this.players;
      const input1 = this.humanInput(0);
      const input2 = p2.controller === "cpu" ? this.ai.update(dt, p2, p1) : this.humanInput(1);
      p1.currentInput = input1;
      p2.currentInput = input2;
      p1.update(dt, input1, p2, this);
      p2.update(dt, input2, p1, this);
      this.separateFighters();

      this.projectiles.forEach((projectile) => {
        const target = projectile.owner === p1 ? p2 : p1;
        projectile.update(dt, target, this);
      });
      this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);

      this.timerCarry += dt;
      if (this.timerCarry >= 1000) {
        const seconds = Math.floor(this.timerCarry / 1000);
        this.roundTimer = Math.max(0, this.roundTimer - seconds);
        this.timerCarry -= seconds * 1000;
      }

      if (p1.health <= 0 || p2.health <= 0) {
        const winner = p1.health === p2.health ? -1 : (p1.health > p2.health ? 0 : 1);
        this.finishRound(winner, "K.O.");
      } else if (this.roundTimer <= 0) {
        const winner = Math.abs(p1.health - p2.health) < 0.1 ? -1 : (p1.health > p2.health ? 0 : 1);
        this.finishRound(winner, "TIME");
      }
    } else if (this.state === "roundEnd") {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        if (this.matchScore[0] >= 2 || this.matchScore[1] >= 2) {
          this.state = "matchOver";
          this.showScreen();
        } else {
          this.setupRound();
        }
      }
    }
  }

  drawBackground() {
    const t = this.stageTime;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#050818");
    sky.addColorStop(0.58, "#152342");
    sky.addColorStop(1, "#180e26");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Moon and atmospheric haze.
    const moonGlow = ctx.createRadialGradient(965, 116, 5, 965, 116, 120);
    moonGlow.addColorStop(0, "rgba(225,250,255,.85)");
    moonGlow.addColorStop(.18, "rgba(96,221,255,.42)");
    moonGlow.addColorStop(1, "rgba(42,115,190,0)");
    ctx.fillStyle = moonGlow; ctx.beginPath(); ctx.arc(965, 116, 120, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d9fbff"; ctx.beginPath(); ctx.arc(965, 116, 33, 0, Math.PI * 2); ctx.fill();

    // Distant skyline.
    ctx.fillStyle = "#080d20";
    const buildings = [
      [0, 295, 120, 250], [90, 235, 150, 310], [212, 325, 110, 220], [300, 205, 185, 340],
      [460, 285, 105, 260], [540, 170, 154, 380], [678, 312, 118, 238], [770, 220, 180, 330],
      [930, 280, 100, 270], [1010, 190, 160, 360], [1155, 315, 125, 240]
    ];
    buildings.forEach(([x, y, w, h], index) => {
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = index % 3 === 0 ? "rgba(255,55,158,.34)" : "rgba(46,213,255,.25)";
      for (let wx = x + 16; wx < x + w - 8; wx += 24) {
        for (let wy = y + 18; wy < y + h - 18; wy += 30) {
          if ((wx + wy + index) % 5 > 1) ctx.fillRect(wx, wy, 7, 11);
        }
      }
      ctx.fillStyle = "#080d20";
    });

    // Elevated rail and passing light train.
    ctx.fillStyle = "#101323";
    ctx.fillRect(0, 355, W, 23);
    ctx.fillStyle = "#263651";
    ctx.fillRect(0, 355, W, 5);
    const trainX = ((t * 0.11) % (W + 500)) - 450;
    ctx.fillStyle = "#24324b";
    ctx.fillRect(trainX, 310, 430, 42);
    ctx.fillStyle = "#72efff";
    for (let x = trainX + 18; x < trainX + 410; x += 46) ctx.fillRect(x, 321, 28, 13);

    // Market awnings and neon signs.
    ctx.fillStyle = "#23142e";
    ctx.fillRect(34, 390, 250, 110);
    ctx.fillRect(990, 395, 255, 105);
    this.drawNeonSign(65, 410, 165, 62, "NIGHT BITE", "#ff3da4", t);
    this.drawNeonSign(1045, 410, 145, 62, "LEVEL 9", "#37e6ff", t + 400);

    // Crowd silhouettes.
    for (let i = 0; i < 25; i += 1) {
      const x = 22 + i * 54;
      const bob = Math.sin(t * 0.004 + i * 1.7) * 3;
      ctx.fillStyle = i % 3 === 0 ? "#111426" : "#0b1020";
      ctx.beginPath(); ctx.arc(x, 490 + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 15, 500 + bob, 30, 54);
    }

    // Arena floor.
    const floorGradient = ctx.createLinearGradient(0, 520, 0, H);
    floorGradient.addColorStop(0, "#1b2031");
    floorGradient.addColorStop(1, "#07090f");
    ctx.fillStyle = floorGradient; ctx.fillRect(0, 520, W, 200);
    ctx.strokeStyle = "rgba(76,205,255,.14)"; ctx.lineWidth = 1;
    for (let x = -300; x < W + 300; x += 80) {
      ctx.beginPath(); ctx.moveTo(W / 2, 520); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 535; y < H; y += 31) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,61,164,.55)"; ctx.fillRect(0, 520, W, 3);

    // Rain catches neon light.
    ctx.strokeStyle = "rgba(152,220,255,.16)"; ctx.lineWidth = 1;
    for (let i = 0; i < 65; i += 1) {
      const x = (i * 91 + t * 0.28) % (W + 80) - 40;
      const y = (i * 57 + t * 0.65) % H;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 24); ctx.stroke();
    }
  }

  drawNeonSign(x, y, w, h, label, color, time) {
    ctx.save();
    const flicker = Math.sin(time * 0.015) > -0.92 ? 1 : 0.35;
    ctx.globalAlpha = flicker;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.font = "900 24px 'Barlow Condensed', sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  drawHUD() {
    const [p1, p2] = this.players;
    if (!p1 || !p2) return;
    const margin = 55;
    const barW = 455;
    const barY = 52;

    const drawHealth = (fighter, x, flip) => {
      ctx.save();
      ctx.translate(x, 0);
      if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = "rgba(2,5,12,.82)";
      ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(barW, barY); ctx.lineTo(barW - 19, barY + 39); ctx.lineTo(0, barY + 39); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#732339";
      ctx.fillRect(7, barY + 7, (barW - 27) * fighter.displayHealth / 100, 25);
      const healthGradient = ctx.createLinearGradient(0, 0, barW, 0);
      healthGradient.addColorStop(0, fighter.health < 25 ? "#ff334f" : "#ffe247");
      healthGradient.addColorStop(1, fighter.health < 25 ? "#ff6a3d" : "#68f27e");
      ctx.fillStyle = healthGradient;
      ctx.fillRect(7, barY + 7, (barW - 27) * fighter.health / 100, 25);
      ctx.restore();
    };

    drawHealth(p1, margin, false);
    drawHealth(p2, W - margin, true);

    ctx.textBaseline = "top";
    ctx.font = "italic 900 29px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left"; ctx.fillText(p1.profile.name, margin + 4, 95);
    ctx.textAlign = "right"; ctx.fillText(p2.profile.name, W - margin - 4, 95);

    ctx.fillStyle = "#050912";
    ctx.beginPath(); ctx.moveTo(591, 39); ctx.lineTo(689, 39); ctx.lineTo(705, 88); ctx.lineTo(640, 116); ctx.lineTo(575, 88); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#7ddcf4"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = this.roundTimer <= 10 ? "#ff4e5e" : "#fff";
    ctx.textAlign = "center";
    ctx.font = "900 48px 'Barlow Condensed', sans-serif";
    ctx.fillText(String(this.roundTimer).padStart(2, "0"), W / 2, 51);

    const drawRounds = (score, x, direction) => {
      for (let i = 0; i < 2; i += 1) {
        ctx.fillStyle = i < score ? "#ffd84a" : "rgba(255,255,255,.15)";
        ctx.save(); ctx.translate(x + i * 22 * direction, 126); ctx.rotate(Math.PI / 4); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      }
    };
    drawRounds(this.matchScore[0], margin + 7, 1);
    drawRounds(this.matchScore[1], W - margin - 7, -1);

    const drawMeter = (fighter, x, flip) => {
      const w = 330;
      ctx.save(); ctx.translate(x, 0); if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = "rgba(4,8,18,.8)"; ctx.fillRect(0, 660, w, 25);
      const meterGradient = ctx.createLinearGradient(0, 0, w, 0);
      meterGradient.addColorStop(0, fighter.profile.dark); meterGradient.addColorStop(1, fighter.meter >= 100 ? "#fff" : fighter.profile.color);
      ctx.fillStyle = meterGradient; ctx.fillRect(4, 664, (w - 8) * fighter.meter / 100, 17);
      for (let i = 1; i < 4; i += 1) { ctx.fillStyle = "rgba(0,0,0,.65)"; ctx.fillRect(i * w / 4, 660, 3, 25); }
      ctx.restore();
      ctx.fillStyle = fighter.meter >= 100 ? "#fff" : fighter.profile.color;
      ctx.textAlign = flip ? "right" : "left";
      ctx.font = "900 17px 'Barlow Condensed', sans-serif";
      ctx.fillText(fighter.meter >= 100 ? "DRIVE MAX" : "DRIVE", flip ? x : x, 634);
    };
    drawMeter(p1, margin, false);
    drawMeter(p2, W - margin, true);

    [p1, p2].forEach((fighter, index) => {
      if (fighter.combo > 1 && fighter.comboTimer > 0) {
        ctx.textAlign = index === 0 ? "left" : "right";
        ctx.fillStyle = fighter.profile.color;
        ctx.font = "italic 900 44px 'Barlow Condensed', sans-serif";
        ctx.fillText(`${fighter.combo} HIT`, index === 0 ? 66 : W - 66, 177);
        ctx.fillStyle = "#fff"; ctx.font = "700 13px Inter, sans-serif";
        ctx.fillText("CHAIN", index === 0 ? 68 : W - 68, 223);
      }
    });
  }

  drawAnnouncement() {
    if (this.state === "fight" && this.preFight > 0) {
      const text = this.preFight > 1450 ? `ROUND ${this.roundNumber}` : "FIGHT";
      const progress = this.preFight > 1450 ? (2350 - this.preFight) / 900 : (1450 - this.preFight) / 1450;
      const scale = 1 + Math.max(0, 0.35 - progress) * 1.8;
      ctx.save(); ctx.translate(W / 2, H / 2 - 35); ctx.scale(scale, scale);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${text === "FIGHT" ? 126 : 82}px 'Barlow Condensed', sans-serif`;
      ctx.lineWidth = 16; ctx.strokeStyle = "rgba(3,5,13,.92)"; ctx.strokeText(text, 0, 0);
      ctx.fillStyle = text === "FIGHT" ? "#ffd747" : "#fff"; ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    if (this.state === "roundEnd") {
      ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.rotate(-0.03);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "italic 900 142px 'Barlow Condensed', sans-serif";
      ctx.lineWidth = 20; ctx.strokeStyle = "rgba(2,3,10,.9)"; ctx.strokeText(this.roundEndReason, 0, 0);
      ctx.fillStyle = "#ffcf3d"; ctx.fillText(this.roundEndReason, 0, 0);
      ctx.font = "900 32px 'Barlow Condensed', sans-serif";
      ctx.fillStyle = "#fff";
      const result = this.roundWinner < 0 ? "DRAW ROUND" : `${this.players[this.roundWinner].profile.name} TAKES THE ROUND`;
      ctx.fillText(result, 0, 95);
      ctx.restore();
    }
  }

  drawMatchOver() {
    const winnerIndex = this.matchScore[0] > this.matchScore[1] ? 0 : 1;
    const winner = this.players[winnerIndex];
    ctx.fillStyle = "rgba(2,4,11,.72)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = winner.profile.color;
    ctx.font = "700 16px Inter, sans-serif"; ctx.fillText("NEON CIRCUIT VICTOR", W / 2, 215);
    ctx.font = "italic 900 112px 'Barlow Condensed', sans-serif";
    ctx.lineWidth = 18; ctx.strokeStyle = "#02040a"; ctx.strokeText(winner.profile.name, W / 2, 330);
    ctx.fillText(winner.profile.name, W / 2, 330);
    ctx.fillStyle = "#fff"; ctx.font = "900 31px 'Barlow Condensed', sans-serif"; ctx.fillText("WINS THE MATCH", W / 2, 410);
    ctx.fillStyle = "#9ba8bf"; ctx.font = "700 14px Inter, sans-serif"; ctx.fillText("PRESS R TO REMATCH  ·  ENTER OR TAP TO SELECT", W / 2, 485);
  }

  render() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (this.screenShake > 0) ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    this.drawBackground();
    this.projectiles.forEach((projectile) => projectile.draw(ctx));
    this.players.forEach((fighter) => fighter.draw(ctx));
    this.particles.forEach((particle) => particle.draw(ctx));
    ctx.restore();

    if (["fight", "roundEnd", "paused", "matchOver"].includes(this.state)) this.drawHUD();
    this.drawAnnouncement();
    if (this.state === "matchOver") this.drawMatchOver();

    if (this.superFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = this.superFlash / 520;
      ctx.fillStyle = this.players.find((fighter) => fighter.attack?.type === "super")?.profile.color || "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  loop(time) {
    const dt = Math.min(34, time - this.lastTime || STEP_MS);
    this.lastTime = time;
    this.update(dt, time);
    this.render();
    input.endFrame();
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }
}

const input = new InputManager();
const audio = new AudioSystem();
const game = new NeonRivals();
