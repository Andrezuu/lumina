import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useChordDetection } from '../src/hooks/useChordDetection';

const MODE_LABELS: Record<string, string> = {
  ionian: 'Jónico (mayor)',
  dorian: 'Dórico',
  phrygian: 'Frigio',
  lydian: 'Lidio',
  mixolydian: 'Mixolidio',
  aeolian: 'Eólico (menor)',
  locrian: 'Locrio',
  harmonic_minor: 'Menor armónico',
  melodic_minor: 'Menor melódico',
};

export default function HomeScreen() {
  const { chord, tonality, mode, isRecording, error, start, stop } = useChordDetection();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.appName}>LUMINA</Text>

      {/* Chord display */}
      <View style={styles.chordBox}>
        <Text style={styles.chordText}>{chord?.chord ?? '—'}</Text>
        {chord && chord.quality !== 'major' && (
          <Text style={styles.qualityText}>{chord.quality}</Text>
        )}
        {chord && (
          <View style={styles.confidenceTrack}>
            <View style={[styles.confidenceFill, { width: `${Math.round(chord.confidence * 100)}%` }]} />
          </View>
        )}
      </View>

      {/* Key & mode */}
      <View style={styles.infoBlock}>
        {tonality && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tonalidad</Text>
            <Text style={styles.infoValue}>
              {tonality.key} {tonality.mode === 'major' ? 'mayor' : 'menor'}
            </Text>
          </View>
        )}
        {mode && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modo</Text>
            <Text style={styles.infoValue}>{MODE_LABELS[mode.mode] ?? mode.mode}</Text>
          </View>
        )}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stop : start}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>{isRecording ? 'Detener' : 'Iniciar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  appName: {
    position: 'absolute',
    top: 64,
    fontSize: 13,
    letterSpacing: 8,
    color: '#444',
    fontWeight: '600',
  },
  chordBox: {
    alignItems: 'center',
    marginBottom: 48,
  },
  chordText: {
    fontSize: 96,
    fontWeight: '200',
    color: '#f5f5f5',
    lineHeight: 104,
  },
  qualityText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  confidenceTrack: {
    width: 180,
    height: 3,
    backgroundColor: '#1e1e2e',
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 2,
  },
  infoBlock: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#444',
    width: 80,
    textAlign: 'right',
  },
  infoValue: {
    fontSize: 13,
    color: '#aaa',
    width: 160,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    marginTop: 48,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
  },
  buttonStop: {
    backgroundColor: '#991b1b',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
