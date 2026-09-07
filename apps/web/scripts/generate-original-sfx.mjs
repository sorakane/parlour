/** Original math-only UI tones. No samples, models, voices, or borrowed melody. MIT. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../public/audio/original/', import.meta.url));
mkdirSync(root, {recursive:true});
const rate=22050;
for (const [name,hz,seconds,gain] of [['click',650,0.075,0.22],['low',160,0.16,0.2],['chime',880,0.22,0.16],['silent',0,0.075,0],['join',720,0.18,0.17],['leave',240,0.18,0.17]]) {
 const count=Math.ceil(rate*seconds), out=Buffer.alloc(44+count*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);
 out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
 out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
 out.write('data',36);out.writeUInt32LE(count*2,40);
 for(let i=0;i<count;i++){
  const t=i/rate, envelope=Math.min(1,t/0.004)*Math.pow(1-i/count,3);
  const sample=Math.sin(2*Math.PI*hz*t)*gain*envelope;
  out.writeInt16LE(Math.round(sample*32767),44+i*2);
 }
 writeFileSync(`${root}/${name}.wav`,out);
}
