/**
 * sessionService.ts
 *
 * All calls to /api/v1/sessions, /api/v1/sessions/:id/blocks
 * and /api/v1/blocks/:id/chords go through here.
 */

import { apiClient } from '../lib/apiClient';
export { extractErrorMessage } from './authService';

// ─── Response types ──────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string;
  title: string | null;
  detectedTonality: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface Block {
  id: string;
  sessionId: string;
  label: string;
  blockOrder: number;
  keyCenter: string | null;
  createdAt: string;
}

export interface ChordRecord {
  id: string;
  blockId: string;
  chordName: string;
  rootNote: string;
  quality: string;
  durationMs: number | null;
  detectedAt: string;
  wasEdited: boolean;
  originalChord: string | null;
}

// ─── Payload types ───────────────────────────────────────────────────────────

export interface CreateSessionPayload {
  title?: string;
}

export interface CreateBlockPayload {
  label: string;
  keyCenter?: string;
}

export interface ChordPayload {
  chordName: string;
  rootNote: string;
  quality: string;
  durationMs?: number;
  detectedAt?: string;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * POST /api/v1/sessions
 * Starts a new practice session.
 */
export async function createSession(payload?: CreateSessionPayload): Promise<Session> {
  const { data } = await apiClient.post<{ session: Session }>('/sessions', payload ?? {});
  return data.session;
}

/**
 * PUT /api/v1/sessions/:id
 * Updates the session (title, detectedTonality) or ends it.
 */
export async function updateSession(
  id: string,
  payload: { title?: string; detectedTonality?: string; end?: boolean },
): Promise<Session> {
  const { data } = await apiClient.put<{ session: Session }>(`/sessions/${id}`, payload);
  return data.session;
}

/**
 * POST /api/v1/sessions/:sessionId/blocks
 * Adds a musical block to the session.
 */
export async function createBlock(
  sessionId: string,
  payload: CreateBlockPayload,
): Promise<Block> {
  const { data } = await apiClient.post<{ block: Block }>(
    `/sessions/${sessionId}/blocks`,
    payload,
  );
  return data.block;
}

/**
 * POST /api/v1/blocks/:blockId/chords
 * Saves one or multiple chords (batch) to a block.
 */
export async function createChords(
  blockId: string,
  chords: ChordPayload[],
): Promise<ChordRecord[]> {
  const { data } = await apiClient.post<{ chords: ChordRecord[] }>(
    `/blocks/${blockId}/chords`,
    chords,
  );
  return data.chords;
}

// ─── History & Stats ─────────────────────────────────────────────────────────

export interface SessionWithBlocks extends Session {
  blocks: (Block & { chords: ChordRecord[] })[];
}

export interface SessionStats {
  totalSessions: number;
  totalChords: number;
  editedChords: number;
  accuracyPct: number;          // (1 - editedChords/totalChords) * 100
  favoriteTonality: string | null;
}

/**
 * GET /api/v1/sessions/history
 * Returns all completed sessions for the authenticated user, newest first.
 */
export async function getSessions(): Promise<SessionWithBlocks[]> {
  const { data } = await apiClient.get<{ sessions: SessionWithBlocks[] }>('/sessions/history');
  return data.sessions;
}

/**
 * GET /api/v1/sessions/stats
 * Returns aggregated stats for the authenticated user.
 */
export async function getSessionStats(): Promise<SessionStats> {
  const { data } = await apiClient.get<{ stats: SessionStats }>('/sessions/stats');
  return data.stats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parses a chord name string (e.g. "Am7", "Cmaj7", "G") into
 * { rootNote, quality } required by the backend.
 *
 * Regex: root = [A-G][#b]?  quality = everything after
 * If quality is empty the backend expects "major".
 */
export function parseChordName(chordName: string): { rootNote: string; quality: string } {
  const m = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return { rootNote: chordName, quality: 'major' };
  return {
    rootNote: m[1],
    quality:  m[2] || 'major',
  };
}
