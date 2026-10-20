// Run from repository root: node tools/export_format_neutral.mjs
// Generates ignored local data under cache/format-neutral. No image layout.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {inverseUTF8, prepareStream, inflate, sourceAtBit} from '../js/codec.js';
const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const raw = read('data/saf_dat_col.utf8.bin');
if (sha(raw) !== '53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c') throw Error('Unexpected source');
const inv = inverseUTF8(raw), index = JSON.parse(read('data/index.json'));
const unmapped = new Set();
Array.from(inv.text).forEach((c,i) => { if(inv.bytes[i] === 63 && c !== '?') unmapped.add(i); });
const dir = new URL('cache/format-neutral/', root); fs.mkdirSync(dir, {recursive:true});
const write = (name, value) => fs.writeFileSync(new URL(name, dir), value);
const summary = [];
for (const candidate of ['headerguided','combined']) {
  const recipeBytes = read(`data/original_${candidate}.json`);
  const recipe = JSON.parse(recipeBytes);
  const prep = prepareStream(inv, new Uint8Array(read('data/community.bin')), index, recipe);
  const d = inflate(prep);
  if (d.error) throw Error(JSON.stringify(d.error));
  const native = zlib.inflateRawSync(d.stream, {dictionary:Buffer.alloc(32768)});
  if (!native.equals(Buffer.from(d.bytes))) throw Error('Independent inflate differs');
  const t = d.tokens, mask = new Uint8Array(d.bytes.length), runs = [];
  const xor = new Set(recipe.xor || []);
  let current = null, literals = 0, supported = 0;
  function flush() { if (current) runs.push(current); current = null; }
  for (let i=0; i<t.n; i++) {
    if(t.symbol[i]>=256) { flush(); continue; }
    literals++;
    let ok = true;
    for(let p=t.bit[i]; p<t.end[i]; p++) {
      const s = sourceAtBit(prep,p,inv,index);
      if(!s || s.synthetic || s.inserted || inv.bytes[s.inverseByte]===32 || unmapped.has(s.inverseByte) || xor.has(p)) { ok=false; break; }
    }
    if (!ok) { flush(); continue; }
    supported++; mask[t.start[i]]=1;
    const v=t.symbol[i]<128?t.symbol[i]:t.symbol[i]-256;
    if (!current || current.block!==t.block[i] || current.start+current.values.length!==t.start[i]) {
      flush(); current={block:t.block[i],start:t.start[i],values:[]};
    }
    current.values.push(v);
  }
  flush();
  const blocks = d.blocks.map(b => ({block:b.block,start:b.start,end:b.end,bit:b.bit,endBit:b.endBit,literals:b.literals,matches:b.matches,synthetic:b.synthetic}));
  const runMeta = {candidate,scope:'Nominal framing; locally supported means literal field does not overlap source spaces, insertions, unmappable characters, synthetic bits or listed XOR patches. It does not authenticate preceding token framing.',runs};
  write(`${candidate}.bin`, d.bytes);
  write(`${candidate}.origins.i32`, new Uint8Array(d.origins.buffer,d.origins.byteOffset,d.origins.byteLength));
  write(`${candidate}.fresh.u8`, d.fresh);
  write(`${candidate}.supported.u8`, mask);
  write(`${candidate}.runs.json`, JSON.stringify(runMeta));
  write(`${candidate}.blocks.json`, JSON.stringify(blocks,null,2)+'\n');
  summary.push({candidate,input_sha256:sha(raw),recipe_sha256:sha(recipeBytes),decoded_sha256:sha(d.bytes),stream_sha256:sha(d.stream),bytes:d.bytes.length,blocks:blocks.length,literals,locally_supported_literals:supported,runs:runs.length,longest_run:Math.max(...runs.map(r=>r.values.length)),native_inflate_exact:true});
}
write('export.json', JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
