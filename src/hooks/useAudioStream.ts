import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { ExpoPlayAudioStream, EncodingTypes } from '@saltmango/expo-audio-stream';

export interface AudioStreamState {
  samples: Float32Array | null;
  isRecording: boolean;
  error: string | null;
}

const SAMPLE_RATE = 44100;
const CHUNK_INTERVAL_MS = 300;

/** Decodes a base64 Int16-LE PCM chunk → normalized Float32Array in [-1, 1]. */
function decodePcmChunk(data: string | Uint8Array | ArrayBuffer): Float32Array | null {
  let bytes: Uint8Array;

  if (typeof data === 'string') {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }

  if (bytes.length < 2) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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

  const subscriptionRef = useRef<{ remove: () => void } | null>(null);

  const start = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de micrófono denegado');
        return;
      }

      const { subscription } = await ExpoPlayAudioStream.startMicrophone({
        sampleRate: SAMPLE_RATE,
        channels: 1,
        encoding: EncodingTypes.PCM_S16LE,
        interval: CHUNK_INTERVAL_MS,
        onAudioStream: (event) => {
          if (!event.data) return;
          const decoded = decodePcmChunk(event.data as string | Uint8Array | ArrayBuffer);
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
