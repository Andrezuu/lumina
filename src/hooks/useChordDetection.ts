import { useEffect, useRef, useState } from 'react';
import { useAudioStream } from './useAudioStream';
import { buildChromagram } from '../lib/chromagram';
import { detectChord, ChordResult } from '../lib/chordDetection';
import { detectTonality, TonalityResult } from '../lib/tonality';
import { detectMode, ModeResult } from '../lib/mode';

const CHROMA_HISTORY_SIZE = 20; // ~6 seconds of context for key detection

export interface ChordDetectionState {
  chord: ChordResult | null;
  chroma: Float32Array | null;
  tonality: TonalityResult | null;
  mode: ModeResult | null;
  isRecording: boolean;
  error: string | null;
}

/**
 * High-level hook that wires the audio stream → chromagram → chord/key/mode detection.
 * Emits a new result every ~300 ms (driven by the audio flush interval).
 */
export function useChordDetection(): ChordDetectionState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const { samples, isRecording, error, start, stop } = useAudioStream();
  const chromaHistoryRef = useRef<Float32Array[]>([]);

  const [state, setState] = useState<ChordDetectionState>({
    chord: null,
    chroma: null,
    tonality: null,
    mode: null,
    isRecording: false,
    error: null,
  });

  // Sync recording/error status
  useEffect(() => {
    setState(prev => ({ ...prev, isRecording, error }));
  }, [isRecording, error]);

  // Process new PCM samples
  useEffect(() => {
    if (!samples || samples.length === 0) return;

    const chroma = buildChromagram(samples);
    const chord = detectChord(chroma);

    // Keep a rolling history for key detection
    const history = chromaHistoryRef.current;
    history.push(chroma);
    if (history.length > CHROMA_HISTORY_SIZE) history.shift();

    const tonality = detectTonality(history);
    const mode = detectMode(chroma, tonality.key);

    setState(prev => ({ ...prev, chord, chroma, tonality, mode }));
  }, [samples]);

  // Reset history when stopped
  useEffect(() => {
    if (!isRecording) chromaHistoryRef.current = [];
  }, [isRecording]);

  return { ...state, start, stop };
}
