/**
 * CanvasBoard.tsx
 *
 * "Lienzo de Estructura Libre" — visual workspace where confirmed chords
 * are shown as draggable cards. The user can reorder them, delete them,
 * and see real-time suggestions for the next chord based on the current
 * progression + tonality.
 *
 * Architecture
 * ────────────
 *  • Each chord card is absolutely positioned; the user pans it with a
 *    PanResponder. On release the card snaps to the nearest grid cell.
 *  • The suggestion bar is computed by harmonicSuggestions.suggestNextChords()
 *    and shown at the bottom. Tapping a suggestion appends it to the board.
 *  • Connections (lines) between adjacent cards in the sequence are drawn
 *    with an SVG overlay so the user can see the progression flow.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Line, Marker, Path } from 'react-native-svg';

import type { TonalityResult } from '../lib/tonality';
import {
  getDiatonicChords,
  suggestNextChords,
  type ChordSuggestion,
} from '../lib/harmonicSuggestions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_W     = 72;
const CARD_H     = 64;
const GRID_COL   = 4;           // columns in the snap grid
const GRID_GAP   = 14;
const COLORS: Record<string, string> = {
  tonic:       '#7c3aed',
  subdominant: '#0e7490',
  dominant:    '#b45309',
  leading:     '#6d28d9',
};
const FUNCTION_LABEL: Record<string, string> = {
  tonic:       'T',
  subdominant: 'S',
  dominant:    'D',
  leading:     'L',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasChord {
  id: string;
  chord: string;
  /** Column index in the snap grid (0-based) */
  col: number;
  /** Row index in the snap grid (0-based) */
  row: number;
  /** Was this chord added manually from the suggestion bar? */
  manual: boolean;
  edited: boolean;
}

export interface CanvasBoardProps {
  /** Detected chord history from the hook (oldest → newest) */
  chordHistory: { chord: string; edited: boolean }[];
  tonality: TonalityResult | null;
  /** Called when the user taps a suggestion (parent can append to history) */
  onAddChord?: (chord: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _uid = 0;
function uid() { return `cc-${++_uid}`; }

function chordsToCards(history: { chord: string; edited: boolean }[]): CanvasChord[] {
  return history.map((e, i) => ({
    id:     uid(),
    chord:  e.chord,
    col:    i % GRID_COL,
    row:    Math.floor(i / GRID_COL),
    manual: false,
    edited: e.edited,
  }));
}

function gridToXY(col: number, row: number): { x: number; y: number } {
  return {
    x: col * (CARD_W + GRID_GAP) + GRID_GAP,
    y: row * (CARD_H + GRID_GAP) + GRID_GAP,
  };
}

function xyToGrid(
  x: number,
  y: number,
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(GRID_COL - 1, Math.round((x - GRID_GAP) / (CARD_W + GRID_GAP)))),
    row: Math.max(0, Math.round((y - GRID_GAP) / (CARD_H + GRID_GAP))),
  };
}

// ---------------------------------------------------------------------------
// Draggable card
// ---------------------------------------------------------------------------

interface CardProps {
  card: CanvasChord;
  onDrop: (id: string, col: number, row: number) => void;
  onDelete: (id: string) => void;
  isLast: boolean;
  suggestion?: ChordSuggestion;
}

function ChordCard({ card, onDrop, onDelete, isLast, suggestion }: CardProps) {
  const pos = gridToXY(card.col, card.row);
  const pan = useRef(new Animated.ValueXY({ x: pos.x, y: pos.y })).current;

  // Sync if parent moves the card (history update)
  const prevPos = useRef(pos);
  if (prevPos.current.x !== pos.x || prevPos.current.y !== pos.y) {
    pan.setValue(pos);
    prevPos.current = pos;
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        pan.x.setValue(pos.x + g.dx);
        pan.y.setValue(pos.y + g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        const dropX = pos.x + g.dx;
        const dropY = pos.y + g.dy;
        const { col, row } = xyToGrid(dropX, dropY);
        const snap = gridToXY(col, row);
        Animated.spring(pan, {
          toValue: snap,
          useNativeDriver: false,
          friction: 8,
        }).start();
        onDrop(card.id, col, row);
      },
    }),
  ).current;

  const funcColor = suggestion ? COLORS[suggestion.function] : '#1e1e30';
  const borderColor = isLast ? '#7c3aed' : card.edited ? '#a78bfa44' : '#1e1e30';

  return (
    <Animated.View
      style={[styles.card, { left: pan.x, top: pan.y, borderColor }]}
      {...panResponder.panHandlers}
    >
      {/* Function badge */}
      {suggestion && (
        <View style={[styles.funcBadge, { backgroundColor: funcColor }]}>
          <Text style={styles.funcBadgeText}>{FUNCTION_LABEL[suggestion.function]}</Text>
        </View>
      )}
      <Text style={[styles.cardChord, isLast && styles.cardChordActive]}>
        {card.chord}
      </Text>
      {suggestion && (
        <Text style={styles.cardDegree}>{suggestion.degree}</Text>
      )}
      {/* Delete button */}
      <TouchableOpacity
        style={styles.cardDelete}
        onPress={() => onDelete(card.id)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.cardDeleteText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// SVG arrow connections
// ---------------------------------------------------------------------------

interface ConnectionsProps {
  cards: CanvasChord[];
  boardWidth: number;
}

function Connections({ cards, boardWidth }: ConnectionsProps) {
  if (cards.length < 2 || boardWidth === 0) return null;

  const paths: string[] = [];
  for (let i = 0; i < cards.length - 1; i++) {
    const a = gridToXY(cards[i].col,     cards[i].row);
    const b = gridToXY(cards[i + 1].col, cards[i + 1].row);
    const ax = a.x + CARD_W;
    const ay = a.y + CARD_H / 2;
    const bx = b.x;
    const by = b.y + CARD_H / 2;
    const cpx = (ax + bx) / 2;
    paths.push(`M ${ax} ${ay} C ${cpx} ${ay} ${cpx} ${by} ${bx} ${by}`);
  }

  const lastCard = cards[cards.length - 1];
  const boardH   = (lastCard.row + 1) * (CARD_H + GRID_GAP) + GRID_GAP;

  return (
    <Svg
      width={boardWidth}
      height={boardH}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <Marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <Path d="M0,0 L0,6 L6,3 z" fill="#3a3a6a" />
        </Marker>
      </Defs>
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke="#2a2a4a"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#arrow)"
        />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Suggestion bar
// ---------------------------------------------------------------------------

interface SuggestionBarProps {
  suggestions: ChordSuggestion[];
  diatonic: ChordSuggestion[];
  showDiatonic: boolean;
  onToggleDiatonic: () => void;
  onPick: (s: ChordSuggestion) => void;
}

function SuggestionBar({ suggestions, diatonic, showDiatonic, onToggleDiatonic, onPick }: SuggestionBarProps) {
  const items = showDiatonic ? diatonic : suggestions;
  return (
    <View style={styles.suggBar}>
      <View style={styles.suggHeader}>
        <Text style={styles.suggLabel}>
          {showDiatonic ? 'Acordes diatónicos' : 'Siguiente sugerido'}
        </Text>
        <TouchableOpacity onPress={onToggleDiatonic} style={styles.suggToggle}>
          <Text style={styles.suggToggleText}>
            {showDiatonic ? 'Ver sugerencias' : 'Ver escala'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggScroll}>
        {items.length === 0 && (
          <Text style={styles.suggEmpty}>Detecta más acordes para ver sugerencias</Text>
        )}
        {items.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.suggChip, { borderColor: COLORS[s.function] + '80' }]}
            onPress={() => onPick(s)}
            activeOpacity={0.75}
          >
            <Text style={[styles.suggDegree, { color: COLORS[s.function] }]}>{s.degree}</Text>
            <Text style={styles.suggChord}>{s.chord}</Text>
            {!showDiatonic && (
              <View style={[styles.suggScoreBar, { width: `${Math.round(s.score * 100)}%` as any }]}>
                <View style={[styles.suggScoreFill, { backgroundColor: COLORS[s.function] }]} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CanvasBoard({ chordHistory, tonality, onAddChord }: CanvasBoardProps) {
  const [cards, setCards] = useState<CanvasChord[]>(() =>
    chordsToCards(chordHistory),
  );
  const [boardWidth, setBoardWidth] = useState(0);
  const [showDiatonic, setShowDiatonic] = useState(false);

  // Sync cards when history changes from the detector
  const prevLen = useRef(chordHistory.length);
  if (chordHistory.length !== prevLen.current) {
    prevLen.current = chordHistory.length;
    setCards(chordsToCards(chordHistory));
  }

  const suggestions: ChordSuggestion[] = useMemo(() => {
    if (!tonality || cards.length === 0) return [];
    return suggestNextChords(cards.map(c => c.chord), tonality, 5);
  }, [cards, tonality]);

  const diatonic: ChordSuggestion[] = useMemo(() => {
    if (!tonality) return [];
    return getDiatonicChords(tonality);
  }, [tonality]);

  // Find the suggestion info for each card (for degree label)
  const diatonicMap = useMemo(() => {
    const m = new Map<string, ChordSuggestion>();
    diatonic.forEach(d => m.set(d.chord, d));
    return m;
  }, [diatonic]);

  const handleDrop = useCallback((id: string, col: number, row: number) => {
    setCards(prev =>
      prev.map(c => (c.id === id ? { ...c, col, row } : c)),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const handlePickSuggestion = useCallback((s: ChordSuggestion) => {
    setCards(prev => {
      const lastCard = prev[prev.length - 1];
      const nextCol  = lastCard ? (lastCard.col + 1) % GRID_COL : 0;
      const nextRow  = lastCard
        ? lastCard.col + 1 >= GRID_COL
          ? lastCard.row + 1
          : lastCard.row
        : 0;
      return [
        ...prev,
        { id: uid(), chord: s.chord, col: nextCol, row: nextRow, manual: true, edited: false },
      ];
    });
    onAddChord?.(s.chord);
  }, [onAddChord]);

  const boardRows = cards.length > 0
    ? Math.max(...cards.map(c => c.row)) + 1
    : 1;
  const boardH = boardRows * (CARD_H + GRID_GAP) + GRID_GAP;

  const handleLayout = (e: LayoutChangeEvent) => {
    setBoardWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Lienzo</Text>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => setCards([])}
        >
          <Text style={styles.clearBtnText}>Limpiar</Text>
        </TouchableOpacity>
      </View>

      {/* Board */}
      <ScrollView
        style={styles.boardScroll}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.board, { height: Math.max(boardH, 160) }]}
          onLayout={handleLayout}
        >
          <Connections cards={cards} boardWidth={boardWidth} />
          {cards.map((card, idx) => (
            <ChordCard
              key={card.id}
              card={card}
              onDrop={handleDrop}
              onDelete={handleDelete}
              isLast={idx === cards.length - 1}
              suggestion={diatonicMap.get(card.chord)}
            />
          ))}
          {cards.length === 0 && (
            <View style={styles.emptyBoard}>
              <Text style={styles.emptyBoardText}>
                Inicia el detector o toca una sugerencia
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
        onToggleDiatonic={() => setShowDiatonic(v => !v)}
        onPick={handlePickSuggestion}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2a',
  },
  toolbarTitle: {
    color: '#9090b0',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  clearBtnText: {
    color: '#505070',
    fontSize: 12,
  },

  // Board
  boardScroll: {
    flex: 1,
  },
  board: {
    position: 'relative',
    width: '100%',
  },

  // Cards
  card: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    backgroundColor: '#12121e',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  cardChord: {
    color: '#7070a0',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardChordActive: {
    color: '#c0b0f0',
  },
  cardDegree: {
    color: '#404060',
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1,
  },
  cardDelete: {
    position: 'absolute',
    top: 4,
    right: 6,
  },
  cardDeleteText: {
    color: '#2a2a4a',
    fontSize: 10,
  },
  funcBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funcBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },

  // Empty board
  emptyBoard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyBoardText: {
    color: '#2a2a4a',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Suggestion bar
  suggBar: {
    borderTopWidth: 1,
    borderTopColor: '#1a1a2a',
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#0a0a12',
  },
  suggHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  suggLabel: {
    color: '#3a3a5a',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  suggToggle: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  suggToggleText: {
    color: '#5050808',
    fontSize: 11,
  },
  suggScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  suggEmpty: {
    color: '#2a2a4a',
    fontSize: 12,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  suggChip: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#12121e',
    borderWidth: 1,
    minWidth: 60,
    gap: 2,
  },
  suggDegree: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  suggChord: {
    color: '#c0c0d8',
    fontSize: 16,
    fontWeight: '700',
  },
  suggScoreBar: {
    height: 2,
    backgroundColor: '#1e1e2e',
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: 4,
    alignSelf: 'stretch',
  },
  suggScoreFill: {
    height: '100%',
    borderRadius: 1,
  },
});
