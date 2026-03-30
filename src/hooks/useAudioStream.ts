import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import AudioRecord from 'react-native-audio-record';

export interface AudioStreamState {
  samples: Float32Array | null;
  isRecording: boolean;
  error: string | null;
}

const SAMPLE_RATE = 44100;
const FLUSH_INTERVAL_MS = 300;

/** Decodes a base64 Int16 PCM chunk into a normalized Float32Array. */
function decodePcmChunk(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  const numSamples = bytes.length >> 1; // 16-bit = 2 bytes per sample
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = view.getInt16(i * 2, true) / 32768.0;
  }
  return samples;
}

/**
 * Starts/stops a real-time PCM stream from the microphone using
 * react-native-audio-record. Emits flushed Float32Array samples every
 * FLUSH_INTERVAL_MS ms via the `samples` state.
 *
 * Requires a native build (expo prebuild) — not supported in Expo Go.
 */
export function useAudioStream(): AudioStreamState & {
  start: () => Promise<void>;
  stop: () => Promise<void>;
} {
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef<Float32Array[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return;
    const chunks = bufferRef.current.splice(0);
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    setSamples(merged);
  }, []);

  const start = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de micrófono denegado');
        return;
      }

      AudioRecord.init({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6, // MediaRecorder.AudioSource.MIC on Android
        wavFile: 'lumina_tmp.wav',
      });

      AudioRecord.on('data', (data: string) => {
        bufferRef.current.push(decodePcmChunk(data));
      });

      AudioRecord.start();
      setIsRecording(true);
      setError(null);

      intervalRef.current = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar grabación');
    }
  }, [flushBuffer]);

  const stop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      await AudioRecord.stop();
    } catch {}
    setIsRecording(false);
    bufferRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { samples, isRecording, error, start, stop };
}
