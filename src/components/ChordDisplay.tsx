import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { ChordResult } from '../lib/chordDetection';

interface Props {
  chord: ChordResult | null;
  isActive: boolean;
}

const QUALITY_LABELS: Record<string, string> = {
  major:      'mayor',
  minor:      'menor',
  dom7:       'dom 7',
  maj7:       'mayor 7',
  min7:       'menor 7',
  dim:        'disminuido',
  aug:        'aumentado',
  sus2:       'sus 2',
  sus4:       'sus 4',
};

export function ChordDisplay({ chord, isActive }: Props) {
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const opacityAnim  = useRef(new Animated.Value(0.15)).current;
  const confidenceAnim = useRef(new Animated.Value(0)).current;

  // Pop-in when chord name changes
  useEffect(() => {
    if (!chord) return;
    scaleAnim.setValue(0.86);
    opacityAnim.setValue(0.3);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 260,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chord?.chord]);

  // Dim when not active
  useEffect(() => {
    if (!isActive) {
      Animated.timing(opacityAnim, {
        toValue: 0.15,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive, opacityAnim]);

  // Confidence bar — smooth fill
  useEffect(() => {
    Animated.timing(confidenceAnim, {
      toValue: chord?.confidence ?? 0,
      duration: 220,
      useNativeDriver: false, // width % can't use native driver
    }).start();
  }, [chord?.confidence, confidenceAnim]);

  const barWidth = confidenceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const chordName    = chord?.chord ?? '—';
  const qualityLabel = chord && chord.quality !== 'major'
    ? (QUALITY_LABELS[chord.quality] ?? chord.quality)
    : '';

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[styles.chordText, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {chordName}
      </Animated.Text>

      <Text style={[styles.qualityText, !qualityLabel && styles.invisible]}>
        {qualityLabel || ' '}
      </Text>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  chordText: {
    fontSize: 112,
    fontWeight: '200',
    color: '#f0f0f5',
    lineHeight: 120,
    letterSpacing: -2,
  },
  qualityText: {
    fontSize: 14,
    color: '#555',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  invisible: {
    opacity: 0,
  },
  track: {
    width: 160,
    height: 2,
    backgroundColor: '#1c1c28',
    borderRadius: 1,
    marginTop: 24,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#7c3aed',
    borderRadius: 1,
  },
});
