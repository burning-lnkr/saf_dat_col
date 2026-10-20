import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import * as C from '../../../js/codec.js';

const HERE=import.meta.dirname,ROOT=path.resolve(HERE,'../../..'),CACHE=path.join(ROOT,'research/2026-10-20/cache/cr_search');
fs.mkdirSync(CACHE,{recursive:true});
const read=p=>fs.readFileSync(path.join(ROOT,p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=read('data/saf_dat_col.utf8.bin'),inverse=C.inverseUTF8(source),community=read('data/community.bin');
const index=JSON.parse(read('data/index.json')),recipe=JSON.parse(read('data/original_headerguided.json'));
const prepared=C.prepareStream(inverse,community,index,recipe),base=C.inflate(prepared);
assert.equal(base.error,null);
const shortlist=JSON.parse(fs.readFileSync(path.join(HERE,'shortlist.json')));
const continuation=fs.readFileSync(path.join(HERE,'continuation.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const continuationById=new Map(continuation.map(x=>[x.id,x]));
const zero=Buffer.alloc(32768),cycle=Buffer.from(Array.from({length:32768},(_,i)=>i&255));
const results=[];
function writeTyped(p,a){fs.writeFileSync(p,Buffer.from(a.buffer,a.byteOffset,a.byteLength));}
function knownTags(d){const a=new Int32Array(d.bytes.length);for(let i=0;i<a.length;i++)a[i]=d.origins[i]<0?d.origins[i]:d.bytes[i];return a;}
for(const c of shortlist.selected){
  const modified=structuredClone(recipe),crs=new Set(modified.blocks[0].cr);
  assert.ok(crs.delete(c.from));assert.ok(!crs.has(c.to));crs.add(c.to);
  modified.blocks[0].cr=[...crs].sort((a,b)=>a-b);
  const p=C.prepareStream(inverse,community,index,modified);
  assert.equal(p.bits,prepared.bits);assert.equal(p.stream.length,prepared.stream.length);
  const patched=prepared.stream.slice(),rep=Buffer.from(c.replacementHex,'hex');
  for(let j=0;j<c.nbits;j++){const bit=c.startBit+j,mask=1<<(bit&7);patched[bit>>>3]=(patched[bit>>>3]&~mask)|(((rep[j>>>3]>>>(j&7))&1)<<(bit&7));}
  assert.deepEqual(p.stream,patched,'Recipe must exactly match range replacement');
  const d=C.inflate(p);assert.equal(d.error,null);assert.equal(d.blocks.length,base.blocks.length);
  assert.deepEqual(d.blocks.map(b=>[b.bit,b.body,b.endBit,b.ll,b.dd]),base.blocks.map(b=>[b.bit,b.body,b.endBit,b.ll,b.dd]));
  assert.deepEqual(zlib.inflateRawSync(p.stream,{dictionary:zero}),Buffer.from(d.bytes));
  const cyclic=zlib.inflateRawSync(p.stream,{dictionary:cycle});
  for(let j=0;j<d.bytes.length;j++)assert.equal(cyclic[j],d.origins[j]<0?cycle[32768+d.origins[j]]:d.bytes[j]);
  const scored=continuationById.get(String(c.id));assert.ok(scored?.valid);
  const prefix=d.blocks[3].end;
  const cppBytes=fs.readFileSync(path.join(CACHE,'continuation',String(c.id)+'.bytes.bin'));
  assert.deepEqual(cppBytes,Buffer.from(d.bytes.subarray(0,prefix)));
  const cppTags=fs.readFileSync(path.join(CACHE,'continuation',String(c.id)+'.tags.i32'));
  const tags=knownTags(d);
  assert.deepEqual(cppTags,Buffer.from(tags.buffer,0,prefix*4));
  let changed=0,knownChanged=0,knownCompared=0,firstChanged=-1,lastChanged=-1;
  for(let j=0;j<Math.min(base.bytes.length,d.bytes.length);j++){
    if(base.bytes[j]!==d.bytes[j]){changed++;if(firstChanged<0)firstChanged=j;lastChanged=j;}
    if(base.origins[j]>=0&&d.origins[j]>=0){knownCompared++;if(base.bytes[j]!==d.bytes[j])knownChanged++;}
  }
  const byBit=new Map();for(let t=0;t<base.tokens.n&&base.tokens.block[t]===1;t++)byBit.set(base.tokens.bit[t],t);
  let resync=null;
  for(let t=0;t<d.tokens.n&&d.tokens.block[t]===1;t++){
    if(d.tokens.bit[t]<c.endBit)continue;const b=byBit.get(d.tokens.bit[t]);if(b===undefined)continue;
    if(d.tokens.end[t]===base.tokens.end[b]&&d.tokens.symbol[t]===base.tokens.symbol[b]&&d.tokens.length[t]===base.tokens.length[b]&&d.tokens.distance[t]===base.tokens.distance[b]){
      resync={candidateToken:t,baselineToken:b,streamBit:d.tokens.bit[t],candidateOutput:d.tokens.start[t],baselineOutput:base.tokens.start[b],outputDelta:d.tokens.start[t]-base.tokens.start[b]};break;
    }
  }
  const folder=path.join(CACHE,'candidate_'+c.id);fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'bytes.bin'),d.bytes);writeTyped(path.join(folder,'origins.bin'),d.origins);fs.writeFileSync(path.join(folder,'fresh.bin'),d.fresh);
  fs.writeFileSync(path.join(folder,'stream.bin'),p.stream);
  const delta={baselineRecipe:'data/original_headerguided.json',block:1,removeCR:c.from,insertCR:c.to,source:c.source,target:c.target};
  fs.writeFileSync(path.join(HERE,'recipe_delta_'+c.id+'.json'),JSON.stringify(delta,null,2)+'\n');
  results.push({id:c.id,from:c.from,to:c.to,delta:c.delta,selectedBy:c.selectedBy,
    verification:{recipePatchExact:true,allHeadersAndRetainedEndsUnchanged:true,nativeZeroDictionaryExact:true,nativeCycleDictionaryAncestryExact:true,cppPrefixBytesAndTagsExact:true},
    sourceBitRange:[c.startBit,c.endBit],firstSourceTokenResynchronization:resync,
    streamSha256:hash(p.stream),outputSha256:hash(d.bytes),outputBytes:d.bytes.length,outputDelta:d.bytes.length-base.bytes.length,
    tokenCount:d.tokens.n,tokenDelta:d.tokens.n-base.tokens.n,changedAtSameOutputIndex:changed,knownChangedAtSameOutputIndex:knownChanged,knownComparedAtSameOutputIndex:knownCompared,
    firstChangedOutputIndex:firstChanged,lastChangedOutputIndex:lastChanged,
    comparisonCaution:'Same-index differences include displacement when output length changes; they are not a count of repaired or independently damaged source pixels.',
    blocks:d.blocks.map(b=>({block:b.block,start:b.start,end:b.end,tokens:b.tokens,literals:b.literals,matches:b.matches,synthetic:b.synthetic})),
    continuation:scored,cache:path.relative(ROOT,folder)});
  console.log(JSON.stringify({id:c.id,outputBytes:d.bytes.length,outputDelta:d.bytes.length-base.bytes.length,tokenDelta:d.tokens.n-base.tokens.n,changedAtSameOutputIndex:changed,resync}));
}
fs.writeFileSync(path.join(HERE,'verification.json'),JSON.stringify({baselineOutputSha256:hash(base.bytes),results},null,2)+'\n');
