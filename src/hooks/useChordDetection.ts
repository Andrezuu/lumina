import { useEffect, useRef, useState } from 'react';
import { useAudioStream } from './useAudioStream';
import { buildChromagram, computeRMS } from '../lib/chromagram';
import { detectChord, ChordResult } from '../lib/chordDetection';
import { detectTonality, TonalityResult } from '../lib/tonality';
import { detectMode, ModeResult } from '../lib/mode';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/**
 * Minimum signal level in dBFS to consider audio "active".
 * Below this threshold the frame is treated as silence and ignored.
 * Typical values: -40 dB (sensitive) to -25 dB (strict).
 */
const SILENCE_GATE_DB = -38;

/**
 * Minimum chord confidence [0–1] required to accept a detection.
 * Below this the chord is discarded even if the signal is loud enough.
 * Typical values: 0.55 (lenient) to 0.70 (strict).
 */
const MIN_CONFIDENCE = 0.58;

/**
 * Sliding window size (in frames) used for majority-vote smoothing.
 * The chord with the most votes in the last VOTE_WINDOW frames is displayed.
 * 5 frames × 300 ms = 1.5 s window.
 */
const VOTE_WINDOW = 5;

/**
 * A chord must win the vote AND appear at least this many times in the window
 * before it is promoted to the confirmed list.
 */
const MIN_VOTES_TO_CONFIRM = 3;

// Keep this many confirmed chord events for tonality/mode analysis.
const CHORD_HISTORY_SIZE = 4;

// Do not compute tonality or mode until this many confirmed chords exist.
const MIN_CHORDS_FOR_ANALYSIS = 2;

// ---------------------------------------------------------------------------
// Private types
// ---------------------------------------------------------------------------

interface ConfirmedChordEvent {
  chord: ChordResult;
  representativeChroma: Float32Array;
  totalFrames: number;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ChordHistoryEntry {
  /** Detected chord name (may be overridden by user) */
  chord: string;
  /** True if the user manually edited this entry */
  edited: boolean;
}

export interface ChordDetectionState {
  chord: ChordResult | null;
  chroma: Float32Array | null;
  tonality: TonalityResult | null;
  mode: ModeResult | null;
  chordHistory: ChordHistoryEntry[];
  /** Current signal level in dBFS — useful for a VU meter in the UI */
  rmsDb: number;
  /** True when the signal is above the silence gate */
  hasSignal: boolean;
  isRecording: boolean;
  error: string | null;
}

/**
 * High-level hook: audio stream → chromagram → gated + smoothed chord → tonality/mode.
 *
 * Three-layer quality gate:
 *  1. Silence gate   — frames below SILENCE_GATE_DB are discarded entirely.
 *  2. Confidence gate — detections below MIN_CONFIDENCE are discarded.
 *  3. Majority vote  — the displayed chord must win VOTE_WINDOW frames by
 *                      at least MIN_VOTES_TO_CONFIRM votes.
 */
export function useChordDetection(): ChordDetectionState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  resetHistory: () => void;
  editChord: (index: number, newChord: string) => void;
} {
  const { samples, isRecording, error, start, stop } = useAudioStream();

  // Sliding window of recent chord names (null = silent / low-confidence frame)
  const voteWindowRef      = useRef<(string | null)[]>([]);
  const confirmedChordsRef = useRef<ConfirmedChordEvent[]>([]);
  // Keep the last valid chroma per chord for tonality averaging
  const chordChromaMapRef  = useRef<Map<string, Float32Array>>(new Map());

  const [state, setState] = useState<ChordDetectionState>({
    chord:       null,
    chroma:      null,
    tonality:    null,
    mode:        null,
    chordHistory: [],
    rmsDb:       -Infinity,
    hasSignal:   false,
    isRecording: false,
    error:       null,
  });

  useEffect(() => {
    setState(prev => ({ ...prev, isRecording, error }));
  }, [isRecording, error]);

  useEffect(() => {
    if (!samples || samples.length === 0) return;

    // ── Gate 1: silence ────────────────────────────────────────────────────
    const rmsDb    = computeRMS(samples);
    const hasSignal = rmsDb >= SILENCE_GATE_DB;

    if (!hasSignal) {
      // Keep UI rmsDb live so a VU meter can still animate
      setState(prev => ({ ...prev, rmsDb, hasSignal: false }));
      voteWindowRef.current.push(null);
      if (voteWindowRef.current.length > VOTE_WINDOW) voteWindowRef.current.shift();
      return;
    }

    // ── Step 2: build chroma + detect ──────────────────────────────────────
    const chroma = buildChromagram(samples);
    const chord  = detectChord(chroma, rmsDb);

    // ── Gate 2: confidence ─────────────────────────────────────────────────
    const candidate = chord.confidence >= MIN_CONFIDENCE ? chord.chord : null;

    // ── Gate 3: majority vote over sliding window ──────────────────────────
    const window = voteWindowRef.current;
    window.push(candidate);
    if (window.length > VOTE_WINDOW) window.shift();

    // Tally votes (ignore nulls)
    const tally = new Map<string, number>();
    for (const c of window) {
      if (c !== null) tally.set(c, (tally.get(c) ?? 0) + 1);
    }

    let winnerId: string | null = null;
    let winnerVotes = 0;
    tally.forEach((votes, id) => {
      if (votes > winnerVotes) { winnerVotes = votes; winnerId = id; }
    });

    const smoothedChord: ChordResult | null =
      winnerId !== null && winnerVotes >= MIN_VOTES_TO_CONFIRM
        ? { ...chord, chord: winnerId }
        : null;

    // Store representative chroma per chord name for tonality
    if (smoothedChord) {
      chordChromaMapRef.current.set(smoothedChord.chord, chroma);
    }

    // ── Confirm chord for tonality/mode analysis ───────────────────────────
    if (smoothedChord && winnerVotes >= MIN_VOTES_TO_CONFIRM) {
      const history = confirmedChordsRef.current;
      const tail    = history[history.length - 1];

      if (tail && tail.chord.chord === smoothedChord.chord) {
        tail.totalFrames += 1;
        for (let i = 0; i < 12; i++) {
          tail.representativeChroma[i] =
            (tail.representativeChroma[i] * (tail.totalFrames - 1) + chroma[i]) /
            tail.totalFrames;
        }
      } else {
        history.push({
          chord:                smoothedChord,
          representativeChroma: new Float32Array(chroma),
          totalFrames:          1,
        });
        if (history.length > CHORD_HISTORY_SIZE) history.shift();
      }
    }

    // ── Tonality + mode from confirmed history ─────────────────────────────
    let tonality: TonalityResult | null = null;
    let mode: ModeResult | null = null;

    const history = confirmedChordsRef.current;
    if (history.length >= MIN_CHORDS_FOR_ANALYSIS) {
      tonality = detectTonality(history.map(e => e.representativeChroma));
      const avgChroma = new Float32Array(12);
      for (const e of history) {
        for (let i = 0; i < 12; i++) avgChroma[i] += e.representativeChroma[i];
      }
      for (let i = 0; i < 12; i++) avgChroma[i] /= history.length;
      mode = detectMode(avgChroma, tonality.key);
    }

    setState(prev => ({
      ...prev,
      chord:       smoothedChord ?? prev.chord,
      chroma,
      tonality,
      mode,
      chordHistory: confirmedChordsRef.current.map(e => ({ chord: e.chord.chord, edited: false })),
      rmsDb,
      hasSignal,
    }));
  }, [samples]);

  useEffect(() => {
    if (!isRecording) {
      voteWindowRef.current      = [];
      confirmedChordsRef.current = [];
      chordChromaMapRef.current  = new Map();
      setState(prev => ({
        ...prev,
        chord: null, chroma: null, tonality: null, mode: null,
        chordHistory: [], rmsDb: -Infinity, hasSignal: false,
      }));
    }
  }, [isRecording]);

  const resetHistory = () => {
    voteWindowRef.current      = [];
    confirmedChordsRef.current = [];
    chordChromaMapRef.current  = new Map();
    setState(prev => ({
      ...prev,
      chord: null, chroma: null, tonality: null, mode: null,
      chordHistory: [], rmsDb: -Infinity, hasSignal: false,
    }));
  };

  /** Replaces the chord name at `index` in the visible history without losing the progression. */
  const editChord = (index: number, newChord: string) => {
    setState(prev => {
      const updated = prev.chordHistory.map((entry, i) =>
        i === index ? { chord: newChord, edited: true } : entry,
      );
      return { ...prev, chordHistory: updated };
    });
  };

  return { ...state, start, stop, resetHistory, editChord };
}
