import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SAMPLE_RATE = 44100;
const TAU = Math.PI * 2;

function envelope(t, start, attack, release) {
  const local = t - start;
  if (local < 0 || local >= attack + release) return 0;
  if (local < attack) return local / attack;
  const progress = (local - attack) / release;
  return (1 - progress) ** 2;
}

function tone(t, frequency, character = 'soft') {
  const phase = TAU * frequency * t;
  if (character === 'bell') return Math.sin(phase) + 0.32 * Math.sin(phase * 2.01) + 0.12 * Math.sin(phase * 3.98);
  if (character === 'round') return Math.sin(phase) + 0.18 * Math.sin(phase * 2);
  return Math.sin(phase) + 0.12 * Math.sin(phase * 2) + 0.05 * Math.sin(phase * 3);
}

function createSamples(duration, render) {
  const samples = new Float32Array(Math.round(duration * SAMPLE_RATE));
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / SAMPLE_RATE;
    samples[index] = Math.tanh(render(t) * 0.92);
  }
  return samples;
}

function writeWav(relativePath, samples) {
  const output = resolve(relativePath);
  mkdirSync(dirname(output), { recursive: true });
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), 44 + index * 2);
  }
  writeFileSync(output, buffer);
}

const note = (midi) => 440 * 2 ** ((midi - 69) / 12);

const musicEvents = [];
const melody = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 83, 81, 79, 76, 74];
const bass = [48, 48, 53, 53, 45, 45, 55, 55];
for (let step = 0; step < melody.length; step += 1) musicEvents.push({ start: step, midi: melody[step], release: 0.66 });
for (let step = 0; step < bass.length; step += 1) musicEvents.push({ start: step * 2, midi: bass[step], release: 1.45, bass: true });
writeWav('public/assets/audio/music/start-theme.wav', createSamples(16, (t) => {
  let value = 0;
  for (const event of musicEvents) {
    const env = envelope(t, event.start, event.bass ? 0.08 : 0.018, event.release);
    if (env === 0) continue;
    value += tone(t - event.start, note(event.midi), event.bass ? 'round' : 'bell') * env * (event.bass ? 0.1 : 0.075);
  }
  const pulse = Math.sin(TAU * 2 * t) * 0.012 * (0.5 + 0.5 * Math.sin(TAU * 0.25 * t));
  return value + pulse;
}));

writeWav('public/assets/audio/sfx/ui-click.wav', createSamples(0.12, (t) => {
  const env = envelope(t, 0, 0.006, 0.11);
  return tone(t, 540 - 1100 * t, 'round') * env * 0.26;
}));

writeWav('public/assets/audio/sfx/answer-correct.wav', createSamples(0.72, (t) => {
  const events = [{ start: 0, midi: 72 }, { start: 0.18, midi: 76 }, { start: 0.36, midi: 79 }];
  return events.reduce((sum, event) => sum + tone(t - event.start, note(event.midi), 'bell')
    * envelope(t, event.start, 0.012, 0.32) * 0.2, 0);
}));

writeWav('public/assets/audio/sfx/answer-wrong.wav', createSamples(0.58, (t) => {
  const events = [{ start: 0, midi: 67 }, { start: 0.22, midi: 64 }];
  return events.reduce((sum, event) => sum + tone(t - event.start, note(event.midi), 'round')
    * envelope(t, event.start, 0.025, 0.34) * 0.16, 0);
}));

writeWav('public/assets/audio/sfx/hint.wav', createSamples(0.64, (t) => {
  const events = [{ start: 0, midi: 79 }, { start: 0.12, midi: 83 }, { start: 0.26, midi: 86 }];
  return events.reduce((sum, event) => sum + tone(t - event.start, note(event.midi), 'bell')
    * envelope(t, event.start, 0.008, 0.3) * 0.14, 0);
}));

writeWav('public/assets/audio/sfx/repair-reward.wav', createSamples(1.24, (t) => {
  const click = tone(t, 180, 'round') * envelope(t, 0, 0.004, 0.09) * 0.24;
  const energy = Math.sin(TAU * (220 * t + 210 * t * t)) * envelope(t, 0.12, 0.05, 0.58) * 0.13;
  const finish = [{ start: 0.55, midi: 72 }, { start: 0.72, midi: 79 }, { start: 0.9, midi: 84 }]
    .reduce((sum, event) => sum + tone(t - event.start, note(event.midi), 'bell')
      * envelope(t, event.start, 0.012, 0.32) * 0.17, 0);
  return click + energy + finish;
}));
