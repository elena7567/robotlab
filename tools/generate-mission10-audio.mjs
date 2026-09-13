import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import lamejs from '@breezystack/lamejs';

const RATE = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const TAU = Math.PI * 2;
const THEME_PATH = resolve('public/assets/audio/music/mission10-victory-theme.mp3');
const BEACON_PATH = resolve('public/assets/audio/sfx/mission10-beacon-launch.wav');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const smooth = (v) => {
  const x = clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
};
const env = (time, start, duration, attack = 0.012, release = 0.16) => {
  const local = time - start;
  return local < 0 || local >= duration
    ? 0
    : Math.min(smooth(local / attack), smooth((duration - local) / release));
};
const tone = (time, frequency, bright = 0.18) => {
  const phase = TAU * frequency * time;
  return Math.sin(phase) + bright * Math.sin(phase * 2) + bright * 0.3 * Math.sin(phase * 3);
};

function renderTheme(side) {
  const duration = 20;
  const out = new Float32Array(duration * RATE);
  const pan = side === 'left' ? -1 : 1;
  const chords = [
    [48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [53, 60, 65, 69, 72],
    [55, 62, 67, 71, 74], [48, 55, 60, 64, 67], [53, 60, 65, 69, 72],
    [50, 57, 62, 65, 69], [55, 62, 67, 71, 74], [53, 60, 65, 69, 72],
    [48, 55, 60, 64, 72],
  ];
  const melody = [
    72, 76, 79, 84, 81, 79, 76, 72, 74, 77, 81, 84, 83, 79, 76, 74,
    72, 76, 79, 81, 84, 81, 79, 76, 77, 81, 84, 89, 86, 83, 79, 74,
    76, 79, 84, 88, 86, 84, 81, 84,
  ];
  for (let i = 0; i < out.length; i += 1) {
    const time = i / RATE;
    const beat = time / BEAT;
    const bar = Math.min(9, Math.floor(beat / 4));
    const barStart = bar * 4 * BEAT;
    let value = 0;
    const padEnv = env(time, barStart, 4 * BEAT, 0.16, 0.3);
    chords[bar].forEach((midi, noteIndex) => {
      const detune = 1 + pan * (noteIndex % 2 === 0 ? 0.0008 : -0.0008);
      value += tone(time, hz(midi) * detune, 0.08) * padEnv * (noteIndex === 0 ? 0.042 : 0.026);
    });
    const step = Math.floor(beat * 2);
    const noteStart = step * BEAT / 2;
    const notePan = step % 2 === 0 ? -1 : 1;
    value += tone(time - noteStart, hz(melody[step % melody.length]), 0.22)
      * env(time, noteStart, BEAT * 0.46, 0.008, 0.16)
      * 0.115 * (0.68 + (notePan === pan ? 0.32 : 0));
    const pulseStart = Math.floor(beat) * BEAT;
    const pulseLocal = time - pulseStart;
    value += Math.sin(TAU * ((Math.floor(beat) % 4 === 0 ? 92 : 132) * pulseLocal - 28 * pulseLocal ** 2))
      * env(time, pulseStart, 0.19, 0.005, 0.14)
      * (Math.floor(beat) % 4 === 0 ? 0.13 : 0.055);
    if (time >= 18) {
      for (const event of [{ start: 18, midi: 72 }, { start: 18.25, midi: 76 },
        { start: 18.5, midi: 79 }, { start: 18.75, midi: 84 }]) {
        value += tone(time - event.start, hz(event.midi), 0.28)
          * env(time, event.start, 1.15, 0.008, 0.48) * 0.08;
      }
    }
    out[i] = Math.tanh(value * 1.15) * (time < 19.62 ? 1 : smooth((20 - time) / 0.38));
  }
  return out;
}

function renderBeacon() {
  const duration = 3.2;
  const out = new Float32Array(Math.round(duration * RATE));
  for (let i = 0; i < out.length; i += 1) {
    const time = i / RATE;
    let value = 0;
    if (time < 1.55) {
      const progress = time / 1.55;
      const chargeEnv = smooth(progress) * smooth((1.6 - time) / 0.18);
      value += tone(time, 145 + 430 * progress ** 2, 0.13) * chargeEnv * 0.22;
      value += Math.sin(TAU * (5 + 11 * progress) * time) * chargeEnv * 0.045;
    }
    if (time >= 1.05 && time < 2.35) {
      const local = time - 1.05;
      const progress = local / 1.3;
      value += Math.sin(TAU * (210 * local + 390 * local ** 2 + 90 * local ** 3))
        * Math.sin(Math.PI * progress) ** 0.7 * 0.3;
    }
    for (const event of [{ start: 2.08, midi: 72 }, { start: 2.28, midi: 79 },
      { start: 2.48, midi: 84 }, { start: 2.48, midi: 88 }]) {
      value += tone(time - event.start, hz(event.midi), 0.32)
        * env(time, event.start, 0.72, 0.006, 0.5) * 0.19;
    }
    out[i] = Math.tanh(value) * (time < 3.02 ? 1 : smooth((3.2 - time) / 0.18));
  }
  return out;
}

function normalize(channels, targetPeak) {
  let peak = 0;
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  const gain = targetPeak / Math.max(peak, 0.00001);
  let squares = 0;
  let count = 0;
  const output = channels.map((channel) => channel.map((sample) => {
    const value = clamp(sample * gain, -1, 1);
    squares += value ** 2;
    count += 1;
    return value;
  }));
  return {
    channels: output,
    peakDbfs: 20 * Math.log10(targetPeak),
    rmsDbfs: 20 * Math.log10(Math.sqrt(squares / count)),
  };
}

function int16(samples) {
  return Int16Array.from(samples, (sample) => Math.round(sample * 32767));
}

function writeMp3(path, left, right) {
  const encoder = new lamejs.Mp3Encoder(2, RATE, 160);
  const a = int16(left);
  const b = int16(right);
  const chunks = [];
  for (let offset = 0; offset < a.length; offset += 1152) {
    const encoded = encoder.encodeBuffer(a.subarray(offset, offset + 1152), b.subarray(offset, offset + 1152));
    if (encoded.length) chunks.push(Buffer.from(encoded));
  }
  const final = encoder.flush();
  if (final.length) chunks.push(Buffer.from(final));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat(chunks));
}

function writeWav(path, samples) {
  const pcm = int16(samples);
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
}

const theme = normalize([renderTheme('left'), renderTheme('right')], 0.5);
const beacon = normalize([renderBeacon()], 0.63);
writeMp3(THEME_PATH, theme.channels[0], theme.channels[1]);
writeWav(BEACON_PATH, beacon.channels[0]);
process.stdout.write(`${JSON.stringify({
  bpm: BPM,
  sampleRate: RATE,
  theme: { output: THEME_PATH, durationSeconds: 20, channels: 2, bitrateKbps: 160,
    peakDbfs: theme.peakDbfs, rmsDbfs: theme.rmsDbfs },
  beacon: { output: BEACON_PATH, durationSeconds: 3.2, channels: 1,
    peakDbfs: beacon.peakDbfs, rmsDbfs: beacon.rmsDbfs },
}, null, 2)}\n`);
