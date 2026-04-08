/**
 * useCanvasStore.ts
 *
 * Zustand store for the Canvas (Lienzo) tab.
 * Persists to AsyncStorage automatically via the `persist` middleware.
 *
 * Responsibilities
 * ────────────────
 *  • Hold the canonical list of CanvasChord cards.
 *  • Merge new chords arriving from the detector (addFromDetector).
 *  • Allow inline editing, reordering (col/row swap), deletion.
 *  • Persist everything to AsyncStorage so the lienzo survives app restarts.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TonalityResult } from '../lib/tonality';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasChord {
  id: string;
  chord: string;
  col: number;
  row: number;
  /** Added by the user from the suggestion bar (not auto-detected) */
  manual: boolean;
  /** User manually changed the chord name */
  edited: boolean;
  /** ISO timestamp when this chord was added */
  addedAt: string;
}

export interface CanvasSession {
  id: string;
  name: string;
  createdAt: string;
  tonality: TonalityResult | null;
  cards: CanvasChord[];
}

interface CanvasState {
  /** All saved sessions */
  sessions: CanvasSession[];
  /** ID of the currently active session */
  activeSessionId: string | null;

  // ── Session actions ──────────────────────────────────────────────────────
  createSession: (name?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  updateTonality: (tonality: TonalityResult) => void;

  // ── Card actions (operate on the active session) ─────────────────────────
  /**
   * Called by the detector. Merges incoming chord entries — only appends
   * chords that aren't already the last card, avoiding duplicates from
   * rapid re-detections.
   */
  mergeFromDetector: (chords: { chord: string; edited: boolean }[]) => void;
  addCard: (chord: string, manual?: boolean) => void;
  editCard: (id: string, newChord: string) => void;
  moveCard: (id: string, col: number, row: number) => void;
  deleteCard: (id: string) => void;
  clearCards: () => void;
}

// ---------------------------------------------------------------------------
// Grid helpers (duplicated here to keep the store self-contained)
// ---------------------------------------------------------------------------

const GRID_COL = 4;

function nextPosition(cards: CanvasChord[]): { col: number; row: number } {
  if (cards.length === 0) return { col: 0, row: 0 };
  const last = cards[cards.length - 1];
  const nextCol = last.col + 1;
  if (nextCol >= GRID_COL) return { col: 0, row: last.row + 1 };
  return { col: nextCol, row: last.row };
}

let _seq = 0;
function newId() { return `cc-${Date.now()}-${++_seq}`; }

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      // ── Session actions ─────────────────────────────────────────────────

      createSession: (name) => {
        const id = newId();
        const session: CanvasSession = {
          id,
          name: name ?? `Sesión ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`,
          createdAt: new Date().toISOString(),
          tonality: null,
          cards: [],
        };
        set(s => ({
          sessions: [...s.sessions, session],
          activeSessionId: id,
        }));
        return id;
      },

      deleteSession: (id) =>
        set(s => {
          const sessions = s.sessions.filter(sess => sess.id !== id);
          const activeSessionId =
            s.activeSessionId === id
              ? (sessions[sessions.length - 1]?.id ?? null)
              : s.activeSessionId;
          return { sessions, activeSessionId };
        }),

      setActiveSession: (id) => set({ activeSessionId: id }),

      renameSession: (id, name) =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id === id ? { ...sess, name } : sess,
          ),
        })),

      updateTonality: (tonality) =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id === s.activeSessionId ? { ...sess, tonality } : sess,
          ),
        })),

      // ── Card actions ────────────────────────────────────────────────────

      mergeFromDetector: (incoming) => {
        const { sessions, activeSessionId, createSession } = get();

        // Auto-create a session on first detection if none exists
        let targetId = activeSessionId;
        if (!targetId || !sessions.find(s => s.id === targetId)) {
          targetId = createSession();
        }

        set(s => ({
          sessions: s.sessions.map(sess => {
            if (sess.id !== targetId) return sess;
            let cards = [...sess.cards];

            for (const entry of incoming) {
              const lastCard = cards[cards.length - 1];
              // Skip if the last card already has this chord (de-duplicate)
              if (lastCard && lastCard.chord === entry.chord && !lastCard.edited) continue;
              // Skip if card for this chord already exists and wasn't edited
              const exists = cards.some(c => c.chord === entry.chord && !c.edited && !c.manual);
              if (exists) {
                // Update edited flag if detector confirmed it
                cards = cards.map(c =>
                  c.chord === entry.chord && !c.manual
                    ? { ...c, edited: entry.edited }
                    : c,
                );
                continue;
              }

              const pos = nextPosition(cards);
              cards.push({
                id:      newId(),
                chord:   entry.chord,
                col:     pos.col,
                row:     pos.row,
                manual:  false,
                edited:  entry.edited,
                addedAt: new Date().toISOString(),
              });
            }

            return { ...sess, cards };
          }),
        }));
      },

      addCard: (chord, manual = true) =>
        set(s => ({
          sessions: s.sessions.map(sess => {
            if (sess.id !== s.activeSessionId) return sess;
            const pos = nextPosition(sess.cards);
            return {
              ...sess,
              cards: [
                ...sess.cards,
                {
                  id:      newId(),
                  chord,
                  col:     pos.col,
                  row:     pos.row,
                  manual,
                  edited:  false,
                  addedAt: new Date().toISOString(),
                },
              ],
            };
          }),
        })),

      editCard: (id, newChord) =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id !== s.activeSessionId
              ? sess
              : {
                  ...sess,
                  cards: sess.cards.map(c =>
                    c.id === id ? { ...c, chord: newChord, edited: true } : c,
                  ),
                },
          ),
        })),

      moveCard: (id, col, row) =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id !== s.activeSessionId
              ? sess
              : {
                  ...sess,
                  cards: sess.cards.map(c =>
                    c.id === id ? { ...c, col, row } : c,
                  ),
                },
          ),
        })),

      deleteCard: (id) =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id !== s.activeSessionId
              ? sess
              : { ...sess, cards: sess.cards.filter(c => c.id !== id) },
          ),
        })),

      clearCards: () =>
        set(s => ({
          sessions: s.sessions.map(sess =>
            sess.id !== s.activeSessionId
              ? sess
              : { ...sess, cards: [] },
          ),
        })),
    }),
    {
      name: 'lumina-canvas',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist sessions; activeSessionId is derived
      partialize: (s) => ({ sessions: s.sessions, activeSessionId: s.activeSessionId }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector helpers (use these in components for minimal re-renders)
// ---------------------------------------------------------------------------

export const selectActiveSession = (s: CanvasState): CanvasSession | null =>
  s.sessions.find(sess => sess.id === s.activeSessionId) ?? null;

export const selectActiveCards = (s: CanvasState): CanvasChord[] =>
  selectActiveSession(s)?.cards ?? [];
