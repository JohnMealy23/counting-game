/**
 * GameEngine — core state machine, game loop, rendering, and animation wiring.
 *
 * States:
 *   PLAYING           — waiting for player input
 *   CORRECT_ANIMATION — running the gather→merge→pop→bag-grow sequence
 *   WRONG_ANIMATION   — running the shake/flash feedback
 *   LEVEL_COMPLETE    — explosion particles flying
 */

import { SPRITE_TYPES, SpriteRenderer } from './sprites.js';
import { AnimationSystem, Particle, Easing, lerp } from './animations.js';
import { UIController } from './ui.js';
import { getLevelConfig, generateAnswerChoices } from './levels.js';

const STATE = {
  PLAYING:           'PLAYING',
  CORRECT_ANIMATION: 'CORRECT_ANIMATION',
  WRONG_ANIMATION:   'WRONG_ANIMATION',
  LEVEL_COMPLETE:    'LEVEL_COMPLETE',
};

// Explosion pixel colors
const EXPLOSION_COLORS = [
  '#FF2200', '#FF6600', '#FFDD00',
  '#44FF88', '#4488FF', '#FF44FF',
  '#FFFFFF', '#FF88AA', '#88FFCC',
];

export class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.sprites = new SpriteRenderer(this.ctx);
    this.animSys = new AnimationSystem();
    this.ui      = new UIController(this);

    // ── Game state ────────────────────────────────────────────────────────
    this.state        = STATE.PLAYING;
    this.levelIndex   = 0;
    this.score        = 0;
    this.correctCount = 0;  // correct answers accumulated in current level

    // ── Characters for the current round ─────────────────────────────────
    // Each: { type, x, y, pixelSize, opacity }
    this.characters    = [];
    this.correctAnswer = 1;

    // ── Bag ───────────────────────────────────────────────────────────────
    this.bagX     = 0;
    this.bagY     = 0;
    this.bagScale = 1.0;  // grows 1→5 as player gets correct answers

    // ── Explosion particles ───────────────────────────────────────────────
    this.particles = [];
    this._levelCompleteWaiting = false;

    // ── Wrong-answer flash ────────────────────────────────────────────────
    this.wrongFlashAlpha = 0;

    // ── Resize handling ───────────────────────────────────────────────────
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
    // Bag lives in the lower-center of the character zone (left ~50%)
    this.bagX = Math.round(this.canvas.width  * 0.25);
    this.bagY = Math.round(this.canvas.height - 80);
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  startLevel() {
    const cfg = getLevelConfig(this.levelIndex);
    this.correctCount = 0;
    this.bagScale     = 1.0;
    this.particles    = [];
    this.ui.updateHUD(this.levelIndex + 1, this.score, 0, cfg.correctToAdvance);
    this._newRound();
  }

  // ── Round management ───────────────────────────────────────────────────────

  _newRound() {
    const cfg   = getLevelConfig(this.levelIndex);
    const count = cfg.minCount + Math.floor(Math.random() * (cfg.maxCount - cfg.minCount + 1));
    const type  = SPRITE_TYPES[Math.floor(Math.random() * SPRITE_TYPES.length)];

    this.correctAnswer = count;
    this._layoutCharacters(count, type);

    const choices = generateAnswerChoices(count, cfg);
    this.ui.renderButtons(choices);
    this.ui.setButtonsDisabled(false);
    this.state = STATE.PLAYING;
  }

  _layoutCharacters(count, type) {
    // Characters go in the left ~50% of the canvas, centered vertically
    const zoneX    = 20;
    const zoneW    = this.canvas.width * 0.48 - 20;
    const zoneTopY = 80;
    const zoneH    = this.canvas.height - 190;

    // Pick pixel size so sprites fit nicely
    const pixelSize = count <= 4 ? 3 : count <= 9 ? 2 : 2;
    const spritePx  = 16 * pixelSize;
    const gap       = Math.max(6, Math.floor(spritePx * 0.3));
    const cellW     = spritePx + gap;
    const cellH     = spritePx + gap;

    const maxCols = Math.max(1, Math.floor(zoneW / cellW));
    const cols    = Math.min(count, maxCols);
    const rows    = Math.ceil(count / cols);

    const totalW = cols * cellW - gap;
    const totalH = rows * cellH - gap;

    const startX = zoneX + (zoneW - totalW) / 2 + spritePx / 2;
    const startY = zoneTopY + (zoneH - totalH) / 2 + spritePx / 2;

    this.characters = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.characters.push({
        type,
        x: startX + col * cellW,
        y: startY + row * cellH,
        pixelSize,
        opacity: 1,
      });
    }
  }

  // ── Player input ──────────────────────────────────────────────────────────

  onAnswerSelected(value) {
    if (this.state !== STATE.PLAYING) return;
    if (value === this.correctAnswer) {
      this._handleCorrect(value);
    } else {
      this._handleWrong(value);
    }
  }

  _handleCorrect(value) {
    this.state = STATE.CORRECT_ANIMATION;
    this.score += 10 * (this.levelIndex + 1);
    this.correctCount++;

    const cfg = getLevelConfig(this.levelIndex);
    this.ui.highlightCorrectButton(value);
    this.ui.updateHUD(this.levelIndex + 1, this.score, this.correctCount, cfg.correctToAdvance);

    this._playCorrectAnimation(() => {
      const cfg2 = getLevelConfig(this.levelIndex);
      if (this.correctCount >= cfg2.correctToAdvance) {
        this._startLevelComplete();
      } else {
        this._newRound();
      }
    });
  }

  _handleWrong(value) {
    this.state = STATE.WRONG_ANIMATION;
    this.ui.shakeWrongButton(value);

    const chars  = this.characters;
    const startX = chars.map(c => c.x);

    this.animSys.add(
      this.animSys.tween(0.45, Easing.linear, t => {
        const amp  = 10 * (1 - t);
        const freq = 8;
        for (let i = 0; i < chars.length; i++) {
          chars[i].x = startX[i] + Math.sin(t * freq * Math.PI * 2) * amp;
        }
        this.wrongFlashAlpha = Math.max(0, 0.25 * (1 - t * 2.5));
      }, () => {
        for (let i = 0; i < chars.length; i++) chars[i].x = startX[i];
        this.wrongFlashAlpha = 0;
        this.state = STATE.PLAYING;
      })
    );
  }

  // ── Correct-answer animation sequence ─────────────────────────────────────

  _playCorrectAnimation(onComplete) {
    const anim   = this.animSys;
    const chars  = this.characters;
    const meetX  = this.canvas.width  * 0.28;
    const meetY  = this.canvas.height * 0.45;

    // Snapshot start positions
    for (const c of chars) { c._sx = c.x; c._sy = c.y; }

    // ── Phase 1: GATHER (0.5s) ─────────────────────────────────────────────
    // All characters slide toward meeting point; non-leaders fade out
    const phase1 = anim.parallel(chars.map((c, i) =>
      anim.tween(0.5, Easing.easeInOut, t => {
        c.x = lerp(c._sx, meetX, t);
        c.y = lerp(c._sy, meetY, t);
        if (i > 0) c.opacity = lerp(1, 0, t);
      })
    ));

    // ── Phase 2: MERGE pulse (0.3s) ────────────────────────────────────────
    // Leader bounces in size; non-leaders removed at end
    const leader  = chars[0];
    const basePx  = leader ? leader.pixelSize : 2;

    const phase2 = anim.tween(0.3, Easing.pulse, t => {
      if (leader) leader.pixelSize = basePx + t * 2;
    }, () => {
      if (leader) leader.pixelSize = basePx;
      // Remove non-leaders
      this.characters = this.characters.slice(0, 1);
    });

    // ── Phase 3: POP TO BAG (0.5s) ────────────────────────────────────────
    // Leader arcs from meeting point into the bag with a parabolic path
    const arcHeight = -this.canvas.height * 0.12;
    const phase3 = anim.tween(0.5, Easing.easeIn, t => {
      const c = this.characters[0];
      if (!c) return;
      c.x        = lerp(meetX, this.bagX, t);
      c.y        = lerp(meetY, this.bagY, t) + arcHeight * Math.sin(Math.PI * t);
      c.pixelSize = lerp(basePx, 0.4, t);
      c.opacity  = t > 0.65 ? lerp(1, 0, (t - 0.65) / 0.35) : 1;
    }, () => {
      this.characters = [];
    });

    // ── Phase 4: BAG GROW (0.4s, runs with phase 3) ───────────────────────
    const prevBag  = this.bagScale;
    const nextBag  = Math.min(5, this.bagScale + 0.7);
    const phase4 = anim.tween(0.4, Easing.bounce, t => {
      this.bagScale = lerp(prevBag, nextBag, t);
    }, () => {
      this.bagScale = nextBag;
    });

    // ── Callback tween (fires onComplete after all phases) ─────────────────
    const done = anim.tween(0.001, Easing.linear, () => {}, onComplete);

    anim.add(anim.sequence([
      phase1,
      phase2,
      anim.parallel([phase3, phase4]),
      done,
    ]));
  }

  // ── Level complete: bag explosion ─────────────────────────────────────────

  _startLevelComplete() {
    this.state = STATE.LEVEL_COMPLETE;
    this.characters = [];
    this.ui.setButtonsDisabled(true);

    // Spawn 60 particles from bag center
    for (let i = 0; i < 60; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 120 + Math.random() * 380;
      const color  = EXPLOSION_COLORS[Math.floor(Math.random() * EXPLOSION_COLORS.length)];
      const size   = 4 + Math.floor(Math.random() * 8);
      const life   = 1.4 + Math.random() * 1.2;
      const bounce = 0.3 + Math.random() * 0.35;
      this.particles.push(new Particle(
        this.bagX + (Math.random() - 0.5) * 16,
        this.bagY + (Math.random() - 0.5) * 16,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 180, // bias upward
        color, size, life, bounce
      ));
    }

    // Also explode the bag visually: tween bagScale up then to 0
    const prevBag = this.bagScale;
    this.animSys.add(
      this.animSys.tween(0.3, Easing.easeOut, t => {
        this.bagScale = lerp(prevBag, prevBag * 1.8, t);
      }, () => {
        this.animSys.add(
          this.animSys.tween(0.25, Easing.easeIn, t => {
            this.bagScale = lerp(prevBag * 1.8, 0, t);
          }, () => {
            this.bagScale = 0;
          })
        );
      })
    );

    this._levelCompleteWaiting = true;
  }

  _checkLevelCompleteTransition() {
    if (!this._levelCompleteWaiting) return;
    if (this.particles.length > 0)   return;
    if (!this.animSys.isIdle())       return;

    this._levelCompleteWaiting = false;
    this._advanceLevel();
  }

  _advanceLevel() {
    const completedLevel = this.levelIndex + 1;
    this.levelIndex = Math.min(this.levelIndex + 1, 4); // cap at level 5
    this.ui.showLevelComplete(completedLevel, this.score, () => {
      this.bagScale = 1.0;
      this.startLevel();
    });
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  begin() {
    this._lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt  = Math.min((now - this._lastTime) / 1000, 0.05); // cap at 50ms
      this._lastTime = now;

      this.animSys.update(dt);
      this._updateParticles(dt);
      this._checkLevelCompleteTransition();
      this._render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _updateParticles(dt) {
    const floorY = this.canvas.height - 16;
    for (const p of this.particles) p.update(dt, floorY);
    this.particles = this.particles.filter(p => !p.dead);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  _render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawBackground();
    this._drawDivider();
    this._drawBag();
    this._drawCharacters();
    this._drawParticles();

    if (this.wrongFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.wrongFlashAlpha;
      ctx.fillStyle   = '#FF0000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  _drawBackground() {
    const { ctx, canvas } = this;

    // Deep-space gradient
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#06061e');
    grad.addColorStop(1, '#0c1830');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Deterministic star field (no flickering)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 70; i++) {
      const x = (i * 137 + 71)  % canvas.width;
      const y = (i * 97  + 53)  % (canvas.height * 0.65);
      const s = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
    }

    // Ground strip at the bottom
    ctx.fillStyle = '#0d0d28';
    ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
    ctx.fillStyle = '#1a1a44';
    ctx.fillRect(0, canvas.height - 104, canvas.width, 4);
  }

  _drawDivider() {
    const { ctx, canvas } = this;
    const x = Math.floor(canvas.width * 0.52);
    ctx.fillStyle = '#252560';
    for (let y = 70; y < canvas.height - 90; y += 14) {
      ctx.fillRect(x, y, 3, 9);
    }
  }

  _drawCharacters() {
    const animating = this.state === STATE.CORRECT_ANIMATION;
    for (const c of this.characters) {
      // Idle bob only while waiting for player input
      const bob = animating ? 0 : Math.sin(performance.now() / 320 + c.x * 0.015) * 3;
      this.sprites.drawSprite(c.type, c.x, c.y + bob, c.pixelSize, c.opacity);
    }
  }

  _drawBag() {
    if (this.bagScale <= 0) return;
    // Use the bag sprite; scale directly drives the pixel size
    this.sprites.drawSprite('bag', this.bagX, this.bagY, this.bagScale, 1.0);
  }

  _drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      const sz = Math.max(2, Math.ceil(p.size));
      ctx.fillRect(Math.floor(p.x - sz / 2), Math.floor(p.y - sz / 2), sz, sz);
      ctx.restore();
    }
  }
}
