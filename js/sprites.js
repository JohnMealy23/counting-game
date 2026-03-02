/**
 * Pixel-art sprite system.
 *
 * Each sprite is a 16×16 grid of single-character palette keys.
 * '.' means transparent. Every other character maps to a CSS color
 * in that sprite's palette object.
 *
 * The renderer draws each non-transparent grid cell as a
 * pixelSize × pixelSize filled rectangle on the canvas,
 * centered at the given (cx, cy) position.
 */

// ── Palettes ────────────────────────────────────────────────────────────────

const PALETTES = {
  duck: {
    Y: '#FFD700', // golden yellow body
    G: '#C8A000', // dark gold shadow / wing stripe
    O: '#FF8000', // orange beak and feet
    W: '#FFFFFF', // white eye highlight
    K: '#000000', // black pupil / outline
  },
  alien: {
    G: '#44FF44', // bright green body
    D: '#22AA22', // dark green outline
    W: '#FFFFFF', // white eyes
    K: '#000000', // black pupils
    M: '#FF44FF', // magenta mouth / antennae
    L: '#AAFFAA', // light green highlight
  },
  cake: {
    P: '#FF88BB', // pink frosting
    W: '#FFF0E0', // white cream
    T: '#C07840', // tan / brown cake sponge
    R: '#FF2244', // red cherry bottom layer
    Y: '#FFEE66', // yellow candle
    F: '#FF6600', // orange flame
  },
  bag: {
    B: '#8B5E3C', // brown leather body
    D: '#5C3A1E', // dark brown seams
    L: '#C89050', // tan/light highlight
    G: '#DAA520', // gold drawstring
  },
};

// ── Sprite pixel grids (16 rows × 16 columns) ───────────────────────────────

const SPRITE_DATA = {

  // DUCK: facing right, cute round body with wing stripe
  duck: [
    '................',
    '....YYYY........',
    '...YYYYYY.......',
    '..YYWKYYYY......',  // W=white eye, K=black pupil
    '..YYYYYYYOO.....',  // O=orange beak
    '..YYYYYYYYO.....',
    '...YYYYYYY......',
    '.GGYYYYYYYYY....',  // G=dark gold wing stripe
    'GGGYYYYYYYYYY...',
    'GGYYYYYYYYYYG...',
    '.GYYYYYYYYGG....',
    '..GGYYYYGG......',
    '....YYYY........',
    '....OO..OO......',  // orange feet
    '....OO..OO......',
    '................',
  ],

  // SPACE ALIEN: round green body, big eyes, magenta mouth
  alien: [
    '....DDDDDD......',  // D=dark green outline
    '...DGGGGGGD.....',
    '..DGWWLLWWGD....',  // W=white eyes, L=light green
    '..DGWKLLWKGD....',  // K=black pupils
    '..DGWWLLWWGD....',
    '..DGGGGGGGGD....',
    '..DGMMGGMMGD....',  // M=magenta mouth accents
    '...DGGGGGGD.....',
    '..DDDGGGGDDD....',
    '.DGGGGGGGGGGD...',
    '.DGGGGGGGGGGD...',
    '.DGGGGGGGGGGD...',
    '..DDDDDDDDD.....',
    '...GG.....GG....',  // legs
    '..GGG.....GGG...',  // feet
    '................',
  ],

  // CAKE: layered frosted cake with candle
  cake: [
    '......YY........',  // Y=yellow candle top
    '.....FFFF.......',  // F=orange flame
    '......FF........',
    '......WW........',  // W=white candle body
    '..PPPPPPPPPP....',  // P=pink frosting top
    '..WWWWWWWWWW....',  // W=white cream
    '..TTTTTTTTTT....',  // T=tan cake layer
    '..TTTTTTTTTT....',
    '..PPPPPPPPPP....',  // pink frosting middle
    '..TTTTTTTTTT....',
    '..TTTTTTTTTT....',
    '.PPPPPPPPPPPP...',  // pink frosting base
    '.RRRRRRRRRRRR...',  // R=red cherry row at base
    '................',
    '................',
    '................',
  ],

  // BAG: leather drawstring bag (grows via scale)
  bag: [
    '....GGGG........',  // G=gold drawstring
    '...GGGGGG.......',
    '...GGGGGG.......',
    '....BBBB........',  // B=brown bag top
    '...BBBBBB.......',
    '..BBBBBBBB......',
    '.BBBLLLLBBBB....',  // L=light tan highlight
    '.BBLLLLLLBBB....',
    '.BBLLLLLLBBB....',
    '.BBBBBBBBBB.....',
    '..DDBBBBDD......',  // D=dark seam
    '..DDDDDDDD......',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const SPRITE_TYPES = ['duck', 'alien', 'cake'];

// ── Renderer ─────────────────────────────────────────────────────────────────

export class SpriteRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Draw a named sprite centered at (cx, cy).
   * @param {string} type     - 'duck' | 'alien' | 'cake' | 'bag'
   * @param {number} cx       - center x in canvas pixels
   * @param {number} cy       - center y in canvas pixels
   * @param {number} pixelSize - canvas pixels per sprite pixel (can be fractional during tweens)
   * @param {number} opacity  - 0.0–1.0
   */
  drawSprite(type, cx, cy, pixelSize, opacity = 1) {
    const grid    = SPRITE_DATA[type];
    const palette = PALETTES[type];
    if (!grid || !palette || pixelSize <= 0 || opacity <= 0) return;

    const rows   = grid.length;
    const cols   = grid[0].length;
    const startX = cx - (cols * pixelSize) / 2;
    const startY = cy - (rows * pixelSize) / 2;

    const prevAlpha      = this.ctx.globalAlpha;
    this.ctx.globalAlpha = prevAlpha * opacity;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = grid[r][c];
        if (key === '.') continue;
        const color = palette[key];
        if (!color) continue;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
          Math.floor(startX + c * pixelSize),
          Math.floor(startY + r * pixelSize),
          Math.max(1, Math.ceil(pixelSize)),
          Math.max(1, Math.ceil(pixelSize))
        );
      }
    }

    this.ctx.globalAlpha = prevAlpha;
  }
}
