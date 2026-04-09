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

// ---------------------------------------------------------------------------
// Motor 2: Intercambio Modal (Modal Interchange)
// Borrows chords from the parallel minor (if in major) or parallel major
// (if in minor) to add colour to the progression.
// ---------------------------------------------------------------------------

/**
 * Returns diatonic chords from the parallel mode that are NOT already in the
 * current key — the classic "borrowed chord" technique.
 *
 * e.g. In C major → borrows Fm, Ab, Bb, Eb from C minor.
 */
export function modalInterchange(tonality: TonalityResult): ChordSuggestion[] {
  const parallelMode = tonality.mode === 'major' ? 'minor' : 'major';
  const parallelTable = buildDiatonicTable(tonality.key, parallelMode);
  const homeTable     = buildDiatonicTable(tonality.key, tonality.mode);
  const homeRoots     = new Set(homeTable.map(dc => dc.chord));

  return parallelTable
    .filter(dc => !homeRoots.has(dc.chord))
    .map(dc => ({
      chord:    dc.chord,
      root:     dc.root,
      quality:  dc.quality === 'M' ? 'major' : dc.quality === 'm' ? 'minor' : 'dim',
      degree:   `♭${dc.degree}`,   // borrowed degrees often shown with ♭
      function: 'subdominant' as HarmonicFunction,
      score:    0.75,
    }));
}

// ---------------------------------------------------------------------------
// Motor 3: Dominantes Secundarios (Secondary Dominants)
// For each diatonic chord (except the tonic), compute its secondary dominant:
// the major chord a P5 above its root (V/X pattern).
// ---------------------------------------------------------------------------

/**
 * Returns secondary dominant chords (V/X) targeting each non-tonic diatonic degree.
 *
 * If `currentChord` is provided, only returns the secondary dominant of the
 * chord that the current chord is most likely to resolve to (contextual mode).
 * Otherwise returns all secondary dominants.
 */
export function secondaryDominants(
  tonality: TonalityResult,
  currentChord?: string,
): ChordSuggestion[] {
  const table = buildDiatonicTable(tonality.key, tonality.mode);

  // Targets: every diatonic degree except tonic (index 0)
  const targets = table.filter((_, i) => i !== 0);

  const results: ChordSuggestion[] = targets.map(target => {
    // Secondary dominant root = P5 above target root (7 semitones)
    const secDomRoot = noteAt(target.root, 7);
    const chord      = `${secDomRoot}7`;     // always a dominant 7th
    return {
      chord,
      root:     secDomRoot,
      quality:  'dom7',
      degree:   `V7/${target.degree}`,
      function: 'dominant' as HarmonicFunction,
      score:    0.80,
    };
  });

  if (!currentChord) return results;

  // Contextual: boost the secondary dominant that resolves to the chord a diatonic 4th above current
  const currentDeg = findDegree(currentChord, table);
  if (currentDeg === -1) return results;

  // The most natural resolution target is a P4 above (diatonic index + 3)
  const nextTargetIdx = (currentDeg + 3) % 7;

  return results
    .map(r => {
      const targetDeg = targets.find(t => r.root === noteAt(t.root, 7))?.degreeIndex;
      return { ...r, score: targetDeg === nextTargetIdx ? 1.0 : r.score };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Motor 4: Cadencia Deceptiva (Deceptive Cadence)
// When the current chord is a V (or V7), suggest resolving to vi instead of I.
// ---------------------------------------------------------------------------

/**
 * Returns the deceptive cadence target (vi in major, VI in minor) when the
 * current chord is a dominant (V / V7) in the given tonality.
 *
 * Returns an empty array when the current chord is not a dominant.
 */
export function deceptiveCadence(
  tonality: TonalityResult,
  currentChord: string,
): ChordSuggestion[] {
  if (!currentChord) return [];

  const table = buildDiatonicTable(tonality.key, tonality.mode);

  // Check if current chord is the V degree (dominant)
  const normalised = currentChord.replace(/7$/, ''); // strip "7" for triad lookup
  const dominantDeg = tonality.mode === 'major' ? 4 : 4; // V is always index 4

  const isDominant =
    findDegree(currentChord, table) === dominantDeg ||
    findDegree(normalised, table)   === dominantDeg;

  if (!isDominant) return [];

  // vi degree (major) or VI degree (minor) — index 5
  const vi = table[5];
  return [
    {
      chord:    vi.chord,
      root:     vi.root,
      quality:  vi.quality === 'M' ? 'major' : vi.quality === 'm' ? 'minor' : 'dim',
      degree:   `${vi.degree} (engaño)`,
      function: 'tonic' as HarmonicFunction,
      score:    0.90,
    },
  ];
}

// ---------------------------------------------------------------------------
// Motor 5: Sugerencias de Textura (Texture Suggestions)
// When the same chord has been repeated, suggest sus2/sus4 variants or the
// chord a minor 3rd above (colour substitution).
// ---------------------------------------------------------------------------

/**
 * Suggests textural variations when a chord appears ≥ `repeatThreshold` times
 * consecutively in the history.
 *
 * Variants produced:
 *  • sus2  (replace 3rd with major 2nd)
 *  • sus4  (replace 3rd with perfect 4th)
 *  • add9  (add major 2nd without replacing 3rd)
 *  • tritone substitution root (b5 of dominant chords)
 */
export function textureSuggestions(
  chordHistory: string[],
  repeatThreshold = 2,
): ChordSuggestion[] {
  if (chordHistory.length < repeatThreshold) return [];

  // Count how many of the last N chords are the same
  const last = chordHistory[chordHistory.length - 1];
  let streak = 0;
  for (let i = chordHistory.length - 1; i >= 0; i--) {
    if (chordHistory[i] === last) streak++;
    else break;
  }

  if (streak < repeatThreshold) return [];

  const m = last.match(/^([A-G][#b]?)(.*)/);
  if (!m) return [];
  const root    = m[1];
  const quality = m[2];

  const suggestions: ChordSuggestion[] = [
    // sus2 — always applicable
    {
      chord:    `${root}sus2`,
      root,
      quality:  'sus2',
      degree:   'sus2',
      function: 'tonic' as HarmonicFunction,
      score:    0.70,
    },
    // sus4
    {
      chord:    `${root}sus4`,
      root,
      quality:  'sus4',
      degree:   'sus4',
      function: 'tonic' as HarmonicFunction,
      score:    0.65,
    },
    // add9
    {
      chord:    `${root}add9`,
      root,
      quality:  'add9',
      degree:   'add9',
      function: 'tonic' as HarmonicFunction,
      score:    0.60,
    },
  ];

  // Tritone substitution: only for dominant (7th) chords
  if (quality === '7' || quality === 'dom7') {
    const tritoneRoot = noteAt(root, 6); // b5 interval
    suggestions.push({
      chord:    `${tritoneRoot}7`,
      root:     tritoneRoot,
      quality:  'dom7',
      degree:   '♭II7 (tritono)',
      function: 'dominant' as HarmonicFunction,
      score:    0.85,
    });
  }

  return suggestions;
}
