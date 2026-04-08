import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useEffect, useState, useMemo } from 'react';
import { useChordDetection } from '../src/hooks/useChordDetection';
import type { ChordHistoryEntry } from '../src/hooks/useChordDetection';
import { ChordDisplay } from '../src/components/ChordDisplay';
import { CircleOfFifths } from '../src/components/CircleOfFifths';
import { CanvasBoard } from '../src/components/CanvasBoard';
import {
  getKeyInfo,
  getPosition,
  MAJOR_DISPLAY,
  MINOR_DISPLAY,
  type KeyInfo,
} from '../src/lib/circleOfFifths';

// ---------------------------------------------------------------------------
// Spanish mode labels
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, string> = {
  ionian:         'Jónico',
  dorian:         'Dórico',
  phrygian:       'Frigio',
  lydian:         'Lidio',
  mixolydian:     'Mixolidio',
  aeolian:        'Eólico',
  locrian:        'Locrio',
  harmonic_minor: 'Menor armónico',
  melodic_minor:  'Menor melódico',
};

/**
 * Returns the relative key label given a detected root + mode.
 * e.g.  C major → "Am menor"   /   A minor → "C mayor"
 */
function getRelative(root: string, mode: 'major' | 'minor'): string | null {
  const pos = getPosition(root, mode);
  if (pos === -1) return null;
  if (mode === 'major') return `${MINOR_DISPLAY[pos]} menor`;
  return `${MAJOR_DISPLAY[pos]} mayor`;
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { chord, tonality, mode, chordHistory, isRecording, error, start, stop, hasSignal, rmsDb, resetHistory, editChord } =
    useChordDetection();

  // View state
  const [activeView, setActiveView] = useState<'detector' | 'circulo' | 'lienzo'>('detector');

  // Edit chord modal
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editRoot, setEditRoot]         = useState('C');
  const [editQuality, setEditQuality]   = useState('');

  const EDIT_NOTES    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const EDIT_QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus2', 'sus4'];
  const QUALITY_LABELS: Record<string, string> = {
    '': 'maj', m: 'm', '7': '7', maj7: 'maj7', m7: 'm7',
    dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
  };

  const openEdit = (i: number) => {
    const entry = chordHistory[i];
    if (!entry) return;
    // Parse existing chord: root is leading uppercase + optional #/b, rest is quality
    const m = entry.chord.match(/^([A-G][#b]?)(.*)$/);
    setEditRoot(m ? m[1] : 'C');
    setEditQuality(m ? m[2] : '');
    setEditingIndex(i);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    editChord(editingIndex, `${editRoot}${editQuality}`);
    setEditingIndex(null);
  };

  // Circle state
  const [manualMode, setManualMode]         = useState(false);
  const [customProgression, setCustomProgression] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<{
    root: string;
    mode: 'major' | 'minor';
  } | null>(null);

  // Derived: key info for the chord-info modal — only recomputed on tap
  const keyInfo: KeyInfo | null = useMemo(
    () => (selectedSegment ? getKeyInfo(selectedSegment.root, selectedSegment.mode) : null),
    [selectedSegment],
  );

  // Recording pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRecording) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  // Manual-mode handlers
  const handleManualAdd = (label: string) => {
    if (customProgression.length < 8) {
      setCustomProgression(prev => [...prev, label]);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>LUMINA</Text>
        <Animated.View style={[styles.dot, { opacity: pulseAnim }, !isRecording && styles.dotOff]} />
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {(['detector', 'circulo', 'lienzo'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeView === tab && styles.tabActive]}
            onPress={() => setActiveView(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeView === tab && styles.tabTextActive]}>
              {tab === 'detector' ? 'Detector' : tab === 'circulo' ? 'Círculo' : 'Lienzo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Detector view ─────────────────────────────────────── */}
      {activeView === 'detector' ? (
        <>
          <View style={styles.chordArea}>
            <ChordDisplay chord={chord} isActive={isRecording} hasSignal={hasSignal} rmsDb={rmsDb} />
          </View>

          {/* Chord history — full scrollable list, tap to edit */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyScroll}
            style={styles.historyScrollContainer}
          >
            {chordHistory.map((entry, i) => {
              const isNewest = i === chordHistory.length - 1;
              return (
                <View key={i} style={styles.historyItem}>
                  {i > 0 && <Text style={styles.historySep}>›</Text>}
                  <TouchableOpacity
                    style={[styles.historyPill, isNewest && styles.historyPillActive, entry.edited && styles.historyPillEdited]}
                    onPress={() => openEdit(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.historyChord, isNewest && styles.historyChordActive]}>
                      {entry.chord}
                    </Text>
                    {entry.edited && <Text style={styles.historyEditDot}>✎</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          {/* Key + mode + relative */}
          <View style={styles.infoBlock}>
            <InfoRow
              label="Tonalidad"
              value={tonality ? `${tonality.key} ${tonality.mode === 'major' ? 'mayor' : 'menor'}` : null}
            />
            <InfoRow
              label="Relativa"
              value={tonality ? getRelative(tonality.key, tonality.mode) : null}
            />
            <InfoRow
              label="Modo"
              value={mode ? (MODE_LABELS[mode.mode] ?? mode.mode) : null}
            />
          </View>
        </>
      ) : activeView === 'lienzo' ? (
        /* ── Lienzo view ──────────────────────────────────────── */
        <CanvasBoard
          chordHistory={chordHistory}
          tonality={tonality}
        />
      ) : (
        /* ── Círculo view ─────────────────────────────────────── */
        <View style={styles.circleArea}>
          {/* Realtime / Manual toggle */}
          <View style={styles.modeRow}>
            {([false, true] as const).map(isManual => (
              <TouchableOpacity
                key={String(isManual)}
                style={[styles.modeBtn, manualMode === isManual && styles.modeBtnActive]}
                onPress={() => setManualMode(isManual)}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, manualMode === isManual && styles.modeBtnTextActive]}>
                  {isManual ? 'Manual' : 'Tiempo real'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <CircleOfFifths
            tonality={manualMode ? null : tonality}
            chord={manualMode ? null : chord}
            chordHistory={manualMode ? [] : chordHistory.map(e => e.chord)}
            onSegmentPress={(root, m) => setSelectedSegment({ root, mode: m })}
            manualMode={manualMode}
            customProgression={customProgression}
            onManualAdd={handleManualAdd}
          />

          {/* Manual progression pills */}
          {manualMode && (
            customProgression.length === 0 ? (
              <Text style={styles.progressionEmpty}>
                Toca los segmentos para añadir acordes
              </Text>
            ) : (
              <View style={styles.progressionContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.progressionScroll}
                >
                  {customProgression.map((label, i) => (
                    <View key={i} style={styles.progressionPill}>
                      <Text style={styles.progressionPillText}>{label}</Text>
                      <TouchableOpacity
                        onPress={() =>
                          setCustomProgression(prev => prev.filter((_, j) => j !== i))
                        }
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      >
                        <Text style={styles.progressionPillX}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setCustomProgression([])}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>Limpiar</Text>
                </TouchableOpacity>
              </View>
            )
          )}
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Start / Stop + Reset buttons — hidden only in Circle manual mode */}
      {!(activeView === 'circulo' && manualMode) && (
        <View style={styles.buttonRow}>
          {isRecording && (
            <TouchableOpacity
              style={styles.buttonReset}
              onPress={resetHistory}
              activeOpacity={0.75}
            >
              <Text style={styles.buttonResetText}>Reiniciar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, isRecording && styles.buttonStop]}
            onPress={isRecording ? stop : start}
            activeOpacity={0.75}
          >
            <Text style={styles.buttonText}>{isRecording ? 'Detener' : 'Iniciar'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Chord info modal */}
      <Modal
        visible={selectedSegment !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSegment(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedSegment(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalPanel}>
            {keyInfo && <KeyInfoPanel info={keyInfo} />}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit chord modal */}
      <Modal
        visible={editingIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingIndex(null)}
      >
        <TouchableOpacity
          style={styles.editModalBackdrop}
          activeOpacity={1}
          onPress={() => setEditingIndex(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.editModalPanel}>
            <View style={styles.editModalHandle} />
            <Text style={styles.editModalTitle}>Editar acorde</Text>

            <Text style={styles.editSectionLabel}>Nota raíz</Text>
            <View style={styles.editNoteGrid}>
              {EDIT_NOTES.map(note => (
                <TouchableOpacity
                  key={note}
                  style={[styles.editNoteBtn, editRoot === note && styles.editNoteBtnActive]}
                  onPress={() => setEditRoot(note)}
                >
                  <Text style={[styles.editNoteText, editRoot === note && styles.editNoteTextActive]}>
                    {note}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.editSectionLabel}>Calidad</Text>
            <View style={styles.editQualityGrid}>
              {EDIT_QUALITIES.map(q => (
                <TouchableOpacity
                  key={q || '__maj'}
                  style={[styles.editQualityBtn, editQuality === q && styles.editQualityBtnActive]}
                  onPress={() => setEditQuality(q)}
                >
                  <Text style={[styles.editQualityText, editQuality === q && styles.editQualityTextActive]}>
                    {QUALITY_LABELS[q]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editConfirmRow}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={() => setEditingIndex(null)}>
                <Text style={styles.editCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.editConfirmBtn} onPress={confirmEdit}>
                <Text style={styles.editConfirmText}>
                  Guardar — {editRoot}{editQuality}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, !value && styles.infoEmpty]}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

function KeyInfoPanel({ info }: { info: KeyInfo }) {
  return (
    <View style={styles.panelContent}>
      <View style={styles.panelHandle} />
      <Text style={styles.panelTitle}>{info.displayName}</Text>

      <Text style={styles.panelSectionLabel}>Escala</Text>
      <View style={styles.pillRow}>
        {info.scale.map(note => (
          <View key={note} style={styles.notePill}>
            <Text style={styles.notePillText}>{note}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.panelSectionLabel}>Acordes diatónicos</Text>
      <View style={styles.pillRow}>
        {info.chords.map(c => (
          <View key={c} style={styles.chordPill}>
            <Text style={styles.chordPillText}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 64,
    paddingBottom: 52,
    paddingHorizontal: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appName: {
    fontSize: 12,
    letterSpacing: 8,
    color: '#3a3a4a',
    fontWeight: '600',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7c3aed',
  },
  dotOff: {
    backgroundColor: '#2a2a3a',
  },

  // Tab toggle
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0e0e18',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 17,
  },
  tabActive: {
    backgroundColor: '#7c3aed',
  },
  tabText: {
    fontSize: 11,
    color: '#3a3a5a',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: '#ffffff',
  },

  // Detector view
  chordArea: {
    flex: 1,
    justifyContent: 'center',
  },

  resetBtn: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  resetBtnText: {
    color: '#3a3a5a',
    fontSize: 16,
  },

  // Info block
  infoBlock: {
    width: '100%',
    gap: 8,
    marginBottom: 32,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#333',
    width: 76,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 12,
    color: '#888',
    width: 140,
    letterSpacing: 0.5,
  },
  infoEmpty: {
    color: '#2a2a3a',
  },

  // Circle view
  circleArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#0e0e18',
    borderRadius: 16,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 13,
  },
  modeBtnActive: {
    backgroundColor: '#1e1e2e',
  },
  modeBtnText: {
    fontSize: 11,
    color: '#3a3a5a',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  modeBtnTextActive: {
    color: '#c0c0d0',
  },

  // Manual progression
  progressionEmpty: {
    color: '#2a2a3a',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  progressionContainer: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  progressionScroll: {
    paddingHorizontal: 4,
    gap: 8,
    flexDirection: 'row',
  },
  progressionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#12121c',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  progressionPillText: {
    color: '#c0c0d0',
    fontSize: 13,
    fontWeight: '500',
  },
  progressionPillX: {
    color: '#3a3a5a',
    fontSize: 11,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  clearBtnText: {
    color: '#3a3a5a',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Error
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },

  // Button
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    paddingHorizontal: 48,
    paddingVertical: 15,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
  },
  buttonStop: {
    backgroundColor: '#7f1d1d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  buttonReset: {
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  buttonResetText: {
    color: '#3a3a5a',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Chord info modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#0e0e18',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  panelContent: {
    gap: 0,
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a3a',
    alignSelf: 'center',
    marginBottom: 20,
  },
  panelTitle: {
    color: '#f0f0f5',
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 1,
    marginBottom: 4,
  },
  panelSectionLabel: {
    color: '#3a3a5a',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  notePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1a1a28',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  notePillText: {
    color: '#9090b0',
    fontSize: 13,
  },
  chordPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#12103a',
    borderWidth: 1,
    borderColor: '#2e2860',
  },
  chordPillText: {
    color: '#c0b8f0',
    fontSize: 13,
  },

  // -------------------------------------------------------------------------
  // History scroll
  // -------------------------------------------------------------------------
  historyScrollContainer: {
    width: '100%',
    marginBottom: 8,
  },
  historyScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historySep: {
    color: '#2a2a4a',
    fontSize: 16,
    marginHorizontal: 2,
  },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#12121e',
    borderWidth: 1,
    borderColor: '#1e1e30',
    gap: 4,
  },
  historyPillActive: {
    backgroundColor: '#1a1040',
    borderColor: '#4c2a9a',
  },
  historyPillEdited: {
    borderColor: '#7c3aed',
    borderStyle: 'dashed',
  },
  historyChord: {
    color: '#505070',
    fontSize: 13,
    fontWeight: '500',
  },
  historyChordActive: {
    color: '#c0b0f0',
    fontWeight: '700',
  },
  historyEditDot: {
    color: '#7c3aed',
    fontSize: 10,
  },

  // -------------------------------------------------------------------------
  // Edit chord modal
  // -------------------------------------------------------------------------
  editModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  editModalPanel: {
    backgroundColor: '#0e0e18',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  editModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a2a3a',
    alignSelf: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    color: '#9090b0',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  editSectionLabel: {
    color: '#3a3a5a',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  editNoteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  editNoteBtn: {
    width: 44,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1a1a28',
    borderWidth: 1,
    borderColor: '#2a2a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNoteBtnActive: {
    backgroundColor: '#2a1060',
    borderColor: '#7c3aed',
  },
  editNoteText: {
    color: '#7070a0',
    fontSize: 13,
    fontWeight: '600',
  },
  editNoteTextActive: {
    color: '#c0b0f0',
  },
  editQualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  editQualityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1a1a28',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  editQualityBtnActive: {
    backgroundColor: '#2a1060',
    borderColor: '#7c3aed',
  },
  editQualityText: {
    color: '#7070a0',
    fontSize: 13,
  },
  editQualityTextActive: {
    color: '#c0b0f0',
  },
  editConfirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  editCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  editCancelText: {
    color: '#5050708',
    fontSize: 13,
  },
  editConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
  },
  editConfirmText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
