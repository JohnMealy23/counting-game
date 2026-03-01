// ============================================================
// Count the Critters! - Main Game Logic
// ============================================================

const TOTAL_ROUNDS = 10;
const MIN_CRITTERS = 1;
const MAX_CRITTERS = 9;
const NUMBER_CHOICES = 9;

// Game state
let currentRound = 0;
let score = 0;
let correctCount = 0;
let currentSpriteType = '';
let critters = [];          // { x, y, vx, vy, bobPhase }
let gamePhase = 'start';    // start | playing | merging | bagging | exploding | ended
let bagContents = [];       // collected critter types
let bagScale = 1;
let animFrame = null;

// DOM references
const critterCanvas = document.getElementById('critter-canvas');
const critterCtx = critterCanvas.getContext('2d');
const bagCanvas = document.getElementById('bag-canvas');
const bagCtx = bagCanvas.getContext('2d');
const explosionCanvas = document.getElementById('explosion-canvas');
const explosionCtx = explosionCanvas.getContext('2d');
const numberGrid = document.getElementById('number-grid');
const startScreen = document.getElementById('start-screen');
const endScreen = document.getElementById('end-screen');

// ============================================================
// Canvas sizing
// ============================================================
function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;

    critterCanvas.width = critterCanvas.offsetWidth * dpr;
    critterCanvas.height = critterCanvas.offsetHeight * dpr;
    critterCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bagCanvas.width = bagCanvas.offsetWidth * dpr;
    bagCanvas.height = bagCanvas.offsetHeight * dpr;
    bagCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    explosionCanvas.width = window.innerWidth * dpr;
    explosionCanvas.height = window.innerHeight * dpr;
    explosionCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvases);
resizeCanvases();

// ============================================================
// Number buttons
// ============================================================
function createNumberButtons() {
    numberGrid.innerHTML = '';
    for (let i = 1; i <= NUMBER_CHOICES; i++) {
        const btn = document.createElement('button');
        btn.className = 'number-btn';
        btn.textContent = i;
        btn.dataset.value = i;
        btn.addEventListener('click', () => handleNumberClick(i, btn));
        numberGrid.appendChild(btn);
    }
}

function handleNumberClick(num, btn) {
    if (gamePhase !== 'playing') return;

    if (num === correctCount) {
        btn.classList.add('correct');
        score += correctCount * 10;
        updateScoreDisplay();
        gamePhase = 'merging';
        startMergeAnimation();
    } else {
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 500);
    }
}

function resetButtonStyles() {
    document.querySelectorAll('.number-btn').forEach(b => {
        b.classList.remove('correct', 'wrong');
    });
}

// ============================================================
// Score display
// ============================================================
function updateScoreDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('level-num').textContent = currentRound;
    document.getElementById('max-level').textContent = TOTAL_ROUNDS;
}

// ============================================================
// Spawn critters
// ============================================================
function spawnCritters() {
    const panelW = critterCanvas.offsetWidth;
    const panelH = critterCanvas.offsetHeight;
    const size = spriteSize(SPRITE_SCALE);
    const padding = 20;

    // Pick a random critter type
    currentSpriteType = SPRITE_NAMES[Math.floor(Math.random() * SPRITE_NAMES.length)];

    // Decide how many (avoid repeating same count consecutively)
    let count;
    do {
        count = MIN_CRITTERS + Math.floor(Math.random() * (MAX_CRITTERS - MIN_CRITTERS + 1));
    } while (count === correctCount && MAX_CRITTERS > 1);
    correctCount = count;

    critters = [];
    for (let i = 0; i < count; i++) {
        let x, y, overlap;
        let attempts = 0;
        do {
            x = padding + Math.random() * (panelW - size - padding * 2);
            y = padding + Math.random() * (panelH - size - padding * 2);
            overlap = critters.some(c =>
                Math.abs(c.x - x) < size * 0.85 && Math.abs(c.y - y) < size * 0.85
            );
            attempts++;
        } while (overlap && attempts < 60);

        critters.push({
            x, y,
            homeX: x, homeY: y,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            bobPhase: Math.random() * Math.PI * 2,
            scale: SPRITE_SCALE,
            opacity: 1,
        });
    }
}

// ============================================================
// Main render loop
// ============================================================
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    // Clear canvases
    critterCtx.clearRect(0, 0, critterCanvas.offsetWidth, critterCanvas.offsetHeight);
    bagCtx.clearRect(0, 0, bagCanvas.offsetWidth, bagCanvas.offsetHeight);

    if (gamePhase === 'playing') {
        updateCritters(dt);
        drawCritters();
    } else if (gamePhase === 'merging') {
        updateMerge(dt);
        drawCritters();
    } else if (gamePhase === 'bagging') {
        updateBagging(dt);
        drawCritters();
    }

    drawBag();

    if (gamePhase === 'exploding') {
        updateExplosion(dt);
        drawExplosion();
    }

    animFrame = requestAnimationFrame(gameLoop);
}

// ============================================================
// Critter update & draw (idle bobbing)
// ============================================================
function updateCritters(dt) {
    const panelW = critterCanvas.offsetWidth;
    const panelH = critterCanvas.offsetHeight;
    const size = spriteSize(SPRITE_SCALE);

    critters.forEach(c => {
        c.bobPhase += dt * 2;

        // Gentle wandering
        c.x += c.vx;
        c.y += c.vy;

        // Bounce off edges
        if (c.x < 10) { c.x = 10; c.vx *= -1; }
        if (c.x > panelW - size - 10) { c.x = panelW - size - 10; c.vx *= -1; }
        if (c.y < 10) { c.y = 10; c.vy *= -1; }
        if (c.y > panelH - size - 10) { c.y = panelH - size - 10; c.vy *= -1; }

        // Slight random direction changes
        if (Math.random() < 0.01) c.vx += (Math.random() - 0.5) * 0.3;
        if (Math.random() < 0.01) c.vy += (Math.random() - 0.5) * 0.3;
        c.vx = Math.max(-1, Math.min(1, c.vx));
        c.vy = Math.max(-1, Math.min(1, c.vy));
    });
}

function drawCritters() {
    critters.forEach(c => {
        const bobY = Math.sin(c.bobPhase) * 3;
        critterCtx.globalAlpha = c.opacity;
        drawSprite(critterCtx, currentSpriteType, c.x, c.y + bobY, c.scale);
        critterCtx.globalAlpha = 1;
    });
}

// ============================================================
// Merge animation: all critters move to center, shrink into one
// ============================================================
let mergeTimer = 0;
const MERGE_DURATION = 0.8;

function startMergeAnimation() {
    mergeTimer = 0;
    const panelW = critterCanvas.offsetWidth;
    const panelH = critterCanvas.offsetHeight;
    const size = spriteSize(SPRITE_SCALE);
    const centerX = panelW / 2 - size / 2;
    const centerY = panelH / 2 - size / 2;

    critters.forEach(c => {
        c.targetX = centerX;
        c.targetY = centerY;
        c.startX = c.x;
        c.startY = c.y;
    });
}

function updateMerge(dt) {
    mergeTimer += dt;
    const t = Math.min(mergeTimer / MERGE_DURATION, 1);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    critters.forEach((c, i) => {
        c.x = c.startX + (c.targetX - c.startX) * ease;
        c.y = c.startY + (c.targetY - c.startY) * ease;

        // Non-first critters fade and shrink
        if (i > 0) {
            c.opacity = 1 - ease;
            c.scale = SPRITE_SCALE * (1 - ease * 0.5);
        } else {
            // First critter grows slightly then normalizes
            const pulse = Math.sin(ease * Math.PI);
            c.scale = SPRITE_SCALE * (1 + pulse * 0.3);
        }
    });

    if (t >= 1) {
        // Keep only the "merged" critter
        critters = [critters[0]];
        critters[0].opacity = 1;
        critters[0].scale = SPRITE_SCALE;
        gamePhase = 'bagging';
        startBaggingAnimation();
    }
}

// ============================================================
// Bagging animation: the single merged critter drops to the bag
// ============================================================
let bagTimer = 0;
const BAG_DURATION = 0.6;

function startBaggingAnimation() {
    bagTimer = 0;
    const c = critters[0];
    c.startX = c.x;
    c.startY = c.y;

    // Target: center-bottom of critter canvas
    const panelW = critterCanvas.offsetWidth;
    const panelH = critterCanvas.offsetHeight;
    c.targetX = panelW / 2 - spriteSize(SPRITE_SCALE) / 2;
    c.targetY = panelH + 20; // below the panel into the bag area
}

function updateBagging(dt) {
    bagTimer += dt;
    const t = Math.min(bagTimer / BAG_DURATION, 1);
    // Ease in (accelerating like falling)
    const ease = t * t * t;

    const c = critters[0];
    c.x = c.startX + (c.targetX - c.startX) * ease;
    c.y = c.startY + (c.targetY - c.startY) * ease;
    c.scale = SPRITE_SCALE * (1 - ease * 0.6);
    c.opacity = 1 - ease * 0.5;

    if (t >= 1) {
        bagContents.push(currentSpriteType);
        bagScale = 1 + bagContents.length * 0.15;
        critters = [];

        // Check if game is over
        if (currentRound >= TOTAL_ROUNDS) {
            gamePhase = 'exploding';
            startExplosion();
        } else {
            // Next round
            gamePhase = 'playing';
            currentRound++;
            updateScoreDisplay();
            resetButtonStyles();
            spawnCritters();
        }
    }
}

// ============================================================
// Bag drawing
// ============================================================
function drawBag() {
    const w = bagCanvas.offsetWidth;
    const h = bagCanvas.offsetHeight;
    const cx = w / 2;
    const cy = h - 10;

    if (bagContents.length === 0 && gamePhase === 'start') return;

    const baseW = 50 * bagScale;
    const baseH = 45 * bagScale;

    // Bag body
    bagCtx.save();
    bagCtx.translate(cx, cy);

    // Bag shadow
    bagCtx.fillStyle = 'rgba(0,0,0,0.3)';
    bagCtx.beginPath();
    bagCtx.ellipse(0, 0, baseW * 0.8, 8, 0, 0, Math.PI * 2);
    bagCtx.fill();

    // Bag body (sack shape)
    bagCtx.fillStyle = '#8B6914';
    bagCtx.beginPath();
    bagCtx.moveTo(-baseW * 0.3, -baseH);
    bagCtx.quadraticCurveTo(-baseW, -baseH * 0.5, -baseW * 0.7, 0);
    bagCtx.lineTo(baseW * 0.7, 0);
    bagCtx.quadraticCurveTo(baseW, -baseH * 0.5, baseW * 0.3, -baseH);
    bagCtx.closePath();
    bagCtx.fill();

    // Bag highlight
    bagCtx.fillStyle = 'rgba(255,255,255,0.1)';
    bagCtx.beginPath();
    bagCtx.moveTo(-baseW * 0.15, -baseH);
    bagCtx.quadraticCurveTo(-baseW * 0.6, -baseH * 0.5, -baseW * 0.35, -2);
    bagCtx.lineTo(-baseW * 0.1, -2);
    bagCtx.quadraticCurveTo(-baseW * 0.2, -baseH * 0.5, -baseW * 0.15, -baseH);
    bagCtx.closePath();
    bagCtx.fill();

    // Bag top tie
    bagCtx.fillStyle = '#6B4F10';
    bagCtx.beginPath();
    bagCtx.ellipse(0, -baseH, baseW * 0.35, 6 * bagScale, 0, 0, Math.PI * 2);
    bagCtx.fill();

    // Bag outline
    bagCtx.strokeStyle = '#5a3e0a';
    bagCtx.lineWidth = 2;
    bagCtx.beginPath();
    bagCtx.moveTo(-baseW * 0.3, -baseH);
    bagCtx.quadraticCurveTo(-baseW, -baseH * 0.5, -baseW * 0.7, 0);
    bagCtx.lineTo(baseW * 0.7, 0);
    bagCtx.quadraticCurveTo(baseW, -baseH * 0.5, baseW * 0.3, -baseH);
    bagCtx.closePath();
    bagCtx.stroke();

    // Draw tiny critters inside the bag (peeking out)
    if (bagContents.length > 0) {
        const peekCount = Math.min(bagContents.length, 5);
        const peekScale = 1.5;
        const peekSize = spriteSize(peekScale);
        for (let i = 0; i < peekCount; i++) {
            const angle = (i / peekCount) * Math.PI - Math.PI;
            const px = Math.cos(angle) * baseW * 0.35;
            const py = -baseH - peekSize * 0.4 + Math.sin(angle) * 4;
            drawSprite(bagCtx, bagContents[bagContents.length - 1 - i], px - peekSize / 2, py, peekScale);
        }
    }

    // Item count
    if (bagContents.length > 0) {
        bagCtx.fillStyle = '#f5c842';
        bagCtx.font = `${10 + bagScale}px "Press Start 2P", monospace`;
        bagCtx.textAlign = 'center';
        bagCtx.fillText(`x${bagContents.length}`, 0, -baseH - 20);
    }

    bagCtx.restore();
}

// ============================================================
// End-of-level explosion!
// ============================================================
let explosionParticles = [];
let explosionTimer = 0;
const EXPLOSION_DURATION = 5;

function startExplosion() {
    explosionParticles = [];
    explosionTimer = 0;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Create particles from all collected sprite types
    const allColors = [];
    bagContents.forEach(name => {
        allColors.push(...getSpriteColors(name));
    });

    // Big burst of pixel particles
    for (let i = 0; i < 300; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 500;
        const color = allColors[Math.floor(Math.random() * allColors.length)];
        const size = 4 + Math.random() * 12;
        explosionParticles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 100,
            size,
            color,
            life: 1,
            decay: 0.15 + Math.random() * 0.15,
            gravity: 120 + Math.random() * 80,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 8,
            bounced: false,
        });
    }

    // Floating mini sprites
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 200;
        const spType = bagContents[Math.floor(Math.random() * bagContents.length)];
        explosionParticles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 150,
            size: 2 + Math.random() * 2,
            spriteType: spType,
            life: 1,
            decay: 0.08 + Math.random() * 0.08,
            gravity: 60,
            rotation: 0,
            rotSpeed: (Math.random() - 0.5) * 3,
            bounced: false,
        });
    }
}

function updateExplosion(dt) {
    explosionTimer += dt;

    explosionParticles.forEach(p => {
        p.x += p.vx * dt;
        p.vy += p.gravity * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;

        // Bounce off floor
        if (p.y > window.innerHeight - 20 && !p.bounced) {
            p.vy *= -0.5;
            p.vx *= 0.8;
            p.y = window.innerHeight - 20;
            p.bounced = true;
        }

        // Dance after settling (wiggle)
        if (explosionTimer > 2) {
            const dance = Math.sin(explosionTimer * 6 + p.x * 0.01) * 2;
            p.x += dance * dt * 20;
            p.vy *= 0.98;
            p.vx *= 0.98;
        }

        if (explosionTimer > 3) {
            p.life -= p.decay * dt * 2;
        }
    });

    explosionParticles = explosionParticles.filter(p => p.life > 0);

    if (explosionTimer > EXPLOSION_DURATION) {
        gamePhase = 'ended';
        explosionCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        showEndScreen();
    }
}

function drawExplosion() {
    explosionCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Screen flash at start
    if (explosionTimer < 0.3) {
        const flashAlpha = (1 - explosionTimer / 0.3) * 0.6;
        explosionCtx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        explosionCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    explosionParticles.forEach(p => {
        explosionCtx.save();
        explosionCtx.globalAlpha = Math.max(0, p.life);
        explosionCtx.translate(p.x, p.y);
        explosionCtx.rotate(p.rotation);

        if (p.spriteType) {
            drawSprite(explosionCtx, p.spriteType, -spriteSize(p.size) / 2, -spriteSize(p.size) / 2, p.size);
        } else {
            explosionCtx.fillStyle = p.color;
            explosionCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        explosionCtx.restore();
    });
}

// ============================================================
// Start / End screens
// ============================================================
function showEndScreen() {
    endScreen.classList.remove('hidden');
    document.getElementById('end-score').textContent = `Final Score: ${score}`;

    if (score >= TOTAL_ROUNDS * 50) {
        document.getElementById('end-title').textContent = 'AMAZING!';
        document.getElementById('end-message').textContent = 'You\'re a counting champion!';
    } else if (score >= TOTAL_ROUNDS * 30) {
        document.getElementById('end-title').textContent = 'Great Job!';
        document.getElementById('end-message').textContent = 'Super counting skills!';
    } else {
        document.getElementById('end-title').textContent = 'Nice Try!';
        document.getElementById('end-message').textContent = 'Keep practicing!';
    }
}

function startGame() {
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    score = 0;
    currentRound = 1;
    correctCount = 0;
    bagContents = [];
    bagScale = 1;
    explosionParticles = [];
    gamePhase = 'playing';

    updateScoreDisplay();
    createNumberButtons();
    spawnCritters();
}

// ============================================================
// Button listeners
// ============================================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ============================================================
// Boot
// ============================================================
createNumberButtons();
resizeCanvases();
lastTime = performance.now();
animFrame = requestAnimationFrame(gameLoop);
