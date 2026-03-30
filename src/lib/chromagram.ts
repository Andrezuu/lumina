// Chromagram (Pitch Class Profile) builder
// Uses an inline Cooley-Tukey FFT — fftea installed as peer for future native swap

const SAMPLE_RATE = 44100;
const FFT_SIZE = 4096; // ~93ms window @ 44100 Hz

/** Radix-2 DIT FFT, in-place. Both arrays must have length = power of 2. */
function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let uRe = 1,
        uIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const eRe = re[i + k];
        const eIm = im[i + k];
        const tRe = uRe * re[i + k + half] - uIm * im[i + k + half];
        const tIm = uRe * im[i + k + half] + uIm * re[i + k + half];
        re[i + k] = eRe + tRe;
        im[i + k] = eIm + tIm;
        re[i + k + half] = eRe - tRe;
        im[i + k + half] = eIm - tIm;
        const nu = uRe * wRe - uIm * wIm;
        uIm = uRe * wIm + uIm * wRe;
        uRe = nu;
      }
    }
  }
}

function hannWindow(input: Float32Array, output: Float32Array): void {
  const n = input.length;
  for (let i = 0; i < n; i++) {
    output[i] = input[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
}

/**
 * Builds a 12-bin chromagram (one value per pitch class C..B) from PCM samples.
 * @param samples Float32Array of PCM samples in [-1, 1]
 * @returns Normalized Float32Array[12]
 */
export function buildChromagram(samples: Float32Array): Float32Array {
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  const len = Math.min(samples.length, FFT_SIZE);
  re.set(samples.subarray(0, len));
  hannWindow(re, re);

  fftInPlace(re, im);

  // Magnitude spectrum (only positive frequencies)
  const halfSize = FFT_SIZE >> 1;
  const mag = new Float32Array(halfSize);
  for (let i = 0; i < halfSize; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }

  // Accumulate into 12 chroma bins — MIDI notes C2(36) to B7(95)
  const chroma = new Float32Array(12);
  for (let midi = 36; midi <= 95; midi++) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const bin = Math.round((freq * FFT_SIZE) / SAMPLE_RATE);
    if (bin > 0 && bin < halfSize) {
      chroma[midi % 12] += mag[bin];
    }
  }

  // L∞ normalize
  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }

  return chroma;
}
