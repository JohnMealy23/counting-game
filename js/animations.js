/**
 * Animation system: tweens, sequences, parallel runners, and particles.
 *
 * Usage:
 *   const anim = new AnimationSystem();
 *   // each frame:
 *   anim.update(dt);   // dt in seconds
 *
 * Building animations:
 *   const t = anim.tween(duration, easing, onTick, onComplete?);
 *   const s = anim.sequence([t1, t2, t3]);   // runs in order
 *   const p = anim.parallel([t1, t2]);        // runs simultaneously
 *   anim.add(s);  // register to run
 */

// ── Easing functions ─────────────────────────────────────────────────────────

export const Easing = {
  linear:    t => t,
  easeIn:    t => t * t,
  easeOut:   t => 1 - (1 - t) * (1 - t),
  easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  // Pulse: 0→1→0 over [0,1]
  pulse:     t => Math.sin(t * Math.PI),
  // Bounce: settles with overshoot
  bounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1)          return n1 * t * t;
    if (t < 2 / d1)          return n1 * (t -= 1.5  / d1) * t + 0.75;
    if (t < 2.5 / d1)        return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return                          n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export function lerp(a, b, t) { return a + (b - a) * t; }

// ── Tween ─────────────────────────────────────────────────────────────────────

class Tween {
  /**
   * @param {number}   duration   seconds
   * @param {function} easing     t → eased-t
   * @param {function} onTick     (easedT) => void  — called each frame
   * @param {function} onComplete () => void         — called when done
   */
  constructor(duration, easing, onTick, onComplete) {
    this.duration   = Math.max(duration, 0.001);
    this.easing     = easing;
    this.onTick     = onTick;
    this.onComplete = onComplete;
    this.elapsed    = 0;
    this.done       = false;
  }

  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    const rawT  = Math.min(this.elapsed / this.duration, 1);
    const eased = this.easing(rawT);
    this.onTick(eased);
    if (rawT >= 1) {
      this.done = true;
      this.onComplete?.();
    }
  }
}

// ── Sequence ──────────────────────────────────────────────────────────────────

class Sequence {
  /** Runs steps one after another. */
  constructor(steps) {
    this.steps = steps;
    this.index = 0;
    this.done  = false;
  }

  update(dt) {
    if (this.done) return;
    // Skip over any already-done steps (handles 0-duration tweens)
    while (this.index < this.steps.length && this.steps[this.index].done) {
      this.index++;
    }
    if (this.index >= this.steps.length) { this.done = true; return; }
    const step = this.steps[this.index];
    step.update(dt);
    if (step.done) {
      this.index++;
      if (this.index >= this.steps.length) this.done = true;
    }
  }
}

// ── Parallel ──────────────────────────────────────────────────────────────────

class Parallel {
  /** Runs all steps simultaneously; done when ALL are done. */
  constructor(steps) {
    this.steps = steps;
    this.done  = false;
  }

  update(dt) {
    if (this.done) return;
    for (const s of this.steps) s.update(dt);
    if (this.steps.every(s => s.done)) this.done = true;
  }
}

// ── AnimationSystem ───────────────────────────────────────────────────────────

export class AnimationSystem {
  constructor() {
    this._active = [];
  }

  /** Register an animation (Tween/Sequence/Parallel) to run. */
  add(anim) {
    this._active.push(anim);
    return anim;
  }

  /** Call every frame with delta-time in seconds. */
  update(dt) {
    for (const a of this._active) a.update(dt);
    this._active = this._active.filter(a => !a.done);
  }

  isIdle() { return this._active.length === 0; }

  clear() { this._active = []; }

  // ── Factory helpers ──────────────────────────────────────────────────────

  tween(duration, easing, onTick, onComplete) {
    return new Tween(duration, easing, onTick, onComplete);
  }

  sequence(steps) { return new Sequence(steps); }
  parallel(steps) { return new Parallel(steps);  }
}

// ── Particle ──────────────────────────────────────────────────────────────────

export class Particle {
  /**
   * @param {number} x, y          initial position
   * @param {number} vx, vy        initial velocity in px/s
   * @param {string} color         CSS color
   * @param {number} size          square size in px
   * @param {number} life          lifetime in seconds
   * @param {number} bounce        velocity retention on floor bounce (0–1)
   */
  constructor(x, y, vx, vy, color, size, life, bounce = 0.4) {
    this.x       = x;
    this.y       = y;
    this.vx      = vx;
    this.vy      = vy;
    this.color   = color;
    this.size    = size;
    this.life    = life;
    this.maxLife = life;
    this.bounce  = bounce;
    this.dead    = false;
  }

  update(dt, floorY) {
    const GRAVITY = 500; // px/s²
    this.vy += GRAVITY * dt;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vx *= 0.99;   // air resistance

    if (this.y + this.size >= floorY && this.vy > 0) {
      this.y  = floorY - this.size;
      this.vy = -Math.abs(this.vy) * this.bounce;
      this.vx *= 0.82; // floor friction
    }

    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  get opacity() { return Math.max(0, this.life / this.maxLife); }
}
