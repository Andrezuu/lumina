import { StatusBar } from 'expo-status-bar';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRef, useEffect } from 'react';
import { useChordDetection } from '../src/hooks/useChordDetection';
import { ChordDisplay } from '../src/components/ChordDisplay';

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

export default function HomeScreen() {
  const { chord, tonality, mode, isRecording, error, start, stop } = useChordDetection();

  // Recording pulse dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, pulseAnim]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>LUMINA</Text>
        <Animated.View style={[styles.dot, { opacity: pulseAnim }, !isRecording && styles.dotOff]} />
      </View>

      {/* Main chord */}
      <View style={styles.chordArea}>
        <ChordDisplay chord={chord} isActive={isRecording} />
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

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Button */}
      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stop : start}
        activeOpacity={0.75}
      >
        <Text style={styles.buttonText}>{isRecording ? 'Detener' : 'Iniciar'}</Text>
      </TouchableOpacity>
    </View>
  );
}

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

  // Chord
  chordArea: {
    flex: 1,
    justifyContent: 'center',
  },

  // Info
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
});
