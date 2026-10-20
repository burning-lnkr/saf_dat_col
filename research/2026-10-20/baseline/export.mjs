/** Reproduce the captured Header-guided baseline without modifying the app or inputs. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import * as C from '../../../js/codec.js';
import {ROOT,HERE,CACHE,TOKEN_TYPES,writeTyped,sourceAtStreamBit} from './io.mjs';

const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p));
const writeJSON=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const rel=p=>path.relative(ROOT,p).split(path.sep).join('/');
const expected={source:'53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c',recipe:'5144b002d0fae178c33f265c76d76fce02addd4f6997678fbe15bcf5f2e4b83d',stream:'a10005bf746a70d9339b8069e83b677372d6d42530c6e221f8aec0b634604063',bytes:'bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2'};
fs.mkdirSync(path.join(CACHE,'source_parts'),{recursive:true});
const original=read('data/saf_dat_col.utf8.bin'),community=read('data/community.bin'),index=JSON.parse(read('data/index.json')),recipeBytes=read('data/original_headerguided.json'),recipe=JSON.parse(recipeBytes);
assert.equal(sha(original),expected.source);assert.equal(sha(recipeBytes),expected.recipe);assert.equal(sha(community),index.sources.community.sha256);
const inverse=C.inverseUTF8(original),prepared=C.prepareStream(inverse,community,index,recipe),d=C.inflate(prepared);
assert.equal(d.error,null);assert.equal(d.bytes.length,11779452);assert.equal(d.stream.length,1200345);assert.equal(sha(d.stream),expected.stream);assert.equal(sha(d.bytes),expected.bytes);assert.equal(d.bitEnd,prepared.bits);
const native=zlib.inflateRawSync(d.stream,{dictionary:Buffer.alloc(32768)});assert.ok(native.equals(Buffer.from(d.bytes)));
for(const[k,T]of Object.entries(TOKEN_TYPES)){assert.ok(d.tokens[k]instanceof T);writeTyped(path.join(CACHE,`token_${k}.bin`),d.tokens[k]);}
for(const[k,a]of [['stream',d.stream],['bytes',d.bytes],['origins',d.origins],['fresh',d.fresh],['inverse',inverse.bytes]])writeTyped(path.join(CACHE,k+'.bin'),a);
writeTyped(path.join(CACHE,'inverse_offsets.u32'),inverse.offsets);writeTyped(path.join(CACHE,'ambiguities.u32'),Uint32Array.from([...prepared.ambiguities].sort((a,b)=>a-b)));
writeJSON(path.join(CACHE,'blocks.json'),d.blocks);

// Mark the inverse conversion's replacement values separately from genuine '?'.
const cp1252=new Set([0x20ac,0x81,0x201a,0x192,0x201e,0x2026,0x2020,0x2021,0x2c6,0x2030,0x160,0x2039,0x152,0x8d,0x17d,0x8f,0x90,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x2dc,0x2122,0x161,0x203a,0x153,0x9d,0x17e,0x178]);
const unmapped=new Uint8Array(inverse.bytes.length);let j=0;for(const c of inverse.text){const u=c.codePointAt(0);unmapped[j++]=u>255&&!cp1252.has(u)?1:0;}assert.equal(j,unmapped.length);assert.equal(unmapped.reduce((a,b)=>a+b,0),inverse.unmapped);writeTyped(path.join(CACHE,'inverse_unmapped.u8'),unmapped);

// Export source preparation stages; verify our coordinate materialization against
// the unchanged codec's maps and reconstructed retained bits.
const parts=[],rebuilt=new C.BitWriter(),hs=recipe.headers||index.headers;
for(let b=0;b<hs.length;b++){
 const h=hs[b],e=recipe.blocks[b],part=prepared.parts[b],st=h.byte,en=b+1<hs.length?hs[b+1].byte+1:recipe.lastEnd;
 let raw=Array.from(inverse.bytes.subarray(st,en)),rawMap=Array.from({length:en-st},(_,k)=>st+k),rawFlags=rawMap.map(k=>unmapped[k]?16:0);
 for(const[p,from,to]of h.patches||[]){assert.equal(raw[p],from);raw[p]=to;rawFlags[p]|=4;}
 if(h.insert!==null&&h.insert!==undefined){raw.splice(h.insert,0,13);rawMap.splice(h.insert,0,-st-h.insert-1);rawFlags.splice(h.insert,0,2);}
 const keep=[];for(let k=0;k<raw.length;k++)if(!(recipe.removals||[]).some(([a,z])=>rawMap[k]>=a&&rawMap[k]<z))keep.push(k);
 raw=keep.map(k=>raw[k]);rawMap=keep.map(k=>rawMap[k]);rawFlags=keep.map(k=>rawFlags[k]);
 const nul=new Set(e.nul),cr=new Set(e.cr),buf=[],map=[],prep=[],flags=[];
 for(let k=0;k<raw.length;k++){
  if(cr.has(k)){buf.push(13);map.push(-Math.abs(rawMap[k])-1);prep.push(k);flags.push(1);}
  let v=raw[k],f=rawFlags[k];if(nul.has(k)){assert.equal(v,32);v=0;f|=8;}buf.push(v);map.push(rawMap[k]);prep.push(k);flags.push(f);
 }
 assert.deepEqual(Int32Array.from(map),part.map);assert.deepEqual(Uint32Array.from(prep),part.prep);
 const end=e.end+8*[...cr].filter(p=>p*8<e.end).length,header=C.readHeader(new C.Bits(Uint8Array.from(buf),h.bit,end));
 assert.equal(rebuilt.pos,part.start);rebuilt.slice(Uint8Array.from(buf),h.bit,end);if(!e.eob){const[c,n]=header.lt.codes[256];rebuilt.put(c,n);}assert.equal(rebuilt.pos,part.end);
 const stem=`source_parts/block_${String(b+1).padStart(2,'0')}`;
 const files={map:stem+'.map.i32',prep:stem+'.prep.u32',rawPrepared:stem+'.raw_prepared.u8',rawMap:stem+'.raw_map.i32',preparedBytes:stem+'.prepared.u8',preparedFlags:stem+'.flags.u8'};
 const arrays={map:Int32Array.from(map),prep:Uint32Array.from(prep),rawPrepared:Uint8Array.from(raw),rawMap:Int32Array.from(rawMap),preparedBytes:Uint8Array.from(buf),preparedFlags:Uint8Array.from(flags)};
 for(const[k,a]of Object.entries(arrays))writeTyped(path.join(CACHE,files[k]),a);
 parts.push({block:b+1,start:part.start,end:part.end,sourceEnd:part.sourceEnd,headerBit:part.headerBit,synthetic:part.synthetic,originalStart:st,originalEnd:en,preparedHeaderBodyBit:header.body,retainedPreparedEndBit:end,rawPreparedLength:raw.length,preparedLength:buf.length,files});
}
const rebuiltBytes=rebuilt.finish();for(let i=0;i<parts.length;i++){const bit=parts[i].start;rebuiltBytes[bit>>>3]=(rebuiltBytes[bit>>>3]&~(1<<(bit&7)))|((i===parts.length-1?1:0)<<(bit&7));}for(const bit of recipe.xor||[])rebuiltBytes[bit>>>3]^=1<<(bit&7);assert.deepEqual(rebuiltBytes,prepared.stream);writeJSON(path.join(CACHE,'parts.json'),parts);
const context={parts:parts.map((p,i)=>({...p,map:prepared.parts[i].map,prep:prepared.parts[i].prep,rawPrepared:fs.readFileSync(path.join(CACHE,p.files.rawPrepared)),preparedBytes:fs.readFileSync(path.join(CACHE,p.files.preparedBytes)),preparedFlags:fs.readFileSync(path.join(CACHE,p.files.preparedFlags))})),inverse:{bytes:inverse.bytes,offsets:inverse.offsets,unmapped},index};

// Independent token-only LZ replay verifies ancestry rather than equating all
// unknown history bytes to zero. Negative values identify initial positions.
const ancestry=new Int32Array(d.bytes.length),tags=new Int32Array(d.bytes.length),t=d.tokens;
for(let i=0;i<t.n;i++){
 const p=t.start[i],L=t.length[i],D=t.distance[i],s=t.symbol[i];if(!L)continue;
 if(s<256)ancestry[p]=i;else for(let k=0;k<L;k++){const q=p+k-D;ancestry[p+k]=q<0?q:ancestry[q];}
}
assert.deepEqual(ancestry,d.origins);let unknownBytes=0;
for(let p=0;p<tags.length;p++){const o=ancestry[p];tags[p]=o<0?o:t.symbol[o];if(o<0)unknownBytes++;else assert.equal(tags[p],d.bytes[p]);}
writeTyped(path.join(CACHE,'tags.bin'),tags);writeTyped(path.join(CACHE,'tags.i32'),tags);
const cycle=Uint8Array.from({length:32768},(_,i)=>i&255),cycleNative=zlib.inflateRawSync(d.stream,{dictionary:cycle}),cycleFromOrigins=new Uint8Array(d.bytes.length);
for(let p=0;p<ancestry.length;p++){const o=ancestry[p];cycleFromOrigins[p]=o<0?cycle[32768+o]:t.symbol[o];}assert.ok(cycleNative.equals(Buffer.from(cycleFromOrigins)));

const perBlock=d.blocks.map(b=>({block:b.block,start:b.start,end:b.end,bytes:b.end-b.start,tokens:b.tokens,literals:b.literals,matches:b.matches,syntheticEnd:b.synthetic,endpointEligible:0,endpointKnown:0,endpointSameHistory:0,endpointNominalZero:0,endpointUnresolved:0,sameSymbolAbsorptions:0,sameSymbolSavedBits:0,nativeMaxDistanceViolations:0}));
const endpoints=[],absorptions=[];let tokStart=0;
for(const block of d.blocks){
 const row=perBlock[block.block-1],stop=tokStart+block.tokens;let first=tokStart,last=stop-1;while(first<stop&&!t.length[first])first++;while(last>=first&&!t.length[last])last--;
 for(let i=first;i<=last;i++){
  const p=t.start[i],L=t.length[i],D=t.distance[i],s=t.symbol[i];if(!D)continue;if(D>32506)row.nativeMaxDistanceViolations++;
  if(i===first||i===last||L>=258||p+L>=block.end)continue;
  row.endpointEligible++;const a=p+L,q=a-D,ta=tags[a],tq=q<0?q:tags[q];
  const za=ta<0?0:ta,zq=tq<0?0:tq;if(za===zq)row.endpointNominalZero++;
  if(ta!==tq){if(ta<0||tq<0)row.endpointUnresolved++;continue;}
  const kind=ta<0?'same_history':'known_byte';row[kind==='known_byte'?'endpointKnown':'endpointSameHistory']++;
  const src=sourceAtStreamBit(context,t.bit[i]),orgA=d.origins[a],orgB=q<0?q:d.origins[q];
  const witness={token:i,block:block.block,output:p,length:L,distance:D,endpoint:a,source_endpoint:q,kind,value_or_history:ta,endpoint_origin:orgA,source_origin:orgB,stream_bit:t.bit[i],stream_end:t.end[i],prepared_byte:src.preparedByte,inverse_byte:src.inverseByte,uploaded_byte:src.uploadedByte};endpoints.push(witness);
  // Stay within the canonical range of the SAME length symbol; exclude the
  // alternate symbol284/extra31 spelling of258, whose canonical symbol is285.
  const k=s-257,maxSame=k<28?C.LB[k+1]-1:258;
  if(i+1<stop&&t.symbol[i+1]<256&&t.length[i+1]===1&&t.start[i+1]===a&&t.bit[i+1]===t.end[i]&&L+1<=maxSame){
   assert.equal(ta,t.symbol[i+1]);const literalBits=t.end[i+1]-t.bit[i+1],oldBits=t.end[i+1]-t.bit[i],newBits=t.end[i]-t.bit[i];assert.equal(oldBits-newBits,literalBits);assert.ok(literalBits>0);
   absorptions.push({...witness,literal_token:i+1,literal:t.symbol[i+1],length_symbol:s,length_extra_bit:t.lbit[i],length_extra_width:C.LE[k],new_length:L+1,old_pair_bits:oldBits,new_match_bits:newBits,saved_bits:literalBits,literal_end_bit:t.end[i+1]});row.sameSymbolAbsorptions++;row.sameSymbolSavedBits+=literalBits;
  }
 }
 tokStart=stop;
}
assert.equal(tokStart,t.n);
const totals={};for(const k of ['bytes','tokens','literals','matches','endpointEligible','endpointKnown','endpointSameHistory','endpointNominalZero','endpointUnresolved','sameSymbolAbsorptions','sameSymbolSavedBits','nativeMaxDistanceViolations'])totals[k]=perBlock.reduce((a,b)=>a+b[k],0);
assert.equal(totals.endpointEligible,452999);assert.equal(totals.endpointKnown+totals.endpointSameHistory,102472);assert.equal(endpoints[0].token,644);
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>r[k]).join(',')).join('\n')+'\n';}
fs.writeFileSync(path.join(CACHE,'endpoint_witnesses_all.csv'),csv(endpoints));fs.writeFileSync(path.join(CACHE,'same_symbol_absorptions_all.csv'),csv(absorptions));
fs.writeFileSync(path.join(HERE,'endpoint_witnesses_first250.csv'),csv(endpoints.slice(0,250)));fs.writeFileSync(path.join(HERE,'same_symbol_absorptions_first250.csv'),csv(absorptions.slice(0,250)));fs.writeFileSync(path.join(HERE,'block_diagnostics.csv'),csv(perBlock));

// Verify the diagnostic equivalent encoding on actual data, with no pixel edits.
// This is NOT a source-compatible repair: it merely validates the bit-cost test.
const rewritten=new C.BitWriter();let previous=0;for(const w of absorptions){rewritten.slice(d.stream,previous,w.length_extra_bit);const extra=w.new_length-C.LB[w.length_symbol-257];rewritten.put(extra,w.length_extra_width);rewritten.slice(d.stream,w.length_extra_bit+w.length_extra_width,w.stream_end);previous=w.literal_end_bit;}rewritten.slice(d.stream,previous,d.bitEnd);
assert.equal(d.bitEnd-rewritten.pos,totals.sameSymbolSavedBits);const equivalent=rewritten.finish();assert.ok(zlib.inflateRawSync(equivalent,{dictionary:Buffer.alloc(32768)}).equals(native));assert.ok(zlib.inflateRawSync(equivalent,{dictionary:cycle}).equals(cycleNative));writeTyped(path.join(CACHE,'same_symbol_equivalent.deflate'),equivalent);

const sourcePaths=['data/saf_dat_col.utf8.bin','data/community.bin','data/index.json','data/original_headerguided.json','js/codec.js','package.json','research/2026-10-20/baseline/export.mjs','research/2026-10-20/baseline/io.mjs','research/2026-10-20/baseline/schema.json'];
const sourceFiles=sourcePaths.map(p=>({path:p,bytes:read(p).length,sha256:sha(read(p))}));
const listFiles=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?listFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);
const artifacts=listFiles(CACHE).filter(p=>!p.endsWith('/manifest.json')&&!p.endsWith('.log')).sort().map(p=>({path:rel(p),bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))}));
const summary={formatVersion:1,candidate:'original_headerguided',scope:'Nominal selected distances, lengths and literal symbols only; no all-distance-selector proof is recreated. Dictionary-independent equalities use distinct initial-history identities. Ordinary-zlib endpoint rules are conditional encoder diagnostics, not format legality or original-image authentication.',runtime:{node:process.version,nativeZlib:process.versions.zlib},streamBytes:d.stream.length,streamBits:d.bitEnd,outputBytes:d.bytes.length,tokenCount:t.n,unknownHistoryDescendants:unknownBytes,unmappedInverseCodepoints:inverse.unmapped,syntheticEndBlocks:d.blocks.filter(b=>b.synthetic).map(b=>b.block),totals,firstEndpoint:endpoints[0],firstSameSymbolAbsorption:absorptions[0],verification:{expectedSourceAndRecipeHashes:true,expectedStreamAndOutputHashes:true,nativeZeroDictionaryExact:true,independentTokenAncestryExact:true,cycleDictionaryAncestryExact:true,sourceStageMapsAndReassemblyExact:true,cycleDictionaryOutputSha256:sha(cycleNative),sameSymbolEquivalent:{pairs:absorptions.length,savedBits:totals.sameSymbolSavedBits,streamBits:rewritten.pos,streamBytes:equivalent.length,streamSha256:sha(equivalent),nativeZeroAndCycleOutputsUnchanged:true}},coordinateConventions:'All indices zero-based; bit positions LSB-first; ranges end-exclusive; binary arrays little-endian. Negative origin/tag -k refers to dictionary position32768-k. Source uploadedByte points to the start of a UTF-8 codepoint; inverse-byte bit coordinates are not raw UTF-8 bit coordinates.',sourceFiles,artifacts};
writeJSON(path.join(CACHE,'manifest.json'),summary);
writeJSON(path.join(HERE,'summary.json'),{...summary,perBlock});
console.log(JSON.stringify({cache:rel(CACHE),streamSha256:sha(d.stream),outputSha256:sha(d.bytes),totals,firstEndpoint:endpoints[0],firstSameSymbolAbsorption:absorptions[0]},null,2));
