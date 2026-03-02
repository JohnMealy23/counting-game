// Level configuration for the counting game

export const LEVELS = [
  // Level 1: count 1-3, 3 answer choices, 5 correct to advance
  { minCount: 1, maxCount: 3,  numButtons: 3, correctToAdvance: 5  },
  // Level 2: count 2-5, 4 choices, 5 to advance
  { minCount: 2, maxCount: 5,  numButtons: 4, correctToAdvance: 5  },
  // Level 3: count 3-7, 4 choices, 6 to advance
  { minCount: 3, maxCount: 7,  numButtons: 4, correctToAdvance: 6  },
  // Level 4: count 5-10, 5 choices, 6 to advance
  { minCount: 5, maxCount: 10, numButtons: 5, correctToAdvance: 6  },
  // Level 5+: count 7-15, 5 choices, 7 to advance (loops)
  { minCount: 7, maxCount: 15, numButtons: 5, correctToAdvance: 7  },
];

export function getLevelConfig(levelIndex) {
  return LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
}

/**
 * Generate an array of answer choices that includes the correct answer
 * and (numButtons - 1) unique distractors.
 */
export function generateAnswerChoices(correct, cfg) {
  const { numButtons } = cfg;
  const choices = new Set([correct]);

  let attempts = 0;
  while (choices.size < numButtons && attempts < 300) {
    attempts++;
    // Pick a distractor within ±5 of the correct answer, minimum 1
    const offset = Math.floor(Math.random() * 5) + 1;
    const sign   = Math.random() < 0.5 ? 1 : -1;
    const candidate = correct + sign * offset;
    if (candidate >= 1 && candidate !== correct) {
      choices.add(candidate);
    }
  }

  // Fallback: pad with sequential numbers starting from 1
  for (let n = 1; choices.size < numButtons; n++) {
    if (n !== correct) choices.add(n);
  }

  // Shuffle
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
