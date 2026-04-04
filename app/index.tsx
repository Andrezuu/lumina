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
import { ChordDisplay } from '../src/components/ChordDisplay';
import { CircleOfFifths } from '../src/components/CircleOfFifths';
import { getKeyInfo, type KeyInfo } from '../src/lib/circleOfFifths';

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

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { chord, tonality, mode, chordHistory, isRecording, error, start, stop } =
    useChordDetection();

  // View state
  const [activeView, setActiveView] = useState<'detector' | 'circulo'>('detector');

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
        {(['detector', 'circulo'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeView === tab && styles.tabActive]}
            onPress={() => setActiveView(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeView === tab && styles.tabTextActive]}>
              {tab === 'detector' ? 'Detector' : 'Círculo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Detector view ─────────────────────────────────────── */}
      {activeView === 'detector' ? (
        <>
          <View style={styles.chordArea}>
            <ChordDisplay chord={chord} isActive={isRecording} />
          </View>

          {/* Chord history */}
          <View style={styles.historyRow}>
            {chordHistory.map((name, i) => {
              const opacities = [0.2, 0.38, 0.62, 1.0];
              const offset    = chordHistory.length - 1 - i;
              const opacity   = opacities[Math.min(offset, opacities.length - 1)];
              const isNewest  = i === chordHistory.length - 1;
              return (
                <View key={i} style={styles.historyItem}>
                  {i > 0 && <Text style={[styles.historySep, { opacity }]}>›</Text>}
                  <View style={[styles.historyPill, isNewest && styles.historyPillActive]}>
                    <Text style={[styles.historyChord, { opacity }]}>{name}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Key + mode */}
          <View style={styles.infoBlock}>
            <InfoRow
              label="Tonalidad"
              value={tonality ? `${tonality.key} ${tonality.mode === 'major' ? 'mayor' : 'menor'}` : null}
            />
            <InfoRow
              label="Modo"
              value={mode ? (MODE_LABELS[mode.mode] ?? mode.mode) : null}
            />
          </View>
        </>
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
            chordHistory={manualMode ? [] : chordHistory}
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

      {/* Start / Stop button — hidden in manual mode */}
      {!manualMode && (
        <TouchableOpacity
          style={[styles.button, isRecording && styles.buttonStop]}
          onPress={isRecording ? stop : start}
          activeOpacity={0.75}
        >
          <Text style={styles.buttonText}>{isRecording ? 'Detener' : 'Iniciar'}</Text>
        </TouchableOpacity>
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

  // Chord history
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    minHeight: 32,
    gap: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historySep: {
    color: '#3a3a4a',
    fontSize: 14,
  },
  historyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  historyPillActive: {
    borderColor: '#7c3aed',
  },
  historyChord: {
    color: '#c0c0d0',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
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
});
