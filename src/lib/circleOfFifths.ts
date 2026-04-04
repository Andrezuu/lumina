// Circle of Fifths — data, geometry, and music-theory helpers
// Positions 0-11, clockwise from top:
//   0=C/Am  1=G/Em  2=D/Bm  3=A/F#m  4=E/C#m  5=B/G#m
//   6=F#/D#m  7=Db/Bbm  8=Ab/Fm  9=Eb/Cm  10=Bb/Gm  11=F/Dm

import { Key } from 'tonal';

// ---------------------------------------------------------------------------
// Data arrays
// ---------------------------------------------------------------------------

/** Labels shown on the outer (major) ring. Uses flat notation for the flat side. */
export const MAJOR_DISPLAY = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'] as const;

/** Labels shown on the inner (minor) ring. */
export const MINOR_DISPLAY = ['Am','Em','Bm','F#m','C#m','G#m','D#m','Bbm','Fm','Cm','Gm','Dm'] as const;

/**
 * Detection-notation roots for each major position (sharps only, matching
 * the output of chordDetection.ts / tonality.ts).
 */
export const MAJOR_DETECTION_ROOT = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','F'] as const;

/**
 * Detection-notation roots for each minor position.
 * MINOR_DETECTION_ROOT[i] is the root of the relative minor at position i.
 */
export const MINOR_DETECTION_ROOT = ['A','E','B','F#','C#','G#','D#','A#','F','C','G','D'] as const;

// Precalculate lookup maps for O(1) position lookup
const MAJOR_POS_MAP: Record<string, number> = {};
MAJOR_DETECTION_ROOT.forEach((n, i) => { MAJOR_POS_MAP[n] = i; });

const MINOR_POS_MAP: Record<string, number> = {};
MINOR_DETECTION_ROOT.forEach((n, i) => { MINOR_POS_MAP[n] = i; });

// Conversion for tonal's Key API (which prefers flat notation for major keys)
const SHARP_TO_TONAL_MAJOR: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'G#': 'Ab',
  'A#': 'Bb',
};

// ---------------------------------------------------------------------------
// Position mapping
// ---------------------------------------------------------------------------

/**
 * Returns the circle position (0-11) for a detected root + mode.
 * Returns -1 if the root is not found.
 */
export function getPosition(root: string, mode: 'major' | 'minor'): number {
  return mode === 'major'
    ? (MAJOR_POS_MAP[root] ?? -1)
    : (MINOR_POS_MAP[root] ?? -1);
}

// ---------------------------------------------------------------------------
// SVG geometry
// ---------------------------------------------------------------------------

/** Convert degrees to radians. */
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Cartesian point on a circle of radius r at angle deg (0° = right, clockwise). */
const pt = (deg: number, r: number): [number, number] => [
  parseFloat((r * Math.cos(toRad(deg))).toFixed(4)),
  parseFloat((r * Math.sin(toRad(deg))).toFixed(4)),
];

/**
 * Builds the SVG path string for a donut-slice segment.
 *
 * @param index    Segment index 0-11 (clockwise from top)
 * @param outerR   Outer radius of the ring
 * @param innerR   Inner radius of the ring
 * @param gapDeg   Gap to leave on each side of the segment (degrees, default 1.5)
 */
export function segmentPath(
  index: number,
  outerR: number,
  innerR: number,
  gapDeg = 1.5,
): string {
  const s = -90 + index * 30 + gapDeg;
  const e = -90 + (index + 1) * 30 - gapDeg;

  const [ox1, oy1] = pt(s, outerR);
  const [ox2, oy2] = pt(e, outerR);
  const [ix2, iy2] = pt(e, innerR);
  const [ix1, iy1] = pt(s, innerR);

  // largeArc = 0 because span (27°) < 180°
  return (
    `M ${ox1} ${oy1} ` +
    `A ${outerR} ${outerR} 0 0 1 ${ox2} ${oy2} ` +
    `L ${ix2} ${iy2} ` +
    `A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1} Z`
  );
}

/**
 * Returns the (x, y) coordinates for a label centred within a segment.
 *
 * @param index  Segment index 0-11
 * @param r      Radius at which to place the label (use ring midpoint)
 */
export function labelPosition(index: number, r: number): { x: number; y: number } {
  const angle = -90 + index * 30 + 15; // midpoint of the 30° segment
  return {
    x: parseFloat((r * Math.cos(toRad(angle))).toFixed(2)),
    y: parseFloat((r * Math.sin(toRad(angle))).toFixed(2)),
  };
}

// ---------------------------------------------------------------------------
// Chord parsing helper
// ---------------------------------------------------------------------------

/**
 * Extracts the root and mode from a chord name string (e.g. "Am7" → {root:"A", mode:"minor"}).
 * Returns null for unrecognised formats.
 */
export function parseChordForCircle(
  chordName: string,
): { root: string; mode: 'major' | 'minor' } | null {
  const m = chordName.match(/^([A-G][#b]?)/);
  if (!m) return null;
  const root = m[1];
  const rest = chordName.slice(root.length);
  // "m" prefix indicates minor, except "maj"
  const isMinor = rest.startsWith('m') && !rest.startsWith('maj');
  return { root, mode: isMinor ? 'minor' : 'major' };
}

// ---------------------------------------------------------------------------
// Music theory: key info for the chord-info panel
// ---------------------------------------------------------------------------

export interface KeyInfo {
  displayName: string; // e.g. "Db mayor", "G#m menor"
  scale: string[];     // 7 scale notes
  chords: string[];    // 7 diatonic 7th chords
  triads: string[];    // 7 diatonic triads
}

/**
 * Builds the key info object for a given root + mode.
 * Used when the user taps a circle segment.
 */
export function getKeyInfo(root: string, mode: 'major' | 'minor'): KeyInfo {
  const pos = getPosition(root, mode);

  const displayLabel =
    mode === 'major'
      ? (pos >= 0 ? MAJOR_DISPLAY[pos] : root)
      : (pos >= 0 ? MINOR_DISPLAY[pos] : root + 'm');

  // tonal prefers flat notation for major keys
  const tonalRoot =
    mode === 'major' ? (SHARP_TO_TONAL_MAJOR[root] ?? root) : root;

  if (mode === 'major') {
    const k = Key.majorKey(tonalRoot);
    return {
      displayName: `${displayLabel} mayor`,
      scale:  [...k.scale],
      chords: [...k.chords],
      triads: [...k.triads],
    };
  } else {
    const k = Key.minorKey(tonalRoot);
    return {
      displayName: `${displayLabel} menor`,
      scale:  [...k.natural.scale],
      chords: [...k.natural.chords],
      triads: [...k.natural.triads],
    };
  }
}
