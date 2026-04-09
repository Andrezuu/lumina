/**
 * useHarmonicEngine.ts
 *
 * Orchestrates all 5 harmonic inference motors in a single memoised hook.
 *
 * Inputs:
 *  - tonality  : locked (or live) tonality from useChordDetection
 *  - history   : confirmed chord names, oldest → newest
 *  - current   : the chord being played right now (from the detector)
 *
 * Output: one object with the results of each motor, ready for the UI.
 * Everything is pure computation — no side effects, no network calls.
 */

import { useMemo } from 'react';
import type { TonalityResult } from '../lib/tonality';
import {
  suggestNextChords,
  modalInterchange,
  secondaryDominants,
  deceptiveCadence,
  textureSuggestions,
  getDiatonicChords,
  type ChordSuggestion,
} from '../lib/harmonicSuggestions';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HarmonicEngineOutput {
  /** Motor 1 — functional next-chord suggestions based on transition matrix */
  diatonic: ChordSuggestion[];
  /** All 7 diatonic chords of the locked tonality (I–VII) */
  diatonicScale: ChordSuggestion[];
  /** Motor 2 — borrowed chords from the parallel mode */
  modal: ChordSuggestion[];
  /** Motor 3 — secondary dominant (V/X) options */
  secondary: ChordSuggestion[];
  /** Motor 4 — deceptive cadence (vi instead of I when V is active) */
  deceptive: ChordSuggestion[];
  /** Motor 5 — textural variations (sus2/sus4/add9/tritone) when chord repeats */
  texture: ChordSuggestion[];
  /** True when at least one motor has suggestions to show */
  hasSuggestions: boolean;
}

const EMPTY: HarmonicEngineOutput = {
  diatonic:       [],
  diatonicScale:  [],
  modal:          [],
  secondary:      [],
  deceptive:      [],
  texture:        [],
  hasSuggestions: false,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param tonality  The active (locked) tonality. Pass null to disable the engine.
 * @param history   Ordered list of confirmed chord names (oldest first).
 * @param current   The chord name currently detected by the audio pipeline.
 */
export function useHarmonicEngine(
  tonality: TonalityResult | null,
  history: string[],
  current: string | null,
): HarmonicEngineOutput {
  return useMemo<HarmonicEngineOutput>(() => {
    if (!tonality || history.length === 0) return EMPTY;

    const diatonic      = suggestNextChords(history, tonality, 4);
    const diatonicScale = getDiatonicChords(tonality);
    const modal         = modalInterchange(tonality);
    const secondary     = secondaryDominants(tonality, current ?? undefined);
    const deceptive     = current ? deceptiveCadence(tonality, current) : [];
    const texture       = textureSuggestions(history, 2);

    const hasSuggestions =
      diatonic.length > 0 ||
      modal.length > 0 ||
      secondary.length > 0 ||
      deceptive.length > 0 ||
      texture.length > 0;

    return { diatonic, diatonicScale, modal, secondary, deceptive, texture, hasSuggestions };
  }, [tonality, history, current]);
}
