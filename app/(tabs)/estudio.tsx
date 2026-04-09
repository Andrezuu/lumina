/**
 * app/(tabs)/estudio.tsx  (Tab 2 — El Estudio)
 *
 * Máquina de estados de la sesión de estudio:
 *
 *   IDLE        → pantalla de espera, botón "Iniciar"
 *   CALIBRATING → micrófono activo, contador "Escuchando acordes… (X/4)"
 *                 El detector corre normalmente; observamos calibrationBuffer.
 *                 Al llegar a 4 acordes únicos → CONFIRMING (audio sigue).
 *   CONFIRMING  → modal bottom-sheet: tonalidad inferida + 4 acordes editables.
 *                 Confirmar → RECORDING  |  Repetir → reset + CALIBRATING
 *   RECORDING   → sesión activa, detector libre, historial expandible.
 */

import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { useRef, useEffect, useState, useMemo } from 'react';

import { useChordDetection, CALIBRATION_SIZE, TonalityResult } from '../../src/hooks/useChordDetection';
import { ChordDisplay } from '../../src/components/ChordDisplay';
import {
  createSession,
  createBlock,
  createChords,
  parseChordName,
  updateSession,
  extractErrorMessage,
} from '../../src/services/sessionService';
import { useHarmonicEngine } from '../../src/hooks/useHarmonicEngine';
import type { ChordSuggestion } from '../../src/lib/harmonicSuggestions';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SessionPhase = 'IDLE' | 'CALIBRATING' | 'CONFIRMING' | 'RECORDING';

// ─── Constantes ───────────────────────────────────────────────────────────────

const EDIT_NOTES     = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const EDIT_QUALITIES = ['', 'm', '7', 'maj7', 'm7', 'dim', 'aug', 'sus2', 'sus4'] as const;
const QUALITY_LABELS: Record<string, string> = {
  '': 'maj', m: 'm', '7': '7', maj7: 'maj7', m7: 'm7',
  dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
};
const MODE_LABELS: Record<string, string> = {
  ionian: 'Jónico', dorian: 'Dórico', phrygian: 'Frigio',
  lydian: 'Lidio', mixolydian: 'Mixolidio', aeolian: 'Eólico',
  locrian: 'Locrio', harmonic_minor: 'Menor armónico', melodic_minor: 'Menor melódico',
};

// ─── EstudioScreen ────────────────────────────────────────────────────────────

export default function EstudioScreen() {
  // ── Tonality lock ─────────────────────────────────────────────────────────
  // Confirmed during the CONFIRMING modal; fed to the hook to bypass live detection.
  const [isTonalityLocked, setIsTonalityLocked] = useState(false);
  const [lockedTonality,   setLockedTonality]   = useState<TonalityResult | null>(null);

  // ── Backend session state ──────────────────────────────────────────────────
  const [sessionId,    setSessionId]    = useState<string | null>(null);
  const [blockId,      setBlockId]      = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // Panel de sugerencias — visible solo en RECORDING cuando hay sugerencias
  const [showSuggestions, setShowSuggestions] = useState(false);

  const {
    chord, tonality, mode,
    chordHistory, calibrationBuffer,
    isRecording, error,
    start, stop, hasSignal, rmsDb,
    resetHistory, editChord, recomputeTonalityForChords,
  } = useChordDetection({
    lockedTonality: isTonalityLocked ? lockedTonality : null,
  });

  // ── Motor de Inferencia Armónica ───────────────────────────────────────────
  // Sólo activo en RECORDING con tonalidad bloqueada.
  const historyNames     = useMemo(() => chordHistory.map(e => e.chord), [chordHistory]);
  const currentChordName = chord?.chord ?? null;
  const engineTonality   = isTonalityLocked ? lockedTonality : null;
  const harmonicEngine   = useHarmonicEngine(engineTonality, historyNames, currentChordName);

  const [phase, setPhase] = useState<SessionPhase>('IDLE');

  // Acordes capturados durante calibración — se editan en el modal de confirmación
  const [confirmedChords, setConfirmedChords] = useState<string[]>([]);

  // Tonalidad local del modal — se recalcula cuando el usuario edita un acorde
  const [localTonality, setLocalTonality] = useState<TonalityResult | null>(null);

  // ── Transición CALIBRATING → CONFIRMING ────────────────────────────────────
  useEffect(() => {
    if (phase === 'CALIBRATING' && calibrationBuffer.length >= CALIBRATION_SIZE) {
      setConfirmedChords([...calibrationBuffer]);
      setLocalTonality(tonality);        // snapshot inicial del modal
      setPhase('CONFIRMING');
    }
  }, [calibrationBuffer, phase]);

  // ── Recalcular tonalidad local cuando el usuario edita acordes en CONFIRMING ─
  useEffect(() => {
    if (phase !== 'CONFIRMING' || confirmedChords.length === 0) return;
    const recomputed = recomputeTonalityForChords(confirmedChords);
    setLocalTonality(recomputed);
  }, [confirmedChords, phase, recomputeTonalityForChords]);

  // ── Modal de edición de acorde (usado en RECORDING y en CONFIRMING) ────────
  const [editingIndex,    setEditingIndex]    = useState<number | null>(null);
  const [editingContext,  setEditingContext]  = useState<'recording' | 'confirming'>('recording');
  const [editRoot,        setEditRoot]        = useState('C');
  const [editQuality,     setEditQuality]     = useState('');

  const openEditRecording = (i: number) => {
    const entry = chordHistory[i];
    if (!entry) return;
    const m = entry.chord.match(/^([A-G][#b]?)(.*)$/);
    setEditRoot(m ? m[1] : 'C');
    setEditQuality(m ? m[2] : '');
    setEditingContext('recording');
    setEditingIndex(i);
  };

  const openEditConfirming = (i: number) => {
    const chord = confirmedChords[i];
    if (chord == null) return;
    const m = chord.match(/^([A-G][#b]?)(.*)$/);
    setEditRoot(m ? m[1] : 'C');
    setEditQuality(m ? m[2] : '');
    setEditingContext('confirming');
    setEditingIndex(i);
  };

  const confirmEdit = () => {
    if (editingIndex === null) return;
    const newChord = `${editRoot}${editQuality}`;
    if (editingContext === 'recording') {
      editChord(editingIndex, newChord);
    } else {
      setConfirmedChords(prev =>
        prev.map((c, i) => i === editingIndex ? newChord : c),
      );
    }
    setEditingIndex(null);
  };

  // ── Pulso del indicador de grabación ──────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRecording) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  // ── Fade-in del texto de calibración ──────────────────────────────────────
  const calFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === 'CALIBRATING') {
      Animated.timing(calFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      calFade.setValue(0);
    }
  }, [phase, calFade]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStart = () => {
    resetHistory();
    setConfirmedChords([]);
    setIsTonalityLocked(false);
    setLockedTonality(null);
    setPhase('CALIBRATING');
    start();
  };

  const handleStop = () => {
    stop();
    setPhase('IDLE');
    setConfirmedChords([]);
    setIsTonalityLocked(false);
    setLockedTonality(null);
    setSessionId(null);
    setBlockId(null);
    setSubmitError(null);
  };

  const handleRepeatCalibration = () => {
    resetHistory();
    setConfirmedChords([]);
    setLocalTonality(null);
    setIsTonalityLocked(false);
    setLockedTonality(null);
    setSubmitError(null);
    setPhase('CALIBRATING');
    // audio ya está activo — solo limpiamos el buffer
  };

  const handleConfirmTonality = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1 — Create session using the locally computed (possibly edited) tonality
      const tonalityLabel = localTonality
        ? `${localTonality.key} ${localTonality.mode === 'major' ? 'mayor' : 'menor'}`
        : undefined;

      const session = await createSession({ title: tonalityLabel });
      setSessionId(session.id);

      // 2 — Patch session with detected tonality string (e.g. "Am")
      if (localTonality) {
        await updateSession(session.id, {
          detectedTonality: `${localTonality.key}${localTonality.mode === 'major' ? '' : 'm'}`,
        });
      }

      // 3 — Create the first block ("Calibración")
      const block = await createBlock(session.id, {
        label: 'Calibración',
        keyCenter: localTonality
          ? `${localTonality.key}${localTonality.mode === 'major' ? '' : 'm'}`
          : undefined,
      });
      setBlockId(block.id);

      // 4 — Send the 4 calibration chords as a batch
      const chordPayloads = confirmedChords.map(name => ({
        chordName: name,
        ...parseChordName(name),
        detectedAt: new Date().toISOString(),
      }));
      await createChords(block.id, chordPayloads);

      // 5 — Lock the locally computed tonality and transition to RECORDING
      if (localTonality) {
        setLockedTonality(localTonality);
        setIsTonalityLocked(true);
      }
      setPhase('RECORDING');
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Error al conectar con el servidor'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Cabecera ── */}
      <View style={s.header}>
        <Text style={s.appName}>LUMINA</Text>
        <Animated.View style={[s.dot, { opacity: pulseAnim }, !isRecording && s.dotOff]} />

        {/* Candado de tonalidad — solo visible en RECORDING */}
        {phase === 'RECORDING' && lockedTonality && (
          <TouchableOpacity
            style={[s.lockBtn, isTonalityLocked && s.lockBtnActive]}
            onPress={() => setIsTonalityLocked(prev => !prev)}
            activeOpacity={0.75}
          >
            <Text style={[s.lockIcon, isTonalityLocked && s.lockIconActive]}>
              {isTonalityLocked ? '🔒' : '🔓'}
            </Text>
            <Text style={[s.lockLabel, isTonalityLocked && s.lockLabelActive]}>
              {isTonalityLocked
                ? `${lockedTonality.key} ${lockedTonality.mode === 'major' ? 'M' : 'm'}`
                : 'Libre'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════
          IDLE — pantalla de espera
      ══════════════════════════════════════════════════════════ */}
      {phase === 'IDLE' && (
        <View style={s.idleArea}>
          <Text style={s.idleTitle}>El Estudio</Text>
          <Text style={s.idleSubtitle}>
            Inicia una sesión para detectar{'\n'}acordes en tiempo real
          </Text>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════
          CALIBRATING — escucha activa con contador
      ══════════════════════════════════════════════════════════ */}
      {(phase === 'CALIBRATING' || phase === 'CONFIRMING') && (
        <View style={s.chordArea}>
          <ChordDisplay chord={chord} isActive={isRecording} hasSignal={hasSignal} rmsDb={rmsDb} />
        </View>
      )}

      {phase === 'CALIBRATING' && (
        <Animated.View style={[s.calBlock, { opacity: calFade }]}>
          <Text style={s.calLabel}>Escuchando acordes…</Text>
          {/* Contador numérico */}
          <Text style={s.calCounter}>
            {calibrationBuffer.length}
            <Text style={s.calCounterDim}>/{CALIBRATION_SIZE}</Text>
          </Text>
          {/* Dots de progreso */}
          <View style={s.calDots}>
            {Array.from({ length: CALIBRATION_SIZE }).map((_, i) => (
              <View
                key={i}
                style={[s.calDot, i < calibrationBuffer.length && s.calDotActive]}
              />
            ))}
          </View>
          {/* Acordes capturados hasta ahora */}
          {calibrationBuffer.length > 0 && (
            <View style={s.calChords}>
              {calibrationBuffer.map((ch, i) => (
                <View key={i} style={s.calChordPill}>
                  <Text style={s.calChordText}>{ch}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECORDING — sesión activa
      ══════════════════════════════════════════════════════════ */}
      {phase === 'RECORDING' && (
        <>
          <View style={s.chordArea}>
            <ChordDisplay chord={chord} isActive={isRecording} hasSignal={hasSignal} rmsDb={rmsDb} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.historyScroll}
            style={s.historyScrollWrap}
          >
            {chordHistory.map((entry, i) => {
              const isNewest = i === chordHistory.length - 1;
              return (
                <View key={i} style={s.historyItem}>
                  {i > 0 && <Text style={s.historySep}>›</Text>}
                  <TouchableOpacity
                    style={[
                      s.historyPill,
                      isNewest && s.historyPillActive,
                      entry.edited && s.historyPillEdited,
                    ]}
                    onPress={() => openEditRecording(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.historyChord, isNewest && s.historyChordActive]}>
                      {entry.chord}
                    </Text>
                    {entry.edited && <Text style={s.historyEditDot}>✎</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <View style={s.infoBlock}>
            <InfoRow
              label="Tonalidad"
              value={
                (() => {
                  const t = isTonalityLocked ? lockedTonality : tonality;
                  return t ? `${t.key} ${t.mode === 'major' ? 'mayor' : 'menor'}` : null;
                })()
              }
              locked={isTonalityLocked}
            />
            <InfoRow
              label="Modo"
              value={mode ? (MODE_LABELS[mode.mode] ?? mode.mode) : null}
            />
          </View>

          {/* ── Botón flotante "Ruedas de Apoyo" — abre bottom-sheet modal ── */}
          {harmonicEngine.hasSuggestions && (
            <TouchableOpacity
              style={s.suggestionsToggle}
              onPress={() => setShowSuggestions(p => !p)}
              activeOpacity={0.75}
            >
              <Text style={s.suggestionsToggleText}>
                ✦ Ruedas de Apoyo
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          BOTTOM-SHEET: Ruedas de Apoyo
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={showSuggestions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <TouchableOpacity
          style={s.sugBackdrop}
          activeOpacity={1}
          onPress={() => setShowSuggestions(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.sugSheet}>
            <View style={s.sugHandle} />
            <Text style={s.sugSheetTitle}>Ruedas de Apoyo</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.sugSheetContent}
            >
              <SuggestionRow label="Acordes de la tonalidad" items={harmonicEngine.diatonicScale} maxItems={7} />
              <View style={s.sugDivider} />
              <SuggestionRow label="Siguiente diatónico"    items={harmonicEngine.diatonic} />
              <SuggestionRow label="Intercambio modal"       items={harmonicEngine.modal}    />
              <SuggestionRow label="Dominante secundario"   items={harmonicEngine.secondary} />
              {harmonicEngine.deceptive.length > 0 && (
                <SuggestionRow label="Cadencia deceptiva"   items={harmonicEngine.deceptive} />
              )}
              {harmonicEngine.texture.length > 0 && (
                <SuggestionRow label="Textura"              items={harmonicEngine.texture}   />
              )}
            </ScrollView>

            <TouchableOpacity
              style={s.sugCloseBtn}
              onPress={() => setShowSuggestions(false)}
              activeOpacity={0.8}
            >
              <Text style={s.sugCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      {/* ── Controles principales ── */}
      <View style={s.controls}>
        {phase === 'IDLE' && (
          <TouchableOpacity style={s.btnPrimary} onPress={handleStart} activeOpacity={0.85}>
            <Text style={s.btnPrimaryText}>Iniciar</Text>
          </TouchableOpacity>
        )}
        {phase === 'CALIBRATING' && (
          <TouchableOpacity style={[s.btnPrimary, s.btnStop]} onPress={handleStop} activeOpacity={0.85}>
            <Text style={s.btnPrimaryText}>Cancelar</Text>
          </TouchableOpacity>
        )}
        {phase === 'RECORDING' && (
          <>
            <TouchableOpacity style={s.btnSecondary} onPress={() => resetHistory()} activeOpacity={0.75}>
              <Text style={s.btnSecondaryText}>Reiniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, s.btnStop]} onPress={handleStop} activeOpacity={0.85}>
              <Text style={s.btnPrimaryText}>Detener</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN TONAL (fase CONFIRMING)
      ══════════════════════════════════════════════════════════ */}
      <Modal
        visible={phase === 'CONFIRMING'}
        transparent
        animationType="slide"
        onRequestClose={handleRepeatCalibration}
      >
        <View style={s.confirmBackdrop}>
          <View style={s.confirmPanel}>
            <View style={s.confirmHandle} />

            <Text style={s.confirmTitle}>Tonalidad detectada</Text>

            {/* Tonalidad inferida — se recalcula si el usuario edita acordes */}
            <View style={s.tonalityCard}>
              <Text style={s.tonalityKey}>
                {localTonality
                  ? `${localTonality.key} ${localTonality.mode === 'major' ? 'mayor' : 'menor'}`
                  : '—'}
              </Text>
              {localTonality && mode && (
                <Text style={s.tonalityMode}>
                  {MODE_LABELS[mode.mode] ?? mode.mode}
                </Text>
              )}
            </View>

            {/* Acordes capturados — editables */}
            <Text style={s.confirmSectionLabel}>Acordes capturados</Text>
            <Text style={s.confirmSectionHint}>
              Toca un acorde para corregirlo si el detector falló
            </Text>
            <View style={s.confirmChords}>
              {confirmedChords.map((ch, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.confirmChordChip}
                  onPress={() => openEditConfirming(i)}
                  activeOpacity={0.75}
                >
                  <Text style={s.confirmChordText}>{ch}</Text>
                  <Text style={s.confirmChordEdit}>✎</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Error de conexión */}
            {submitError ? (
              <View style={s.submitErrorBox}>
                <Text style={s.submitErrorText}>{submitError}</Text>
              </View>
            ) : null}

            {/* Acciones */}
            <View style={s.confirmActions}>
              <TouchableOpacity
                style={[s.confirmRepeat, isSubmitting && s.confirmBtnDisabled]}
                onPress={handleRepeatCalibration}
                activeOpacity={0.8}
                disabled={isSubmitting}
              >
                <Text style={s.confirmRepeatText}>Repetir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmOk, isSubmitting && s.confirmBtnDisabled]}
                onPress={handleConfirmTonality}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                <Text style={s.confirmOkText}>
                  {isSubmitting ? 'Conectando…' : 'Confirmar y grabar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: editor de acorde (nota + calidad) ── */}
      <Modal
        visible={editingIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingIndex(null)}
      >
        <TouchableOpacity
          style={s.editorBackdrop}
          activeOpacity={1}
          onPress={() => setEditingIndex(null)}
        >
          <TouchableOpacity activeOpacity={1} style={s.editorPanel}>
            <View style={s.editorHandle} />
            <Text style={s.editorTitle}>Editar acorde</Text>

            <Text style={s.editorLabel}>Nota raíz</Text>
            <View style={s.editorGrid}>
              {EDIT_NOTES.map(note => (
                <TouchableOpacity
                  key={note}
                  style={[s.editorChip, editRoot === note && s.editorChipActive]}
                  onPress={() => setEditRoot(note)}
                >
                  <Text style={[s.editorChipText, editRoot === note && s.editorChipTextActive]}>
                    {note}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.editorLabel}>Calidad</Text>
            <View style={s.editorGrid}>
              {EDIT_QUALITIES.map(q => (
                <TouchableOpacity
                  key={q || '__maj'}
                  style={[s.editorChip, editQuality === q && s.editorChipActive]}
                  onPress={() => setEditQuality(q)}
                >
                  <Text style={[s.editorChipText, editQuality === q && s.editorChipTextActive]}>
                    {QUALITY_LABELS[q]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.editorActions}>
              <TouchableOpacity style={s.editorCancel} onPress={() => setEditingIndex(null)}>
                <Text style={s.editorCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.editorConfirm} onPress={confirmEdit}>
                <Text style={s.editorConfirmText}>Guardar — {editRoot}{editQuality || ' maj'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function InfoRow({ label, value, locked }: { label: string; value: string | null; locked?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, !value && s.infoEmpty, locked && s.infoValueLocked]}>
        {value ?? '—'}{locked ? '  🔒' : ''}
      </Text>
    </View>
  );
}

// ─── SuggestionRow ────────────────────────────────────────────────────────────

const FUNCTION_COLOR: Record<string, string> = {
  tonic:       '#3a6aed',
  subdominant: '#2a8a5a',
  dominant:    '#9a3aed',
  leading:     '#c07030',
};

function SuggestionRow({ label, items, maxItems = 4 }: { label: string; items: ChordSuggestion[]; maxItems?: number }) {
  if (items.length === 0) return null;
  return (
    <View style={s.sugRow}>
      <Text style={s.sugRowLabel}>{label}</Text>
      <View style={s.sugChips}>
        {items.slice(0, maxItems).map((item, i) => (
          <View key={i} style={[s.sugChip, { borderColor: FUNCTION_COLOR[item.function] ?? '#1e1e2e' }]}>
            <Text style={s.sugChipChord}>{item.chord}</Text>
            <Text style={[s.sugChipDegree, { color: FUNCTION_COLOR[item.function] ?? '#404060' }]}>
              {item.degree}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 28,
  },

  // Cabecera
  header:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appName: { fontSize: 12, letterSpacing: 8, color: '#1e1e2e', fontWeight: '600' },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c3aed' },
  dotOff:  { backgroundColor: '#1a1a28' },

  // Candado de tonalidad
  lockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#1e1e2e', backgroundColor: 'transparent',
    marginLeft: 8,
  },
  lockBtnActive: { borderColor: '#7c3aed', backgroundColor: '#12103a' },
  lockIcon:      { fontSize: 11 },
  lockIconActive: {},
  lockLabel:     { color: '#252535', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  lockLabelActive: { color: '#a080e0' },

  // IDLE
  idleArea:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  idleTitle:    { color: '#c0b0f0', fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  idleSubtitle: { color: '#2a2a4a', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Chord display
  chordArea: { flex: 1, justifyContent: 'center', width: '100%' },

  // Calibración
  calBlock: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    width: '100%',
  },
  calLabel:       { color: '#404060', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  calCounter:     { color: '#c0b0f0', fontSize: 52, fontWeight: '200', letterSpacing: -2 },
  calCounterDim:  { color: '#2a2a4a', fontSize: 32, fontWeight: '200' },
  calDots:        { flexDirection: 'row', gap: 10 },
  calDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a1a28', borderWidth: 1, borderColor: '#2a2a3a' },
  calDotActive:   { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  calChords:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  calChordPill:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: '#12103a', borderWidth: 1, borderColor: '#2a2060' },
  calChordText:   { color: '#c0b0f0', fontSize: 14, fontWeight: '600' },

  // Historial (RECORDING)
  historyScrollWrap: { width: '100%', marginBottom: 8 },
  historyScroll:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2, gap: 4 },
  historyItem:       { flexDirection: 'row', alignItems: 'center' },
  historySep:        { color: '#1e1e2e', fontSize: 16, marginHorizontal: 2 },
  historyPill:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#10101a', borderWidth: 1, borderColor: '#1a1a28', gap: 4 },
  historyPillActive: { backgroundColor: '#16103a', borderColor: '#4c2a9a' },
  historyPillEdited: { borderColor: '#7c3aed' },
  historyChord:      { color: '#404060', fontSize: 13, fontWeight: '500' },
  historyChordActive:{ color: '#c0b0f0', fontWeight: '700' },
  historyEditDot:    { color: '#7c3aed', fontSize: 10 },

  // Info block
  infoBlock:       { width: '100%', gap: 6, marginBottom: 10 },
  infoRow:         { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  infoLabel:       { fontSize: 11, color: '#1e1e2e', width: 72, textAlign: 'right', letterSpacing: 0.5 },
  infoValue:       { fontSize: 11, color: '#707090', width: 140, letterSpacing: 0.5 },
  infoEmpty:       { color: '#1a1a28' },
  infoValueLocked: { color: '#a080e0' },

  errorText: { color: '#f87171', fontSize: 12, marginBottom: 12, textAlign: 'center' },

  // Controles
  controls:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btnPrimary:       { paddingHorizontal: 52, paddingVertical: 16, borderRadius: 32, backgroundColor: '#7c3aed' },
  btnStop:          { backgroundColor: '#5a1a1a' },
  btnPrimaryText:   { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  btnSecondary:     { paddingHorizontal: 24, paddingVertical: 16, borderRadius: 32, borderWidth: 1, borderColor: '#1e1e2e' },
  btnSecondaryText: { color: '#2a2a3a', fontSize: 14, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },

  // ── Modal de confirmación tonal ────────────────────────────────────────────
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
  },
  confirmPanel: {
    backgroundColor: '#0c0c18',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#1e1e30',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 24,
    gap: 0,
  },
  confirmHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 24,
  },
  confirmTitle: {
    color: '#505070', fontSize: 10, letterSpacing: 3,
    textTransform: 'uppercase', textAlign: 'center', marginBottom: 20,
  },
  tonalityCard: {
    backgroundColor: '#12103a', borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2060',
    paddingVertical: 20, alignItems: 'center', gap: 4, marginBottom: 24,
  },
  tonalityKey:  { color: '#c0b0f0', fontSize: 32, fontWeight: '300', letterSpacing: -0.5 },
  tonalityMode: { color: '#4a3a7a', fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },

  confirmSectionLabel: {
    color: '#2a2a4a', fontSize: 10, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 4,
  },
  confirmSectionHint: {
    color: '#1e1e2e', fontSize: 11, marginBottom: 12,
  },
  confirmChords: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 28 },
  confirmChordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 16, backgroundColor: '#14121e',
    borderWidth: 1, borderColor: '#2a2a3a',
  },
  confirmChordText: { color: '#c0b0f0', fontSize: 16, fontWeight: '600' },
  confirmChordEdit: { color: '#3a2a6a', fontSize: 11 },

  confirmActions: { flexDirection: 'row', gap: 10 },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmRepeat: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    borderWidth: 1, borderColor: '#1e1e2e', alignItems: 'center',
  },
  confirmRepeatText: { color: '#404060', fontSize: 14, fontWeight: '600' },
  confirmOk: {
    flex: 2, paddingVertical: 14, borderRadius: 18,
    backgroundColor: '#7c3aed', alignItems: 'center',
  },
  confirmOkText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  // Error de conexión
  submitErrorBox: {
    backgroundColor: '#1a0a0a', borderRadius: 12,
    borderWidth: 1, borderColor: '#5a1a1a',
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10,
  },
  submitErrorText: { color: '#f87171', fontSize: 12, lineHeight: 18 },

  // ── Modal editor de acorde ─────────────────────────────────────────────────
  editorBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' },
  editorPanel:    {
    backgroundColor: '#0e0e18',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: '#1a1a28',
    paddingTop: 12, paddingBottom: 48, paddingHorizontal: 20,
  },
  editorHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 16 },
  editorTitle:    { color: '#505070', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 },
  editorLabel:    { color: '#252535', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  editorGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editorChip:         { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#12121e', borderWidth: 1, borderColor: '#1e1e2e', minWidth: 44, alignItems: 'center' },
  editorChipActive:   { backgroundColor: '#20104a', borderColor: '#7c3aed' },
  editorChipText:     { color: '#404060', fontSize: 13, fontWeight: '600' },
  editorChipTextActive:{ color: '#c0b0f0' },
  editorActions:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  editorCancel:   { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: '#1e1e2e' },
  editorCancelText:{ color: '#303050', fontSize: 13 },
  editorConfirm:  { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 16, backgroundColor: '#7c3aed' },
  editorConfirmText:{ color: '#fff', fontSize: 13, fontWeight: '600' },

  // ── Panel de Sugerencias Armónicas ────────────────────────────────────────
  suggestionsToggle: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2060',
    backgroundColor: '#12103a',
    marginBottom: 8,
  },
  suggestionsToggleText: { color: '#a080e0', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600' },

  // Bottom-sheet de Ruedas de Apoyo
  sugBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sugSheet: {
    backgroundColor: '#0c0c18',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: '#1e1e30',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 24,
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  sugHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 16,
  },
  sugSheetTitle: {
    color: '#505070', fontSize: 10, letterSpacing: 3,
    textTransform: 'uppercase', textAlign: 'center', marginBottom: 16,
  },
  sugSheetContent: { gap: 10, paddingBottom: 8 },
  sugCloseBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  sugCloseBtnText: { color: '#404060', fontSize: 13, fontWeight: '600' },

  // Cada fila de motor
  sugRow:      { gap: 4 },
  sugRowLabel: { color: '#252540', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase' },
  sugChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sugChip: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: '#0c0c18',
    alignItems: 'center',
    minWidth: 48,
  },
  sugChipChord:  { color: '#a090d0', fontSize: 13, fontWeight: '700' },
  sugChipDegree: { fontSize: 9, letterSpacing: 0.5, marginTop: 1 },
  sugDivider:    { height: 1, backgroundColor: '#14142a', marginVertical: 2 },
});
