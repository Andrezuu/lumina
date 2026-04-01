import { useCallback, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { ExpoPlayAudioStream } from '@saltmango/expo-audio-stream';
import type { Subscription } from '@saltmango/expo-audio-stream/build/events';

export interface AudioStreamState {
  samples: Float32Array | null;
  isRecording: boolean;
  error: string | null;
}

const SAMPLE_RATE = 44100;
const CHUNK_INTERVAL_MS = 300;

/**
 * Normalizes AudioDataEvent.data to Float32Array in [-1, 1].
 * - Float32Array: returned as-is (already normalized by the lib)
 * - string (base64 Int16-LE PCM): decoded manually
 */
function toFloat32(data: string | Float32Array): Float32Array | null {
  if (data instanceof Float32Array) return data;

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  if (bytes.length < 2) return null;

  const view = new DataView(bytes.buffer);
  const numSamples = bytes.length >> 1;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768.0;
  }
  return samples;
}

/**
 * Real-time PCM stream via @saltmango/expo-audio-stream.
 * Emits new `samples` every CHUNK_INTERVAL_MS ms while recording.
 * Requires a native dev client build (not Expo Go).
 */
export function useAudioStream(): AudioStreamState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Subscription | null>(null);

  const start = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (status !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Permiso de micrófono denegado');
          return;
        }
      }

      const { subscription } = await ExpoPlayAudioStream.startMicrophone({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: 'pcm_16bit',
        interval: CHUNK_INTERVAL_MS,
        onAudioStream: async (event) => {
          if (!event.data) return;
          const decoded = toFloat32(event.data);
          if (decoded) setSamples(decoded);
        },
      });

      subscriptionRef.current = subscription ?? null;
      setIsRecording(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar grabación');
    }
  }, []);

  const stop = useCallback(async () => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    try {
      await ExpoPlayAudioStream.stopMicrophone();
    } catch {}
    setIsRecording(false);
    setSamples(null);
  }, []);

  return { samples, isRecording, error, start, stop };
}
