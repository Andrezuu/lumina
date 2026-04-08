/**
 * CanvasBoard.tsx  — Lienzo de Estructura Libre
 *
 * Uses useCanvasStore (Zustand + AsyncStorage) so the board is:
 *   • Persistent  — survives app restarts
 *   • Reactive    — syncs with the detector via mergeFromDetector()
 *   • Editable    — tap a card to rename it with a chord selector
 *   • Multi-session — toolbar lets you switch / create named sessions
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Marker, Path } from 'react-native-svg';

import type { TonalityResult } from '../lib/tonality';
import {
  getDiatonicChords,
  suggestNextChords,
  type ChordSuggestion,
} from '../lib/harmonicSuggestions';
import {
  useCanvasStore,
  selectActiveCards,
  selectActiveSession,
  type CanvasChord,
} from '../store/useCanvasStore';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const CARD_W   = 72;
const CARD_H   = 64;
const GRID_COL = 4;
const GRID_GAP = 14;

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const FUNC_COLORS: Record<string, string> = {
  tonic:       '#7c3aed',
  subdominant: '#0e7490',
  dominant:    '#b45309',
  leading:     '#6d28d9',
};
const FUNC_LABEL: Record<string, string> = {
  tonic: 'T', subdominant: 'S', dominant: 'D', leading: 'L',
};

// ---------------------------------------------------------------------------
// Chord edit constants
// ---------------------------------------------------------------------------

const EDIT_NOTES     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const EDIT_QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus2', 'sus4'];
const QUALITY_LABEL: Record<string, string> = {
  '': 'maj', m: 'm', '7': '7', maj7: 'maj7', m7: 'm7',
  dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
};

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

function gridToXY(col: number, row: number) {
  return {
    x: col * (CARD_W + GRID_GAP) + GRID_GAP,
    y: row * (CARD_H + GRID_GAP) + GRID_GAP,
  };
}

function xyToGrid(x: number, y: number) {
  return {
    col: Math.max(0, Math.min(GRID_COL - 1, Math.round((x - GRID_GAP) / (CARD_W + GRID_GAP)))),
    row: Math.max(0, Math.round((y - GRID_GAP) / (CARD_H + GRID_GAP))),
  };
}

// ---------------------------------------------------------------------------
// ChordCard — draggable, tap to edit
// ---------------------------------------------------------------------------

interface CardProps {
  card: CanvasChord;
  isLast: boolean;
  diatonicInfo?: ChordSuggestion;
  onDrop: (id: string, col: number, row: number) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

function ChordCard({ card, isLast, diatonicInfo, onDrop, onDelete, onEdit }: CardProps) {
  const pos      = gridToXY(card.col, card.row);
  const pan      = useRef(new Animated.ValueXY(pos)).current;
  const dragging = useRef(false);

  const prevPos = useRef(pos);
  if (!dragging.current && (prevPos.current.x !== pos.x || prevPos.current.y !== pos.y)) {
    pan.setValue(pos);
    prevPos.current = pos;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { dragging.current = true; },
      onPanResponderMove: (_e, g) => {
        pan.x.setValue(pos.x + g.dx);
        pan.y.setValue(pos.y + g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        dragging.current = false;
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          pan.setValue(pos);
          onEdit(card.id);
          return;
        }
        const { col, row } = xyToGrid(pos.x + g.dx, pos.y + g.dy);
        Animated.spring(pan, { toValue: gridToXY(col, row), useNativeDriver: false, friction: 8 }).start();
        onDrop(card.id, col, row);
      },
      onPanResponderTerminate: () => { dragging.current = false; pan.setValue(pos); },
    }),
  ).current;

  const borderColor = isLast ? '#7c3aed' : card.edited ? '#a78bfa66' : '#1e1e30';

  return (
    <Animated.View style={[styles.card, { left: pan.x, top: pan.y, borderColor }]} {...panResponder.panHandlers}>
      {diatonicInfo && (
        <View style={[styles.funcBadge, { backgroundColor: FUNC_COLORS[diatonicInfo.function] }]}>
          <Text style={styles.funcBadgeText}>{FUNC_LABEL[diatonicInfo.function]}</Text>
        </View>
      )}
      <Text style={[styles.cardChord, isLast && styles.cardChordActive]}>{card.chord}</Text>
      {diatonicInfo && (
        <Text style={[styles.cardDegree, { color: FUNC_COLORS[diatonicInfo.function] + 'aa' }]}>
          {diatonicInfo.degree}
        </Text>
      )}
      {card.edited && <Text style={styles.cardEditedDot}>✎</Text>}
      <TouchableOpacity style={styles.cardDelete} onPress={() => onDelete(card.id)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}>
        <Text style={styles.cardDeleteText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// SVG connections between cards
// ---------------------------------------------------------------------------

function Connections({ cards, width }: { cards: CanvasChord[]; width: number }) {
  if (cards.length < 2 || width === 0) return null;
  const sorted = [...cards].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  const paths: string[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = gridToXY(sorted[i].col,     sorted[i].row);
    const b = gridToXY(sorted[i + 1].col, sorted[i + 1].row);
    const ax = a.x + CARD_W, ay = a.y + CARD_H / 2;
    const bx = b.x,          by = b.y + CARD_H / 2;
    const cx = (ax + bx) / 2;
    paths.push(`M ${ax} ${ay} C ${cx} ${ay} ${cx} ${by} ${bx} ${by}`);
  }
  const last = sorted[sorted.length - 1];
  const svgH = (last.row + 1) * (CARD_H + GRID_GAP) + GRID_GAP;
  return (
    <Svg width={width} height={svgH} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <Path d="M0,0 L0,6 L6,3 z" fill="#2a2a4a" />
        </Marker>
      </Defs>
      {paths.map((d, i) => (
        <Path key={i} d={d} stroke="#2a2a4a" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Edit chord modal
// ---------------------------------------------------------------------------

interface EditModalProps {
  visible: boolean;
  initialChord: string;
  onConfirm: (chord: string) => void;
  onClose: () => void;
}

function EditChordModal({ visible, initialChord, onConfirm, onClose }: EditModalProps) {
  const [root,    setRoot]    = useState('C');
  const [quality, setQuality] = useState('');

  useEffect(() => {
    if (visible) {
      const m = initialChord.match(/^([A-G][#b]?)(.*)$/);
      setRoot(m?.[1] ?? 'C');
      setQuality(m?.[2] ?? '');
    }
  }, [visible, initialChord]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalPanel}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Editar acorde</Text>

          <Text style={styles.sectionLabel}>Nota raíz</Text>
          <View style={styles.noteGrid}>
            {EDIT_NOTES.map(n => (
              <TouchableOpacity key={n} style={[styles.noteBtn, root === n && styles.noteBtnActive]} onPress={() => setRoot(n)}>
                <Text style={[styles.noteBtnText, root === n && styles.noteBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Calidad</Text>
          <View style={styles.qualityGrid}>
            {EDIT_QUALITIES.map(q => (
              <TouchableOpacity key={q || '__maj'} style={[styles.qualityBtn, quality === q && styles.qualityBtnActive]} onPress={() => setQuality(q)}>
                <Text style={[styles.qualityText, quality === q && styles.qualityTextActive]}>{QUALITY_LABEL[q]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(`${root}${quality}`)}>
              <Text style={styles.confirmText}>Guardar — {root}{quality || ' maj'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Session drawer
// ---------------------------------------------------------------------------

function SessionDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sessions      = useCanvasStore(s => s.sessions);
  const activeId      = useCanvasStore(s => s.activeSessionId);
  const setActive     = useCanvasStore(s => s.setActiveSession);
  const createSession = useCanvasStore(s => s.createSession);
  const deleteSession = useCanvasStore(s => s.deleteSession);
  const renameSession = useCanvasStore(s => s.renameSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName,  setEditName]  = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalPanel, { paddingBottom: 32 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Sesiones guardadas</Text>

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {sessions.length === 0 && <Text style={styles.emptyText}>Sin sesiones aún</Text>}
            {sessions.map(sess => (
              <View key={sess.id} style={styles.sessionRow}>
                {editingId === sess.id ? (
                  <TextInput
                    style={styles.sessionNameInput}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                    onBlur={() => { if (editName.trim()) renameSession(sess.id, editName.trim()); setEditingId(null); }}
                    onSubmitEditing={() => { if (editName.trim()) renameSession(sess.id, editName.trim()); setEditingId(null); }}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.sessionNameBtn}
                    onPress={() => { setActive(sess.id); onClose(); }}
                    onLongPress={() => { setEditingId(sess.id); setEditName(sess.name); }}
                  >
                    <Text style={[styles.sessionName, sess.id === activeId && styles.sessionNameActive]}>{sess.name}</Text>
                    <Text style={styles.sessionMeta}>
                      {sess.cards.length} acordes ·{' '}
                      {new Date(sess.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.sessionDelete} onPress={() => deleteSession(sess.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.sessionDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.newSessionBtn} onPress={() => { createSession(); onClose(); }}>
            <Text style={styles.newSessionText}>+ Nueva sesión</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Suggestion bar
// ---------------------------------------------------------------------------

interface SuggestionBarProps {
  suggestions: ChordSuggestion[];
  diatonic: ChordSuggestion[];
  showDiatonic: boolean;
  onToggle: () => void;
  onPick: (s: ChordSuggestion) => void;
}

function SuggestionBar({ suggestions, diatonic, showDiatonic, onToggle, onPick }: SuggestionBarProps) {
  const items = showDiatonic ? diatonic : suggestions;
  return (
    <View style={styles.suggBar}>
      <View style={styles.suggHeader}>
        <Text style={styles.suggLabel}>{showDiatonic ? 'Acordes diatónicos' : 'Siguiente sugerido'}</Text>
        <TouchableOpacity onPress={onToggle} style={styles.suggToggle}>
          <Text style={styles.suggToggleText}>{showDiatonic ? 'Ver sugerencias' : 'Ver escala'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggScroll}>
        {items.length === 0 && <Text style={styles.suggEmpty}>Detecta acordes para ver sugerencias</Text>}
        {items.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.suggChip, { borderColor: FUNC_COLORS[s.function] + '70' }]}
            onPress={() => onPick(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.suggDegree, { color: FUNC_COLORS[s.function] }]}>{s.degree}</Text>
            <Text style={styles.suggChord}>{s.chord}</Text>
            {!showDiatonic && (
              <View style={styles.suggScoreTrack}>
                <View style={[styles.suggScoreFill, { width: `${Math.round(s.score * 100)}%` as any, backgroundColor: FUNC_COLORS[s.function] }]} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CanvasBoard
// ---------------------------------------------------------------------------

export interface CanvasBoardProps {
  chordHistory: { chord: string; edited: boolean }[];
  tonality: TonalityResult | null;
}

export function CanvasBoard({ chordHistory, tonality }: CanvasBoardProps) {
  const mergeFromDetector = useCanvasStore(s => s.mergeFromDetector);
  const addCard           = useCanvasStore(s => s.addCard);
  const editCard          = useCanvasStore(s => s.editCard);
  const moveCard          = useCanvasStore(s => s.moveCard);
  const deleteCard        = useCanvasStore(s => s.deleteCard);
  const clearCards        = useCanvasStore(s => s.clearCards);
  const createSession     = useCanvasStore(s => s.createSession);
  const updateTonality    = useCanvasStore(s => s.updateTonality);
  const activeSession     = useCanvasStore(selectActiveSession);
  const cards             = useCanvasStore(selectActiveCards);

  const [boardWidth,    setBoardWidth]    = useState(0);
  const [showDiatonic,  setShowDiatonic]  = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showSessions,  setShowSessions]  = useState(false);

  // Auto-create a session on first load
  useEffect(() => {
    if (!activeSession) createSession();
  }, [activeSession, createSession]);

  // Persist the tonality in the session
  useEffect(() => {
    if (tonality) updateTonality(tonality);
  }, [tonality, updateTonality]);

  // Merge new chords from the detector
  useEffect(() => {
    if (chordHistory.length > 0) mergeFromDetector(chordHistory);
  }, [chordHistory, mergeFromDetector]);

  const effectiveTonality = tonality ?? activeSession?.tonality ?? null;

  const suggestions = useMemo(() => {
    if (!effectiveTonality || cards.length === 0) return [];
    const sorted = [...cards].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
    return suggestNextChords(sorted.map(c => c.chord), effectiveTonality, 5);
  }, [cards, effectiveTonality]);

  const diatonic = useMemo(
    () => (effectiveTonality ? getDiatonicChords(effectiveTonality) : []),
    [effectiveTonality],
  );

  const diatonicMap = useMemo(() => {
    const m = new Map<string, ChordSuggestion>();
    diatonic.forEach(d => m.set(d.chord, d));
    return m;
  }, [diatonic]);

  const boardRows = cards.length > 0 ? Math.max(...cards.map(c => c.row)) + 1 : 1;
  const boardH    = boardRows * (CARD_H + GRID_GAP) + GRID_GAP;
  const editingCard = cards.find(c => c.id === editingCardId);

  const handleConfirmEdit = useCallback((newChord: string) => {
    if (editingCardId) editCard(editingCardId, newChord);
    setEditingCardId(null);
  }, [editingCardId, editCard]);

  return (
    <View style={styles.container}>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.sessionBtn} onPress={() => setShowSessions(true)}>
          <Text style={styles.sessionBtnLabel} numberOfLines={1}>{activeSession?.name ?? 'Sin sesión'}</Text>
          <Text style={styles.sessionBtnArrow}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={clearCards}>
          <Text style={styles.clearBtnText}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      {/* Tonality strip */}
      {effectiveTonality && (
        <View style={styles.tonalityStrip}>
          <Text style={styles.tonalityText}>
            {effectiveTonality.key} {effectiveTonality.mode === 'major' ? 'mayor' : 'menor'}
            {'  ·  '}
            <Text style={styles.tonalityCount}>{cards.length} acordes</Text>
          </Text>
        </View>
      )}

      {/* Board */}
      <ScrollView style={styles.boardScroll} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.board, { height: Math.max(boardH, 200) }]}
          onLayout={(e: LayoutChangeEvent) => setBoardWidth(e.nativeEvent.layout.width)}
        >
          <Connections cards={cards} width={boardWidth} />
          {cards.map((card, idx) => (
            <ChordCard
              key={card.id}
              card={card}
              isLast={idx === cards.length - 1}
              diatonicInfo={diatonicMap.get(card.chord)}
              onDrop={(id, col, row) => moveCard(id, col, row)}
              onDelete={deleteCard}
              onEdit={setEditingCardId}
            />
          ))}
          {cards.length === 0 && (
            <View style={styles.emptyBoard}>
              <Text style={styles.emptyBoardText}>
                Inicia el detector o toca una sugerencia{'\n'}para añadir acordes al lienzo
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Suggestion bar */}
      <SuggestionBar
        suggestions={suggestions}
        diatonic={diatonic}
        showDiatonic={showDiatonic}
        onToggle={() => setShowDiatonic(v => !v)}
        onPick={s => addCard(s.chord, true)}
      />

      {/* Edit chord modal */}
      <EditChordModal
        visible={editingCardId !== null}
        initialChord={editingCard?.chord ?? 'C'}
        onConfirm={handleConfirmEdit}
        onClose={() => setEditingCardId(null)}
      />

      {/* Session drawer */}
      <SessionDrawer visible={showSessions} onClose={() => setShowSessions(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#1a1a2a',
  },
  sessionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 12 },
  sessionBtnLabel: { color: '#8080a0', fontSize: 12, fontWeight: '600', flex: 1 },
  sessionBtnArrow: { color: '#404060', fontSize: 11 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#2a2a3a' },
  clearBtnText: { color: '#505070', fontSize: 12 },

  tonalityStrip: { paddingHorizontal: 16, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#12122a' },
  tonalityText: { color: '#505070', fontSize: 11, letterSpacing: 0.5 },
  tonalityCount: { color: '#303050' },

  boardScroll: { flex: 1 },
  board: { position: 'relative', width: '100%' },

  card: {
    position: 'absolute', width: CARD_W, height: CARD_H, borderRadius: 14,
    backgroundColor: '#12121e', borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4,
  },
  cardChord: { color: '#7070a0', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 },
  cardChordActive: { color: '#c0b0f0' },
  cardDegree: { fontSize: 10, marginTop: 2, letterSpacing: 1 },
  cardEditedDot: { position: 'absolute', bottom: 4, right: 6, color: '#7c3aed', fontSize: 9 },
  cardDelete: { position: 'absolute', top: 4, right: 6 },
  cardDeleteText: { color: '#2a2a4a', fontSize: 10 },
  funcBadge: {
    position: 'absolute', top: 4, left: 6, width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  funcBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  emptyBoard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBoardText: { color: '#2a2a4a', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  suggBar: { borderTopWidth: 1, borderTopColor: '#1a1a2a', paddingTop: 10, paddingBottom: 12, backgroundColor: '#0a0a12' },
  suggHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  suggLabel: { color: '#3a3a5a', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  suggToggle: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a3a' },
  suggToggleText: { color: '#505070', fontSize: 11 },
  suggScroll: { paddingHorizontal: 12, gap: 8 },
  suggEmpty: { color: '#2a2a4a', fontSize: 12, paddingHorizontal: 4, alignSelf: 'center' },
  suggChip: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#12121e', borderWidth: 1, minWidth: 60, gap: 2 },
  suggDegree: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  suggChord: { color: '#c0c0d8', fontSize: 16, fontWeight: '700' },
  suggScoreTrack: { height: 2, width: '100%', backgroundColor: '#1e1e2e', borderRadius: 1, overflow: 'hidden', marginTop: 4 },
  suggScoreFill: { height: '100%', borderRadius: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalPanel: {
    backgroundColor: '#0e0e18', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: '#1e1e2e', paddingTop: 12, paddingBottom: 48, paddingHorizontal: 20,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2a2a3a', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: '#9090b0', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 },
  sectionLabel: { color: '#3a3a5a', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  noteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  noteBtn: { width: 44, height: 38, borderRadius: 10, backgroundColor: '#1a1a28', borderWidth: 1, borderColor: '#2a2a3a', alignItems: 'center', justifyContent: 'center' },
  noteBtnActive: { backgroundColor: '#2a1060', borderColor: '#7c3aed' },
  noteBtnText: { color: '#7070a0', fontSize: 13, fontWeight: '600' },
  noteBtnTextActive: { color: '#c0b0f0' },
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qualityBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#1a1a28', borderWidth: 1, borderColor: '#2a2a3a' },
  qualityBtnActive: { backgroundColor: '#2a1060', borderColor: '#7c3aed' },
  qualityText: { color: '#7070a0', fontSize: 13 },
  qualityTextActive: { color: '#c0b0f0' },
  confirmRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#2a2a3a' },
  cancelText: { color: '#505070', fontSize: 13 },
  confirmBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, backgroundColor: '#7c3aed' },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1a1a2a' },
  sessionNameBtn: { flex: 1 },
  sessionName: { color: '#8080a0', fontSize: 14, fontWeight: '500' },
  sessionNameActive: { color: '#c0b0f0' },
  sessionMeta: { color: '#303050', fontSize: 11, marginTop: 2 },
  sessionDelete: { paddingHorizontal: 8 },
  sessionDeleteText: { color: '#2a2a4a', fontSize: 13 },
  sessionNameInput: { flex: 1, color: '#c0c0e0', fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#7c3aed', paddingVertical: 2 },
  emptyText: { color: '#2a2a4a', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  newSessionBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#2a2a3a', alignItems: 'center' },
  newSessionText: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
});
