// Krumhansl-Schmuckler key-finding algorithm
// Reference: Krumhansl (1990) "Cognitive Foundations of Musical Pitch"

export interface TonalityResult {
  key: string;
  mode: 'major' | 'minor';
  correlation: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler tonal hierarchy profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(profile: number[], chroma: Float32Array, rootOffset: number): number {
  const n = 12;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += profile[i];
    sumY += chroma[(i + rootOffset) % 12];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = profile[i] - meanX;
    const dy = chroma[(i + rootOffset) % 12] - meanY;
    num += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const den = Math.sqrt(varX * varY);
  return den === 0 ? 0 : num / den;
}

/**
 * Estimates the musical key from a history of chroma vectors
 * using the Krumhansl-Schmuckler algorithm.
 */
export function detectTonality(chromaHistory: Float32Array[]): TonalityResult {
  if (chromaHistory.length === 0) {
    return { key: 'C', mode: 'major', correlation: 0 };
  }

  // Average chroma over the history window
  const avg = new Float32Array(12);
  for (const c of chromaHistory) {
    for (let i = 0; i < 12; i++) avg[i] += c[i];
  }
  for (let i = 0; i < 12; i++) avg[i] /= chromaHistory.length;

  let bestKey = 'C';
  let bestMode: 'major' | 'minor' = 'major';
  let bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    const majorCorr = pearson(MAJOR_PROFILE, avg, root);
    const minorCorr = pearson(MINOR_PROFILE, avg, root);

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestKey = NOTE_NAMES[root];
      bestMode = 'major';
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestKey = NOTE_NAMES[root];
      bestMode = 'minor';
    }
  }

  return { key: bestKey, mode: bestMode, correlation: bestCorr };
}
