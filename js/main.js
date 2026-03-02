/**
 * Entry point.
 * Wires the Start button to the GameEngine and kicks off the game loop.
 */

import { GameEngine } from './game.js';

window.addEventListener('load', () => {
  const canvas = document.getElementById('game-canvas');
  const game   = new GameEngine(canvas);

  // Begin rendering immediately (shows animated background + bag on start screen)
  game.begin();

  // Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    game.startLevel();
  });
});
