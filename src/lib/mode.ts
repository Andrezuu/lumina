// Church modes + harmonic/melodic minor detection via chroma template matching

export type Mode =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'harmonic_minor'
  | 'melodic_minor';

export interface ModeResult {
  mode: Mode;
  confidence: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale templates: 1 = scale degree present, 0 = absent (relative to root)
const MODE_TEMPLATES: Record<Mode, number[]> = {
  ionian:         [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
  dorian:         [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0],
  phrygian:       [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0],
  lydian:         [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  mixolydian:     [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
  aeolian:        [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0],
  locrian:        [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
  harmonic_minor: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1],
  melodic_minor:  [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1],
};

/**
 * Identifies the mode of a chroma vector given the detected key root.
 * Correlates the chroma against each mode's scale template.
 */
export function detectMode(chroma: Float32Array, key: string): ModeResult {
  const rootIndex = NOTE_NAMES.indexOf(key);
  if (rootIndex === -1) return { mode: 'ionian', confidence: 0 };

  let bestMode: Mode = 'ionian';
  let bestScore = -Infinity;

  for (const [modeName, template] of Object.entries(MODE_TEMPLATES) as [Mode, number[]][]) {
    let score = 0;
    for (let i = 0; i < 12; i++) {
      score += template[i] * chroma[(i + rootIndex) % 12];
    }
    if (score > bestScore) {
      bestScore = score;
      bestMode = modeName;
    }
  }

  const maxPossible = MODE_TEMPLATES[bestMode].reduce((a, b) => a + b, 0);
  const confidence = maxPossible > 0 ? bestScore / maxPossible : 0;

  return { mode: bestMode, confidence };
}
