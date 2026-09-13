import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import lamejs from '@breezystack/lamejs';

const SAMPLE_RATE = 44100;
const BPM = 96;
const BEAT_SECONDS = 60 / BPM;
const TOTAL_BEATS = 32;
const DURATION_SECONDS = TOTAL_BEATS * BEAT_SECONDS;
const TAU = Math.PI * 2;
const OUTPUT_PATH = resolve('public/assets/audio/music/start-lab-theme.mp3');

const chords = [
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 64],
  [60, 64, 67, 71],
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 64],
];

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothstep = (value) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};

function softNoteEnvelope(localTime, duration, attack, release) {
  if (localTime < 0 || localTime >= duration) return 0;
  const attackGain = smoothstep(localTime / attack);
  const releaseGain = smoothstep((duration - localTime) / release);
  return Math.min(attackGain, releaseGain);
}

function oscillator(time, frequency, warmth = 0.16) {
  const phase = TAU * frequency * time;
  return Math.sin(phase)
    + warmth * Math.sin(phase * 2)
    + warmth * 0.22 * Math.sin(phase * 3);
}

function renderChannel(channel) {
  const sampleCount = Math.round(DURATION_SECONDS * SAMPLE_RATE);
  const samples = new Float32Array(sampleCount);
  const panSign = channel === 'left' ? -1 : 1;

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const beat = time / BEAT_SECONDS;
    let value = 0;

    // Warm pad carries the laboratory mood without a lead melody.
    for (let chordIndex = 0; chordIndex < chords.length; chordIndex += 1) {
      const start = chordIndex * 4 * BEAT_SECONDS;
      const localTime = time - start;
      const envelope = softNoteEnvelope(localTime, 4 * BEAT_SECONDS, 0.34, 0.42);
      if (envelope === 0) continue;
      chords[chordIndex].forEach((midi, noteIndex) => {
        const detune = 1 + panSign * (noteIndex % 2 === 0 ? -0.00065 : 0.00065);
        const drift = 1 + 0.0011 * Math.sin(TAU * (0.055 + noteIndex * 0.009) * time + noteIndex);
        value += oscillator(time, midiToHz(midi - 12) * detune * drift, 0.11)
          * envelope * (noteIndex === 0 ? 0.026 : 0.018);
      });
    }

    // Quiet robot-lab arpeggio: repetitive and subordinate to UI sounds.
    const halfBeat = Math.floor(beat * 2);
    const stepStart = halfBeat * (BEAT_SECONDS / 2);
    const stepLocal = time - stepStart;
    const chord = chords[Math.floor(halfBeat / 8) % chords.length];
    const pattern = [0, 2, 1, 3, 0, 2, 1, 2];
    const arpMidi = chord[pattern[halfBeat % pattern.length]] + 12;
    const arpEnvelope = softNoteEnvelope(stepLocal, BEAT_SECONDS * 0.42, 0.018, BEAT_SECONDS * 0.34);
    const arpPan = halfBeat % 2 === 0 ? -1 : 1;
    const arpChannelGain = 0.72 + (arpPan === panSign ? 0.28 : 0);
    value += oscillator(stepLocal, midiToHz(arpMidi), 0.08) * arpEnvelope * 0.026 * arpChannelGain;

    // Soft mechanical pulse and occasional curious sparkle; no drum transients.
    const beatIndex = Math.floor(beat);
    const beatLocal = time - beatIndex * BEAT_SECONDS;
    const pulseEnvelope = softNoteEnvelope(beatLocal, 0.19, 0.025, 0.16);
    value += oscillator(beatLocal, 118 + (beatIndex % 4 === 0 ? 8 : 0), 0.04) * pulseEnvelope * 0.018;
    if (beatIndex % 8 === 6) {
      const sparkleEnvelope = softNoteEnvelope(beatLocal, 0.48, 0.02, 0.42);
      const sparkleMidi = chord[2] + 24;
      value += oscillator(beatLocal, midiToHz(sparkleMidi), 0.2) * sparkleEnvelope * 0.018;
    }

    value += Math.sin(TAU * 0.1 * time + panSign * 0.8) * 0.004;
    samples[index] = Math.tanh(value * 1.3);
  }

  // Equal-power edge fades prevent clicks at the encoded loop boundary.
  const edgeSamples = Math.round(SAMPLE_RATE * 0.06);
  for (let index = 0; index < edgeSamples; index += 1) {
    const gain = Math.sin((index / edgeSamples) * Math.PI / 2) ** 2;
    samples[index] *= gain;
    samples[samples.length - 1 - index] *= gain;
  }
  return samples;
}

function floatToInt16(samples, gain) {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    output[index] = Math.round(clamp(samples[index] * gain, -1, 1) * 32767);
  }
  return output;
}

const left = renderChannel('left');
const right = renderChannel('right');
let peak = 0;
let sumSquares = 0;
for (let index = 0; index < left.length; index += 1) {
  peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  sumSquares += left[index] ** 2 + right[index] ** 2;
}
const targetPeak = 0.31;
const outputGain = targetPeak / Math.max(peak, 0.00001);
const pcmLeft = floatToInt16(left, outputGain);
const pcmRight = floatToInt16(right, outputGain);
const encoder = new lamejs.Mp3Encoder(2, SAMPLE_RATE, 160);
const chunks = [];
const blockSize = 1152;
for (let offset = 0; offset < pcmLeft.length; offset += blockSize) {
  const encoded = encoder.encodeBuffer(
    pcmLeft.subarray(offset, offset + blockSize),
    pcmRight.subarray(offset, offset + blockSize),
  );
  if (encoded.length > 0) chunks.push(Buffer.from(encoded));
}
const finalChunk = encoder.flush();
if (finalChunk.length > 0) chunks.push(Buffer.from(finalChunk));

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, Buffer.concat(chunks));

const rms = Math.sqrt(sumSquares / (left.length * 2)) * outputGain;
process.stdout.write(JSON.stringify({
  output: OUTPUT_PATH,
  bpm: BPM,
  durationSeconds: DURATION_SECONDS,
  sampleRate: SAMPLE_RATE,
  bitrateKbps: 160,
  channels: 2,
  peakDbfs: 20 * Math.log10(targetPeak),
  rmsDbfs: 20 * Math.log10(rms),
}, null, 2));
