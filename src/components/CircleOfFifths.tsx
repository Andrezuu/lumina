import { Dimensions } from 'react-native';
import Svg, { Circle, G, Path, Text } from 'react-native-svg';

import type { ChordResult } from '../lib/chordDetection';
import type { TonalityResult } from '../lib/tonality';
import {
  MAJOR_DETECTION_ROOT,
  MAJOR_DISPLAY,
  MINOR_DETECTION_ROOT,
  MINOR_DISPLAY,
  getPosition,
  labelPosition,
  parseChordForCircle,
  segmentPath,
} from '../lib/circleOfFifths';

// ---------------------------------------------------------------------------
// Geometry constants — computed once at module load
// ---------------------------------------------------------------------------

const OUTER_R       = 150;
const MID_R         = 100; // boundary between outer and inner ring
const INNER_R       = 65;
const GAP_DEG       = 1.5;
const OUTER_LABEL_R = (OUTER_R + MID_R) / 2;   // 125
const INNER_LABEL_R = (MID_R + INNER_R) / 2;    // 82.5

/** All 24 arc path strings — precomputed, never recomputed. */
const OUTER_PATHS = Array.from({ length: 12 }, (_, i) =>
  segmentPath(i, OUTER_R, MID_R, GAP_DEG),
);
const INNER_PATHS = Array.from({ length: 12 }, (_, i) =>
  segmentPath(i, MID_R, INNER_R, GAP_DEG),
);

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const C = {
  ring:         '#12121c',
  ringBorder:   '#1e1e2e',
  keyMajor:     '#7c3aed',   // active tonality major
  keyMinor:     '#9d5cf0',   // active tonality minor
  chordAmber:   '#f59e0b',   // current detected chord root
  trail:        ['#f59e0b28', '#f59e0b44', '#f59e0b70'] as string[], // old → new
  center:       '#0e0e18',
  label:        '#42425a',
  labelOnKey:   '#e9d8fd',
  labelOnChord: '#ffffff',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CircleOfFifthsProps {
  tonality:          TonalityResult | null;
  chord:             ChordResult | null;
  chordHistory:      string[];   // confirmed chord names, oldest → newest
  onSegmentPress:    (root: string, mode: 'major' | 'minor') => void;
  manualMode:        boolean;
  customProgression: string[];
  onManualAdd:       (label: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CircleOfFifths({
  tonality,
  chord,
  chordHistory,
  onSegmentPress,
  manualMode,
  onManualAdd,
}: CircleOfFifthsProps) {

  const SIZE = Math.min(Dimensions.get('window').width - 32, 320);

  // ---- Derive visual state from props ------------------------------------ //

  const activeKeyPos  = tonality ? getPosition(tonality.key, tonality.mode) : -1;
  const activeKeyMode = tonality?.mode ?? 'major';

  // Current chord position — decide ring (major vs minor) from quality
  let activeChordPos  = -1;
  let activeChordRing: 'major' | 'minor' = 'major';
  if (chord) {
    const isMinorQuality =
      chord.quality.startsWith('m') && !chord.quality.startsWith('maj');
    activeChordRing = isMinorQuality ? 'minor' : 'major';
    activeChordPos  = getPosition(chord.root, activeChordRing);
  }

  // History trail: all entries except the newest (it overlaps activeChord)
  const trailEntries = (
    chordHistory.slice(0, -1).map((name, i, arr) => {
      const parsed = parseChordForCircle(name);
      if (!parsed) return null;
      const pos = getPosition(parsed.root, parsed.mode);
      if (pos < 0) return null;
      // Opacity increases towards newest: oldest trail entry → darkest
      const colorIdx = Math.max(0, C.trail.length - (arr.length - i));
      return { pos, mode: parsed.mode, color: C.trail[colorIdx] };
    }).filter(Boolean) as { pos: number; mode: 'major' | 'minor'; color: string }[]
  );

  // ---- Fill helpers ------------------------------------------------------- //

  function outerFill(i: number): string {
    if (i === activeKeyPos && activeKeyMode === 'major') return C.keyMajor;
    if (i === activeChordPos && activeChordRing === 'major') return C.chordAmber;
    return trailEntries.find(t => t.pos === i && t.mode === 'major')?.color ?? C.ring;
  }

  function innerFill(i: number): string {
    if (i === activeKeyPos && activeKeyMode === 'minor') return C.keyMinor;
    if (i === activeChordPos && activeChordRing === 'minor') return C.chordAmber;
    return trailEntries.find(t => t.pos === i && t.mode === 'minor')?.color ?? C.ring;
  }

  function outerLabelFill(i: number): string {
    if (i === activeKeyPos && activeKeyMode === 'major') return C.labelOnKey;
    if (i === activeChordPos && activeChordRing === 'major') return C.labelOnChord;
    return C.label;
  }

  function innerLabelFill(i: number): string {
    if (i === activeKeyPos && activeKeyMode === 'minor') return C.labelOnKey;
    if (i === activeChordPos && activeChordRing === 'minor') return C.labelOnChord;
    return C.label;
  }

  // ---- Press handler ----------------------------------------------------- //

  function handlePress(index: number, mode: 'major' | 'minor') {
    if (manualMode) {
      const label = mode === 'major' ? MAJOR_DISPLAY[index] : MINOR_DISPLAY[index];
      onManualAdd(label);
    } else {
      const root = mode === 'major'
        ? MAJOR_DETECTION_ROOT[index]
        : MINOR_DETECTION_ROOT[index];
      onSegmentPress(root, mode);
    }
  }

  // ---- Centre label ------------------------------------------------------ //

  const centerLabel = (() => {
    if (!tonality) return null;
    if (activeKeyPos < 0) return null;
    return activeKeyMode === 'major'
      ? MAJOR_DISPLAY[activeKeyPos]
      : MINOR_DISPLAY[activeKeyPos];
  })();

  // ---- Render ------------------------------------------------------------ //

  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox="-150 -150 300 300"
    >
      {/* Outer ring: major keys */}
      {MAJOR_DISPLAY.map((label, i) => {
        const lp = labelPosition(i, OUTER_LABEL_R);
        const isActive =
          (i === activeKeyPos && activeKeyMode === 'major') ||
          (i === activeChordPos && activeChordRing === 'major');
        return (
          <G key={`maj-${i}`} onPress={() => handlePress(i, 'major')}>
            <Path
              d={OUTER_PATHS[i]}
              fill={outerFill(i)}
              stroke={C.ringBorder}
              strokeWidth={0.5}
            />
            <Text
              x={lp.x}
              y={lp.y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={isActive ? 13 : 11}
              fontWeight={isActive ? '700' : '400'}
              fill={outerLabelFill(i)}
            >
              {label}
            </Text>
          </G>
        );
      })}

      {/* Inner ring: relative minor keys */}
      {MINOR_DISPLAY.map((label, i) => {
        const lp = labelPosition(i, INNER_LABEL_R);
        const isActive =
          (i === activeKeyPos && activeKeyMode === 'minor') ||
          (i === activeChordPos && activeChordRing === 'minor');
        return (
          <G key={`min-${i}`} onPress={() => handlePress(i, 'minor')}>
            <Path
              d={INNER_PATHS[i]}
              fill={innerFill(i)}
              stroke={C.ringBorder}
              strokeWidth={0.5}
            />
            <Text
              x={lp.x}
              y={lp.y}
              dy="0.35em"
              textAnchor="middle"
              fontSize={isActive ? 10 : 8}
              fontWeight={isActive ? '700' : '400'}
              fill={innerLabelFill(i)}
            >
              {label}
            </Text>
          </G>
        );
      })}

      {/* Centre */}
      <Circle
        cx={0}
        cy={0}
        r={INNER_R}
        fill={C.center}
        stroke={C.ringBorder}
        strokeWidth={0.5}
      />
      {centerLabel && (
        <Text
          x={0}
          y={0}
          dy="0.35em"
          textAnchor="middle"
          fontSize={20}
          fontWeight="200"
          fill="#c0c0d0"
        >
          {centerLabel}
        </Text>
      )}
    </Svg>
  );
}
