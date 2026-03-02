/**
 * UIController manages all DOM elements:
 *   - HUD (level, score, progress)
 *   - Answer buttons
 *   - Level-complete overlay screen
 */
export class UIController {
  constructor(game) {
    this.game = game;

    this._hudLevel    = document.getElementById('level-label');
    this._hudScore    = document.getElementById('score-label');
    this._hudProgress = document.getElementById('progress-label');
    this._buttonGrid  = document.getElementById('button-grid');
    this._lcScreen    = document.getElementById('level-complete-screen');
    this._lcTitle     = document.getElementById('lc-title');
    this._lcScore     = document.getElementById('lc-score');
    this._lcBtn       = document.getElementById('lc-btn');
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────

  updateHUD(level, score, correct, total) {
    this._hudLevel.textContent    = `LEVEL ${level}`;
    this._hudScore.textContent    = `SCORE: ${score}`;
    this._hudProgress.textContent = `${correct} / ${total}`;
  }

  // ── Answer Buttons ───────────────────────────────────────────────────────────

  renderButtons(choices) {
    this._buttonGrid.innerHTML = '';
    for (const val of choices) {
      const btn        = document.createElement('button');
      btn.className    = 'answer-btn';
      btn.textContent  = String(val);
      btn.dataset.value = String(val);
      btn.addEventListener('click', () => this.game.onAnswerSelected(val));
      this._buttonGrid.appendChild(btn);
    }
  }

  setButtonsDisabled(disabled) {
    for (const btn of this._buttons()) {
      if (disabled) btn.classList.add('disabled');
      else          btn.classList.remove('disabled');
    }
  }

  /** Flash a specific wrong-answer button with shake + red animation. */
  shakeWrongButton(value) {
    for (const btn of this._buttons()) {
      if (parseInt(btn.dataset.value) === value) {
        // Remove class first to restart the animation even if already running
        btn.classList.remove('shake');
        void btn.offsetWidth;  // force reflow
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 450);
      }
    }
  }

  /** Briefly highlight the correct button then disable all. */
  highlightCorrectButton(value) {
    for (const btn of this._buttons()) {
      if (parseInt(btn.dataset.value) === value) {
        btn.classList.add('correct-flash');
      } else {
        btn.classList.add('disabled');
      }
    }
  }

  // ── Level Complete Screen ────────────────────────────────────────────────────

  showLevelComplete(completedLevel, score, onNext) {
    this._lcTitle.textContent = `LEVEL ${completedLevel} CLEAR!`;
    this._lcScore.textContent = `Score: ${score}`;
    this._lcScreen.classList.remove('hidden');

    // Replace handler (avoids stacking multiple click listeners)
    this._lcBtn.onclick = () => {
      this._lcScreen.classList.add('hidden');
      onNext();
    };
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _buttons() {
    return this._buttonGrid.querySelectorAll('.answer-btn');
  }
}
