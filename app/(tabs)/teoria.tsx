/**
 * app/(tabs)/teoria.tsx  (Tab 3 — Círculo de Quintas)
 *
 * El CircleOfFifths vive aquí de forma completamente independiente:
 *   • Estado local propio (modo manual / progresión personalizada)
 *   • Sin conexión al detector de acordes del Tab 2
 *   • Sin imports de useChordDetection ni useAudioStream
 *
 * Esto garantiza que navegar a esta pestaña no afecta al rendimiento
 * del detector en tiempo real.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { CircleOfFifths } from '../../src/components/CircleOfFifths';
import {
  getKeyInfo,
  type KeyInfo,
} from '../../src/lib/circleOfFifths';

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function TeoriaScreen() {
  // Modo de uso del círculo
  const [manualMode, setManualMode]               = useState(true);
  const [customProgression, setCustomProgression] = useState<string[]>([]);

  // Segmento seleccionado → modal de info de tonalidad
  const [selectedSegment, setSelectedSegment] =
    useState<{ root: string; mode: 'major' | 'minor' } | null>(null);

  const keyInfo: KeyInfo | null = useMemo(
    () => selectedSegment
      ? getKeyInfo(selectedSegment.root, selectedSegment.mode)
      : null,
    [selectedSegment],
  );

  const handleManualAdd = (label: string) => {
    if (customProgression.length < 8)
      setCustomProgression(prev => [...prev, label]);
  };

  return (
    <View style={s.root}>

      {/* ── Cabecera ── */}
      <View style={s.header}>
        <Text style={s.title}>Círculo de Quintas</Text>
        <Text style={s.subtitle}>Toca un segmento para explorar la tonalidad</Text>
      </View>

      {/* ── Toggle modo ── */}
      <View style={s.modeRow}>
        {([true, false] as const).map(isManual => (
          <TouchableOpacity
            key={String(isManual)}
            style={[s.modeBtn, manualMode === isManual && s.modeBtnActive]}
            onPress={() => setManualMode(isManual)}
            activeOpacity={0.75}
          >
            <Text style={[s.modeBtnText, manualMode === isManual && s.modeBtnTextActive]}>
              {isManual ? 'Manual' : 'Info'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Círculo ── */}
      <View style={s.circleWrap}>
        <CircleOfFifths
          tonality={null}
          chord={null}
          chordHistory={[]}
          onSegmentPress={(root, mode) => setSelectedSegment({ root, mode })}
          manualMode={manualMode}
          customProgression={customProgression}
          onManualAdd={handleManualAdd}
        />
      </View>

      {/* ── Progresión manual ── */}
      {manualMode && (
        customProgression.length === 0 ? (
          <Text style={s.progressionHint}>
            Toca los segmentos para construir una progresión
          </Text>
        ) : (
          <View style={s.progressionWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.progressionScroll}
            >
              {customProgression.map((label, i) => (
                <View key={i} style={s.pill}>
                  <Text style={s.pillText}>{label}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setCustomProgression(prev => prev.filter((_, j) => j !== i))
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={s.pillX}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => setCustomProgression([])}
            >
              <Text style={s.clearBtnText}>Limpiar</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {/* ── Modal: info de tonalidad (modo Info) ── */}
      <Modal
        visible={selectedSegment !== null && !manualMode}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSegment(null)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedSegment(null)}
        >
          <TouchableOpacity activeOpacity={1} style={s.modalPanel}>
            {keyInfo && <KeyInfoPanel info={keyInfo} />}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ─── Panel de información de tonalidad ───────────────────────────────────────

function KeyInfoPanel({ info }: { info: KeyInfo }) {
  return (
    <View style={s.panelContent}>
      <View style={s.panelHandle} />
      <Text style={s.panelTitle}>{info.displayName}</Text>

      <Text style={s.panelLabel}>Escala</Text>
      <View style={s.pillRow}>
        {info.scale.map(note => (
          <View key={note} style={s.notePill}>
            <Text style={s.notePillText}>{note}</Text>
          </View>
        ))}
      </View>

      <Text style={s.panelLabel}>Acordes diatónicos</Text>
      <View style={s.pillRow}>
        {info.chords.map(c => (
          <View key={c} style={s.chordPill}>
            <Text style={s.chordPillText}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06060f',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
    gap: 16,
  },

  // Cabecera
  header:   { alignItems: 'center', gap: 4, width: '100%' },
  title:    { color: '#c0b0f0', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: '#2a2a4a', fontSize: 12 },

  // Toggle modo
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#0e0e18',
    borderRadius: 16,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 13,
  },
  modeBtnActive:    { backgroundColor: '#1e1640' },
  modeBtnText:      { fontSize: 11, color: '#2a2a4a', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  modeBtnTextActive:{ color: '#c0b0f0' },

  // Círculo
  circleWrap: { alignItems: 'center', justifyContent: 'center' },

  // Progresión manual
  progressionHint: {
    color: '#1e1e2e',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  progressionWrap:  { width: '100%', alignItems: 'center', gap: 10 },
  progressionScroll:{ paddingHorizontal: 4, gap: 8, flexDirection: 'row' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#10101a',
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  pillText: { color: '#c0b0f0', fontSize: 13, fontWeight: '500' },
  pillX:    { color: '#2a2a4a', fontSize: 11 },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1a2a',
  },
  clearBtnText: { color: '#2a2a4a', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#0e0e18',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#1a1a28',
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  panelContent:  { gap: 0 },
  panelHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 20 },
  panelTitle:    { color: '#f0f0f5', fontSize: 22, fontWeight: '300', letterSpacing: 0.5, marginBottom: 4 },
  panelLabel:    { color: '#2a2a4a', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  pillRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  notePill:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#14141e', borderWidth: 1, borderColor: '#1e1e2e' },
  notePillText:  { color: '#8080a0', fontSize: 13 },
  chordPill:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#12103a', borderWidth: 1, borderColor: '#2a2060' },
  chordPillText: { color: '#c0b8f0', fontSize: 13 },
});
