export interface ChordResult {
  chord: string;
  root: string;
  quality: string;
  confidence: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord templates relative to root (semitone intervals present)
const TEMPLATES: Record<string, number[]> = {
  major:      [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  minor:      [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  dom7:       [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  maj7:       [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  min7:       [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  dim:        [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  aug:        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  sus2:       [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  sus4:       [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
};

const QUALITY_SUFFIX: Record<string, string> = {
  major: '',
  minor: 'm',
  dom7:  '7',
  maj7:  'maj7',
  min7:  'm7',
  dim:   'dim',
  aug:   'aug',
  sus2:  'sus2',
  sus4:  'sus4',
};

function templateWeight(template: number[]): number {
  return template.reduce((a, b) => a + b, 0);
}

/**
 * Identifies the most likely chord from a 12-bin chroma vector.
 * Uses normalized dot-product (cosine-like) scoring.
 */
export function detectChord(chroma: Float32Array): ChordResult {
  let bestChord = 'N';
  let bestRoot = 'N';
  let bestQuality = 'none';
  let bestScore = 0;

  for (const [quality, template] of Object.entries(TEMPLATES)) {
    const weight = templateWeight(template);
    for (let root = 0; root < 12; root++) {
      let score = 0;
      for (let i = 0; i < 12; i++) {
        score += template[i] * chroma[(i + root) % 12];
      }
      const confidence = score / weight;
      if (confidence > bestScore) {
        bestScore = confidence;
        bestRoot = NOTE_NAMES[root];
        bestQuality = quality;
        bestChord = NOTE_NAMES[root] + QUALITY_SUFFIX[quality];
      }
    }
  }

  return { chord: bestChord, root: bestRoot, quality: bestQuality, confidence: bestScore };
}
