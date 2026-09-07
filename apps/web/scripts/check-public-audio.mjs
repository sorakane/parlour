/** Prevent accidentally redistributing removed recordings during future builds. */
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const publicRoot=fileURLToPath(new URL('../public/',import.meta.url));
const approved=JSON.parse(readFileSync(join(publicRoot,'legal/audio-provenance.json'),'utf8'));
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const paths=walk(join(publicRoot,'audio'));
for(const file of paths){
 const key=relative(publicRoot,file), entry=approved.files[key];
 const hash=createHash('sha256').update(readFileSync(file)).digest('hex');
 if(!entry || entry.sha256!==hash)throw new Error(`Audio needs provenance review: ${key}`);
}
if(paths.length!==Object.keys(approved.files).length)throw new Error('An approved audio file is missing');
console.log(`Verified ${paths.length} reproducible audio files; no upstream recordings.`);
