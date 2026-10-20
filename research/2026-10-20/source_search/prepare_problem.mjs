import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as C from '../../../js/codec.js';

const ROOT=path.resolve(import.meta.dirname,'../../..');
const HERE=import.meta.dirname,CACHE=path.join(ROOT,'research/2026-10-20/cache/source_search');
fs.mkdirSync(CACHE,{recursive:true});
const read=p=>fs.readFileSync(path.join(ROOT,p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=read('data/saf_dat_col.utf8.bin'),community=read('data/community.bin');
const index=JSON.parse(read('data/index.json')),recipe=JSON.parse(read('data/original_headerguided.json'));
const inverse=C.inverseUTF8(original),prepared=C.prepareStream(inverse,community,index,recipe),decoded=C.inflate(prepared);
assert.equal(decoded.error,null);assert.equal(hash(decoded.bytes),'bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2');
fs.writeFileSync(path.join(CACHE,'stream.bin'),prepared.stream);
const pad=(a,n)=>Array.from({length:n},(_,i)=>a[i]||0).join(' ');
const meta=[decoded.blocks.length];
for(const b of decoded.blocks){meta.push(`${b.block} ${b.bit} ${b.body} ${b.endBit} ${b.synthetic?1:0}`);meta.push(pad(b.ll,286));meta.push(pad(b.dd,30));}
fs.writeFileSync(path.join(CACHE,'meta.txt'),meta.join('\n')+'\n');
const t=decoded.tokens,b=decoded.blocks[0],cut=Math.floor((b.body+b.endBit)/2),cases=[];
let token=0,inventory={};
for(const bit of [...prepared.ambiguities].sort((a,b)=>a-b)){
  if(bit<b.body||bit>=cut)continue;
  while(token+1<t.n&&t.end[token]<=bit)token++;
  if(!(t.bit[token]<=bit&&bit<t.end[token]))throw Error('No token contains ambiguity');
  let field;
  if(t.symbol[token]<=256||bit<t.lbit[token])field='literal_or_length_huffman_symbol';
  else if(bit<t.lbit[token]+C.LE[t.symbol[token]-257])field='length_extra_bits';
  else if(bit<t.dbit[token])field='distance_huffman_symbol';
  else field='distance_extra_bits_only';
  inventory[field]=(inventory[field]||0)+1;
  if(field==='distance_extra_bits_only')continue;
  const source=C.sourceAtBit(prepared,bit,inverse,index);
  assert.equal(source.inserted,false);assert.equal(source.bit,5);
  assert.equal(inverse.bytes[source.inverseByte],32);assert.equal(original[source.uploadedByte],32);
  assert.equal(source.block,1);
  cases.push({id:cases.length+1,bit,field,source,baseline_token:token,baseline_symbol:t.symbol[token],
    baseline_length:t.length[token],baseline_distance:t.distance[token],baseline_token_bit:t.bit[token],baseline_token_end:t.end[token]});
}
fs.writeFileSync(path.join(HERE,'candidates.json'),JSON.stringify({protocol_sha256:hash(fs.readFileSync(path.join(HERE,'protocol.json'))),
  baseline_source_sha256:hash(original),baseline_recipe_sha256:hash(read('data/original_headerguided.json')),
  baseline_stream_sha256:hash(prepared.stream),baseline_payload_sha256:hash(decoded.bytes),
  body_bit:b.body,end_bit:b.endBit,training_cut_bit:cut,inventory,eligible:cases.length,cases},null,2)+'\n');
fs.writeFileSync(path.join(HERE,'candidates.tsv'),'0 N\n'+cases.map(c=>`${c.id} X ${c.bit}`).join('\n')+'\n');
fs.writeFileSync(path.join(CACHE,'baseline_blocks.json'),JSON.stringify(decoded.blocks,null,2)+'\n');
console.log(JSON.stringify({cache:CACHE,eligible:cases.length,inventory,training_cut_bit:cut,body_bit:b.body,end_bit:b.endBit}));
