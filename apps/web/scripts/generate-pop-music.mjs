/** Pop Shuffle: original C-major synth instrumental, 120 BPM, 16 bars, MIT.
 * All instruments are oscillators or seeded noise. No samples or borrowed tune.
 * Tails wrap into the start, so the 32-second PCM loop has no fade-out gap.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rate = 22050;
const beat = 0.5;
const samples = new Float64Array(32 * rate);
const tau = Math.PI * 2;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 7319;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}
function add(start, seconds, sound) {
  const first = Math.round(start * rate);
  const count = Math.ceil(seconds * rate);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const attack = Math.min(1, t / 0.006);
    const release = Math.min(1, (count - 1 - i) / (rate * 0.014));
    samples[(first + i) % samples.length] += sound(t) * attack * release;
  }
}
function pluck(start, midi, duration, gain, bright = false) {
  const f = hz(midi);
  add(
    start,
    duration,
    (t) =>
      gain *
      Math.exp(-t * (bright ? 9 : 6)) *
      (Math.sin(tau * f * t) +
        0.26 * Math.sin(tau * 2 * f * t) * Math.exp(-t * 8) +
        0.1 * Math.sin(tau * 3 * f * t) * Math.exp(-t * 12)),
  );
}
// Cmaj7 / Fadd9 / Am7 / G6, then a Dm7 turnaround; second phrase varies the lead.
const chords = [
  [60, 64, 67, 71],
  [60, 65, 67, 69],
  [60, 64, 67, 69],
  [59, 62, 67, 69],
  [60, 64, 67, 71],
  [60, 65, 67, 69],
  [60, 62, 65, 69],
  [59, 62, 67, 69],
];
const bass = [36, 41, 45, 43, 36, 41, 38, 43];
const phrases = [
  [
    [0, 76],
    [0.75, 79],
    [1.5, 81],
    [2.5, 79],
    [3.25, 76],
  ],
  [
    [0.5, 77],
    [1.25, 81],
    [2, 79],
    [3, 76],
  ],
  [
    [0, 76],
    [1, 72],
    [1.75, 76],
    [2.5, 79],
    [3.5, 81],
  ],
  [
    [0.25, 79],
    [1, 74],
    [2, 76],
    [3, 74],
  ],
  [
    [0, 79],
    [0.75, 84],
    [1.5, 83],
    [2.25, 79],
    [3.25, 76],
  ],
  [
    [0.5, 81],
    [1.25, 79],
    [2, 77],
    [3, 76],
  ],
  [
    [0, 77],
    [1, 81],
    [1.75, 79],
    [2.5, 77],
  ],
  [
    [0.5, 74],
    [1.5, 79],
    [2.5, 76],
    [3.25, 74],
  ],
];
for (let bar = 0; bar < 16; bar++) {
  const start = bar * 4 * beat;
  const chord = chords[bar % 8];
  for (const offset of [0, 1.5, 2.5, 3.5]) {
    chord.forEach((note, index) => pluck(start + offset * beat + index * 0.008, note, 0.42, 0.035));
  }
  for (const [offset, interval] of [
    [0, 0],
    [1.5, 7],
    [2, 12],
    [3.5, 7],
  ]) {
    const f = hz(bass[bar % 8] + interval);
    add(
      start + offset * beat,
      0.22,
      (t) => 0.15 * Math.exp(-t * 12) * (Math.sin(tau * f * t) + 0.2 * Math.sin(tau * 2 * f * t)),
    );
  }
  for (const offset of [0, 2]) {
    add(
      start + offset * beat,
      0.18,
      (t) => 0.22 * Math.exp(-t * 24) * Math.sin(tau * (48 * t + 2.3 * (1 - Math.exp(-t * 30)))),
    );
  }
  for (const offset of [1, 3]) {
    add(
      start + offset * beat,
      0.12,
      (t) => (noise() * 0.075 + Math.sin(tau * 180 * t) * 0.035) * Math.exp(-t * 38),
    );
  }
  for (let eighth = 0; eighth < 8; eighth++) {
    add(
      start + (eighth * beat) / 2,
      0.055,
      (t) => noise() * (eighth % 2 ? 0.034 : 0.019) * Math.exp(-t * 70),
    );
  }
  for (const [offset, note] of phrases[bar % 8]) {
    // Leave breathing room in the second phrase, with a short answering note.
    if (bar >= 8 && offset === 0.75) continue;
    pluck(start + offset * beat, note, 0.38, 0.09, true);
    pluck(start + offset * beat + 0.1875, note, 0.3, 0.014, true);
  }
}
let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
const out = Buffer.alloc(44 + samples.length * 2);
out.write('RIFF');
out.writeUInt32LE(out.length - 8, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(1, 22);
out.writeUInt32LE(rate, 24);
out.writeUInt32LE(rate * 2, 28);
out.writeUInt16LE(2, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) {
  out.writeInt16LE(Math.round(((samples[i] * 0.72) / peak) * 32767), 44 + i * 2);
}
const root = fileURLToPath(new URL('../public/audio/original/', import.meta.url));
mkdirSync(root, { recursive: true });
writeFileSync(`${root}/pop-shuffle.wav`, out);
console.log('Generated Pop Shuffle: C major, 120 BPM, 32-second seamless loop.');
