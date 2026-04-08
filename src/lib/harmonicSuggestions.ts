/**
 * harmonicSuggestions.ts
 *
 * Suggests probable next chords given a detected progression + tonality.
 *
 * Theory model
 * ────────────
 * 1.  Diatonic function table  — maps each scale degree (I–VII) to its
 *     standard diatonic triad quality and Roman numeral label.
 * 2.  Transition matrix        — probability of moving from degree X to
 *     degree Y, based on common-practice tonal harmony rules.
 * 3.  Voice-leading bonus      — chords whose roots are a 4th/5th away
 *     from the current chord get a small extra weight (strongest motion).
 * 4.  Last-chord context       — the algorithm reads the last 1–3 confirmed
 *     chords and accumulates weighted transition scores.
 *
 * Output: up to N `ChordSuggestion` objects sorted by descending score.
 */

import type { TonalityResult } from './tonality';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChordSuggestion {
  chord: string;          // e.g. "Am", "G7", "Fmaj7"
  root: string;           // e.g. "A"
  quality: string;        // e.g. "minor", "dom7"
  degree: string;         // Roman numeral label, e.g. "vi", "V7"
  function: HarmonicFunction;
  score: number;          // 0–1 normalised
}

export type HarmonicFunction = 'tonic' | 'subdominant' | 'dominant' | 'leading';

// ---------------------------------------------------------------------------
// Chromatic note helpers
// ---------------------------------------------------------------------------

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
type Note = typeof NOTES[number];

function noteIndex(n: string): number {
  return NOTES.indexOf(n as Note);
}

function noteAt(root: string, semitones: number): string {
  const idx = noteIndex(root);
  if (idx === -1) return root;
  return NOTES[(idx + semitones + 12) % 12];
}

// ---------------------------------------------------------------------------
// Diatonic scale intervals (semitones from root for each degree)
// ---------------------------------------------------------------------------

const MAJOR_INTERVALS  = [0, 2, 4, 5, 7, 9, 11]; // W W H W W W H
const MINOR_INTERVALS  = [0, 2, 3, 5, 7, 8, 10]; // natural minor

// Quality of each diatonic triad per mode
//   'M' = major, 'm' = minor, 'd' = diminished
const MAJOR_QUALITIES  = ['M', 'm', 'm', 'M', 'M', 'm', 'd'] as const;
const MINOR_QUALITIES  = ['m', 'd', 'M', 'm', 'm', 'M', 'M'] as const;

// Roman numeral labels per mode
const MAJOR_ROMAN = ['I',  'ii', 'iii', 'IV', 'V',  'vi', 'vii°'] as const;
const MINOR_ROMAN = ['i',  'ii°','III', 'iv', 'v',  'VI', 'VII' ] as const;

// Harmonic function bucket per diatonic degree (0-based)
const MAJOR_FUNCTION: HarmonicFunction[] = [
  'tonic',       // I
  'subdominant', // ii
  'tonic',       // iii
  'subdominant', // IV
  'dominant',    // V
  'tonic',       // vi
  'leading',     // vii°
];
const MINOR_FUNCTION: HarmonicFunction[] = [
  'tonic',       // i
  'leading',     // ii°
  'tonic',       // III
  'subdominant', // iv
  'dominant',    // v
  'subdominant', // VI
  'dominant',    // VII
];

// ---------------------------------------------------------------------------
// Transition matrix  (degree → degree probability weight)
// Rows = "from degree" (0-indexed I–VII), Cols = "to degree"
// Based on common-practice harmonic progressions.
// ---------------------------------------------------------------------------

const MAJOR_TRANSITIONS: number[][] = [
  //  I    ii   iii  IV   V    vi  vii
  [0.05, 0.25, 0.10, 0.20, 0.30, 0.08, 0.02], // from I
  [0.05, 0.00, 0.05, 0.15, 0.60, 0.10, 0.05], // from ii  → V is king
  [0.05, 0.10, 0.00, 0.20, 0.35, 0.25, 0.05], // from iii
  [0.10, 0.10, 0.05, 0.05, 0.55, 0.10, 0.05], // from IV  → V
  [0.60, 0.10, 0.05, 0.10, 0.05, 0.08, 0.02], // from V   → I resolves
  [0.15, 0.25, 0.10, 0.20, 0.20, 0.05, 0.05], // from vi
  [0.70, 0.10, 0.05, 0.05, 0.05, 0.03, 0.02], // from vii → I resolves
];

const MINOR_TRANSITIONS: number[][] = [
  //  i    ii°  III  iv   v    VI   VII
  [0.05, 0.15, 0.10, 0.25, 0.25, 0.15, 0.05], // from i
  [0.05, 0.00, 0.05, 0.10, 0.65, 0.10, 0.05], // from ii° → v
  [0.10, 0.10, 0.00, 0.20, 0.30, 0.20, 0.10], // from III
  [0.15, 0.10, 0.05, 0.05, 0.50, 0.10, 0.05], // from iv  → v
  [0.55, 0.10, 0.05, 0.15, 0.05, 0.05, 0.05], // from v   → i
  [0.20, 0.15, 0.15, 0.20, 0.20, 0.05, 0.05], // from VI
  [0.45, 0.10, 0.10, 0.15, 0.10, 0.05, 0.05], // from VII → i
];

// ---------------------------------------------------------------------------
// Quality suffix for chord names
// ---------------------------------------------------------------------------

function qualitySuffix(q: 'M' | 'm' | 'd'): string {
  if (q === 'M') return '';
  if (q === 'm') return 'm';
  return 'dim';
}

// ---------------------------------------------------------------------------
// Build diatonic chord table for a given tonality
// ---------------------------------------------------------------------------

interface DiatonicChord {
  root: string;
  quality: 'M' | 'm' | 'd';
  chord: string;
  degree: string;
  function: HarmonicFunction;
  degreeIndex: number; // 0-based
}

function buildDiatonicTable(key: string, mode: 'major' | 'minor'): DiatonicChord[] {
  const intervals  = mode === 'major' ? MAJOR_INTERVALS  : MINOR_INTERVALS;
  const qualities  = mode === 'major' ? MAJOR_QUALITIES  : MINOR_QUALITIES;
  const romans     = mode === 'major' ? MAJOR_ROMAN      : MINOR_ROMAN;
  const functions  = mode === 'major' ? MAJOR_FUNCTION   : MINOR_FUNCTION;

  return intervals.map((semitones, i) => {
    const root    = noteAt(key, semitones);
    const quality = qualities[i];
    return {
      root,
      quality,
      chord: root + qualitySuffix(quality),
      degree: romans[i],
      function: functions[i],
      degreeIndex: i,
    };
  });
}

// ---------------------------------------------------------------------------
// Map a detected chord name to a diatonic degree (or -1 if not diatonic)
// ---------------------------------------------------------------------------

function findDegree(chordName: string, table: DiatonicChord[]): number {
  // Normalize: strip extensions beyond triad quality
  const m = chordName.match(/^([A-G][#b]?)(m(?!aj)|dim|aug|sus[24]|maj)?/);
  if (!m) return -1;
  const root = m[1];
  const qualRaw = m[2] ?? '';

  // Map raw quality string to our 3-state quality
  let q: 'M' | 'm' | 'd';
  if (qualRaw === 'm' || qualRaw.startsWith('m')) q = 'm';
  else if (qualRaw === 'dim') q = 'd';
  else q = 'M';

  const match = table.find(dc => dc.root === root && dc.quality === q);
  return match ? match.degreeIndex : -1;
}

// ---------------------------------------------------------------------------
// Voice-leading bonus
// Chords a P4 (5 semitones) or P5 (7 semitones) from the current root
// get a bonus reflecting the strongest harmonic motion.
// ---------------------------------------------------------------------------

function voiceLeadingBonus(fromRoot: string, toRoot: string): number {
  const diff = (noteIndex(toRoot) - noteIndex(fromRoot) + 12) % 12;
  if (diff === 5 || diff === 7) return 0.15; // P4 / P5 motion
  if (diff === 3 || diff === 4) return 0.05; // 3rd motion (common in pop)
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given the last confirmed chords and the detected tonality,
 * returns up to `maxResults` suggested next chords sorted by score.
 *
 * @param chordHistory  Array of confirmed chord names, oldest → newest
 * @param tonality      Detected tonality (key + mode)
 * @param maxResults    Maximum number of suggestions to return (default 4)
 */
export function suggestNextChords(
  chordHistory: string[],
  tonality: TonalityResult,
  maxResults = 4,
): ChordSuggestion[] {
  if (chordHistory.length === 0) return [];

  const table = buildDiatonicTable(tonality.key, tonality.mode);
  const matrix =
    tonality.mode === 'major' ? MAJOR_TRANSITIONS : MINOR_TRANSITIONS;

  // Accumulate scores for each diatonic degree
  const scores = new Float64Array(7);

  // Weight recent chords more: last chord gets 1.0, second-to-last 0.5, etc.
  const lookback = Math.min(3, chordHistory.length);
  for (let offset = 0; offset < lookback; offset++) {
    const chordName = chordHistory[chordHistory.length - 1 - offset];
    const deg = findDegree(chordName, table);
    if (deg === -1) continue;

    const weight = 1 / (offset + 1); // 1.0, 0.5, 0.33
    const row = matrix[deg];
    for (let j = 0; j < 7; j++) {
      scores[j] += row[j] * weight;
    }
  }

  // Voice-leading bonus from the most recent chord
  const lastChord = chordHistory[chordHistory.length - 1];
  const lastRootM = lastChord.match(/^([A-G][#b]?)/);
  const lastRoot  = lastRootM ? lastRootM[1] : '';

  // Build suggestions, skip degrees that are the same as the last chord
  const lastDeg = findDegree(lastChord, table);

  const suggestions: ChordSuggestion[] = table
    .map((dc, i) => {
      if (i === lastDeg) return null; // don't suggest repeating the same chord
      let score = scores[i];
      if (lastRoot) score += voiceLeadingBonus(lastRoot, dc.root);
      return {
        chord: dc.chord,
        root: dc.root,
        quality: dc.quality === 'M' ? 'major' : dc.quality === 'm' ? 'minor' : 'dim',
        degree: dc.degree,
        function: dc.function,
        score,
      } as ChordSuggestion;
    })
    .filter((s): s is ChordSuggestion => s !== null && s.score > 0);

  // Sort descending, normalise scores to [0, 1]
  suggestions.sort((a, b) => b.score - a.score);
  const maxScore = suggestions[0]?.score ?? 1;
  for (const s of suggestions) s.score = maxScore > 0 ? s.score / maxScore : 0;

  return suggestions.slice(0, maxResults);
}

/**
 * Returns ALL 7 diatonic chords of a tonality, useful for the canvas board.
 */
export function getDiatonicChords(tonality: TonalityResult): ChordSuggestion[] {
  const table = buildDiatonicTable(tonality.key, tonality.mode);
  return table.map(dc => ({
    chord: dc.chord,
    root: dc.root,
    quality: dc.quality === 'M' ? 'major' : dc.quality === 'm' ? 'minor' : 'dim',
    degree: dc.degree,
    function: dc.function,
    score: 1,
  }));
}
