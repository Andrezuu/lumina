import { useEffect, useRef, useState } from 'react';
import { useAudioStream } from './useAudioStream';
import { buildChromagram } from '../lib/chromagram';
import { detectChord, ChordResult } from '../lib/chordDetection';
import { detectTonality, TonalityResult } from '../lib/tonality';
import { detectMode, ModeResult } from '../lib/mode';

// A chord must persist for this many consecutive frames before being confirmed.
// 2 frames × 300 ms = 600 ms minimum duration.
const CONFIRM_FRAMES = 2;

// Keep this many confirmed chord events for tonality/mode analysis.
const CHORD_HISTORY_SIZE = 4;

// Do not compute tonality or mode until this many confirmed chords exist.
// One chord cannot distinguish a key from its relative major/minor.
const MIN_CHORDS_FOR_ANALYSIS = 2;

// ---------------------------------------------------------------------------
// Private types
// ---------------------------------------------------------------------------

interface PendingChord {
  chord: ChordResult;
  frameCount: number;
  accumChroma: Float32Array; // running sum — divide by frameCount to get average
}

interface ConfirmedChordEvent {
  chord: ChordResult;
  representativeChroma: Float32Array; // running average, updated while chord is held
  totalFrames: number;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ChordDetectionState {
  chord: ChordResult | null;
  chroma: Float32Array | null;
  tonality: TonalityResult | null;
  mode: ModeResult | null;
  chordHistory: string[]; // confirmed chord names, oldest → newest
  isRecording: boolean;
  error: string | null;
}

/**
 * High-level hook: audio stream → chromagram → debounced chord → tonality/mode.
 *
 * Chord display updates immediately (1 frame = 300 ms latency).
 * Tonality and mode are derived only from confirmed chord events:
 * a chord must persist for CONFIRM_FRAMES consecutive frames to be confirmed.
 * Both fields remain null until MIN_CHORDS_FOR_ANALYSIS chords are confirmed.
 */
export function useChordDetection(): ChordDetectionState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { samples, isRecording, error, start, stop } = useAudioStream();

  const pendingChordRef    = useRef<PendingChord | null>(null);
  const confirmedChordsRef = useRef<ConfirmedChordEvent[]>([]);

  const [state, setState] = useState<ChordDetectionState>({
    chord: null,
    chroma: null,
    tonality: null,
    mode: null,
    chordHistory: [],
    isRecording: false,
    error: null,
  });

  // Sync recording/error status from the audio stream
  useEffect(() => {
    setState(prev => ({ ...prev, isRecording, error }));
  }, [isRecording, error]);

  // Core processing: runs on every ~300 ms audio chunk
  useEffect(() => {
    if (!samples || samples.length === 0) return;

    // Step 1: build chroma and detect current chord candidate
    const chroma = buildChromagram(samples);
    const chord  = detectChord(chroma);

    // Step 2: debounce — accumulate frames for the pending chord
    const pending = pendingChordRef.current;

    if (pending && pending.chord.chord === chord.chord) {
      pending.frameCount += 1;
      for (let i = 0; i < 12; i++) pending.accumChroma[i] += chroma[i];
    } else {
      pendingChordRef.current = {
        chord,
        frameCount: 1,
        accumChroma: new Float32Array(chroma), // defensive copy
      };
    }

    const currentPending = pendingChordRef.current!;

    // Step 3: confirm chord once it has been stable for CONFIRM_FRAMES frames
    if (currentPending.frameCount >= CONFIRM_FRAMES) {
      const history = confirmedChordsRef.current;
      const tail    = history[history.length - 1];

      if (tail && tail.chord.chord === currentPending.chord.chord) {
        // Continuation of the last confirmed chord: update its running average
        const newTotal = tail.totalFrames + currentPending.frameCount;
        for (let i = 0; i < 12; i++) {
          tail.representativeChroma[i] =
            (tail.representativeChroma[i] * tail.totalFrames +
              currentPending.accumChroma[i]) /
            newTotal;
        }
        tail.totalFrames = newTotal;
      } else {
        // New confirmed chord: compute its initial representative chroma
        const repChroma = new Float32Array(12);
        for (let i = 0; i < 12; i++) {
          repChroma[i] = currentPending.accumChroma[i] / currentPending.frameCount;
        }
        history.push({
          chord:                currentPending.chord,
          representativeChroma: repChroma,
          totalFrames:          currentPending.frameCount,
        });
        if (history.length > CHORD_HISTORY_SIZE) history.shift();
      }

      // Reset so the next distinct chord starts a fresh pending run
      pendingChordRef.current = null;
    }

    // Step 4: derive tonality and mode from confirmed chord history
    let tonality: TonalityResult | null = null;
    let mode: ModeResult | null = null;

    const history = confirmedChordsRef.current;

    if (history.length >= MIN_CHORDS_FOR_ANALYSIS) {
      tonality = detectTonality(history.map(e => e.representativeChroma));

      // Average all confirmed representative chromas for a stable mode input
      const avgChroma = new Float32Array(12);
      for (const e of history) {
        for (let i = 0; i < 12; i++) avgChroma[i] += e.representativeChroma[i];
      }
      for (let i = 0; i < 12; i++) avgChroma[i] /= history.length;

      mode = detectMode(avgChroma, tonality.key);
    }

    // Step 5: update state — chord uses the pending candidate for low latency
    setState(prev => ({
      ...prev,
      chord: currentPending.chord,
      chroma,
      tonality,
      mode,
      chordHistory: confirmedChordsRef.current.map(e => e.chord.chord),
    }));
  }, [samples]);

  // Reset everything when recording stops
  useEffect(() => {
    if (!isRecording) {
      pendingChordRef.current    = null;
      confirmedChordsRef.current = [];
      setState(prev => ({ ...prev, chord: null, chroma: null, tonality: null, mode: null, chordHistory: [] }));
    }
  }, [isRecording]);

  return { ...state, start, stop };
}
