/** Exact source-token registration; no image registration or candidate selection. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as C from '../../../js/codec.js';
import {ROOT,loadBaseline,readTyped} from '../baseline/io.mjs';

const HERE=import.meta.dirname,CACHE=path.join(ROOT,'research/2026-10-20/cache/propagation');
fs.mkdirSync(CACHE,{recursive:true});
const rel=p=>path.relative(ROOT,p),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputFiles=new Map();
function input(p){const abs=path.resolve(ROOT,p),b=fs.readFileSync(abs);inputFiles.set(rel(abs),{bytes:b.length,sha256:hash(b)});return b;}
const json=p=>JSON.parse(input(p));
const baseline=loadBaseline({sourceMaps:false,payload:true});
for(const p of ['js/codec.js','package.json','research/2026-10-20/baseline/io.mjs','research/2026-10-20/cache/baseline/manifest.json','research/2026-10-20/cache/baseline/bytes.bin','research/2026-10-20/cache/baseline/origins.bin','research/2026-10-20/cache/baseline/stream.bin','research/2026-10-20/cache/baseline/blocks.json'])input(p);
for(const k of ['start','bit','end','symbol','length','distance','dsym','block'])input(`research/2026-10-20/cache/baseline/token_${k}.bin`);
const cr=json('research/2026-10-20/cr_search/verification.json');
const source=json('research/2026-10-20/source_search/verification_summary.json');
const specs=[...cr.results.map(r=>({family:'cr',id:r.id,cache:r.cache,streamHash:r.streamSha256,bytesHash:r.outputSha256,firstBit:r.firstSourceTokenResynchronization.streamBit,recordedResync:r.firstSourceTokenResynchronization,sourceEdit:{removeCR:r.from,insertCR:r.to},recordedSameIndex:r.changedAtSameOutputIndex})),...source.results.filter(r=>r.id!==0).map(r=>({family:'source_bit',id:r.id,cache:path.dirname(r.cache_payload),streamHash:r.stream_sha256,bytesHash:r.payload_sha256,originsHash:r.origins_sha256,firstBit:r.framing.resynchronization_bit,recordedResync:null,sourceEdit:r.recipe_delta}))];
const byBit=new Map();for(let t=0;t<baseline.tokens.n;t++)byBit.set(baseline.tokens.bit[t],t);
const results=[];
function emptyStats(){return {compared:0,nominalUnequal:0,bothKnown:0,knownUnequal:0,oneUnknown:0,bothUnknown:0,equalSameSeed:0,differentUnknownSeeds:0,symbolicallyEqual:0,symbolicTagDisagreements:0,firstNominalUnequal:null,lastNominalUnequal:null,firstKnownUnequal:null,lastKnownUnequal:null,firstTagDisagreement:null,lastTagDisagreement:null};}
function add(s,p,a,b,ao,bo){
 s.compared++;
 const neq=a!==b,ak=ao>=0,bk=bo>=0,tagEq=ak&&bk?a===b:!ak&&!bk&&ao===bo;
 if(neq){s.nominalUnequal++;s.firstNominalUnequal??=p;s.lastNominalUnequal=p;}
 if(ak&&bk){s.bothKnown++;if(neq){s.knownUnequal++;s.firstKnownUnequal??=p;s.lastKnownUnequal=p;}}
 else if(ak||bk)s.oneUnknown++;
 else {s.bothUnknown++;if(ao===bo)s.equalSameSeed++;else s.differentUnknownSeeds++;}
 if(tagEq)s.symbolicallyEqual++;
 else {s.symbolicTagDisagreements++;s.firstTagDisagreement??=p;s.lastTagDisagreement=p;}
 return tagEq;
}
function sumStats(list){const s=emptyStats();for(const x of list)for(const k of Object.keys(s)){if(k.startsWith('first')){if(x[k]!==null)s[k]=s[k]===null?x[k]:Math.min(s[k],x[k]);}else if(k.startsWith('last')){if(x[k]!==null)s[k]=s[k]===null?x[k]:Math.max(s[k],x[k]);}else s[k]+=x[k];}return s;}
function blockAt(p){return p===null?null:baseline.blocks.find(b=>p>=b.start&&p<b.end)?.block??null;}
function commonKnownEndpoints(d,bytes,origins,tokenDelta){
 const out=[],t=baseline.tokens;
 for(const block of baseline.blocks.filter(b=>b.block>=2&&b.block<=4)){
  let first=byBit.get(block.body),end=first;
  assert.notEqual(first,undefined);while(end<t.n&&t.block[end]===block.block)end++;
  let last=end-1;while(last>=first&&t.length[last]===0)last--;
  const s={block:block.block,eligibleMatches:0,baselineKnown:0,candidateKnown:0,commonKnown:0,baselineOnlyKnown:0,candidateOnlyKnown:0,neitherKnown:0,baselineKnownEqualities:0,candidateKnownEqualities:0,commonBaselineEqualities:0,commonCandidateEqualities:0,commonEqualitiesRemoved:0,commonEqualitiesIntroduced:0,commonEqualitiesBoth:0,commonEqualitiesNeither:0,commonCheaperEligible:0,commonBaselineCheaper:0,commonCandidateCheaper:0,commonCheaperRemoved:0,commonCheaperIntroduced:0,commonBaselineSavedBits:0,commonCandidateSavedBits:0};
  for(let a=first;a<=last;a++){
   if(!t.distance[a]||t.length[a]>=258||a===first||a===last)continue;
   const b=a+tokenDelta,q=t.start[a]+t.length[a],r=q-t.distance[a],cq=d.tokens.start[b]+d.tokens.length[b],cr=cq-d.tokens.distance[b];
   assert.equal(t.bit[a],d.tokens.bit[b]);assert.ok(q<block.end&&r>=0&&cq<d.blocks[block.block-1].end&&cr>=0);
   s.eligibleMatches++;
   const bk=baseline.origins[q]>=0&&baseline.origins[r]>=0,ck=origins[cq]>=0&&origins[cr]>=0;
   const be=baseline.bytes[q]===baseline.bytes[r],ce=bytes[cq]===bytes[cr];
   if(bk){s.baselineKnown++;if(be)s.baselineKnownEqualities++;}
   if(ck){s.candidateKnown++;if(ce)s.candidateKnownEqualities++;}
   if(!(bk&&ck)){if(bk)s.baselineOnlyKnown++;else if(ck)s.candidateOnlyKnown++;else s.neitherKnown++;continue;}
   s.commonKnown++;s.commonBaselineEqualities+=Number(be);s.commonCandidateEqualities+=Number(ce);
   if(be&&ce)s.commonEqualitiesBoth++;else if(be)s.commonEqualitiesRemoved++;else if(ce)s.commonEqualitiesIntroduced++;else s.commonEqualitiesNeither++;
   if(a+1>last||t.symbol[a+1]>=256)continue;
   let ns=257;while(ns<285&&C.LB[ns-256]<=t.length[a]+1)ns++;
   if(!block.ll[ns])continue;
   const save=block.ll[t.symbol[a]]+C.LE[t.symbol[a]-257]+block.ll[t.symbol[a+1]]-block.ll[ns]-C.LE[ns-257];
   if(save<=0)continue;s.commonCheaperEligible++;
   if(be){s.commonBaselineCheaper++;s.commonBaselineSavedBits+=save;}
   if(ce){s.commonCandidateCheaper++;s.commonCandidateSavedBits+=save;}
   if(be&&!ce)s.commonCheaperRemoved++;if(ce&&!be)s.commonCheaperIntroduced++;
  }
  out.push(s);
 }
 const total={block:'2–4'};for(const k of Object.keys(out[0]).filter(k=>k!=='block'))total[k]=out.reduce((s,b)=>s+b[k],0);
 return {blocks:out,total};
}
for(const spec of specs){
 const bytes=input(path.join(spec.cache,'bytes.bin')),stream=input(path.join(spec.cache,'stream.bin')),originRaw=input(path.join(spec.cache,'origins.bin'));
 assert.equal(hash(stream),spec.streamHash);assert.equal(hash(bytes),spec.bytesHash);
 if(spec.originsHash)assert.equal(hash(originRaw),spec.originsHash);
 const origins=readTyped(path.join(ROOT,spec.cache,'origins.bin'),Int32Array);
 assert.equal(origins.length,bytes.length);
 const d=C.inflate({stream:new Uint8Array(stream),bits:baseline.bits,recipe:{expected:{bytes:bytes.length}}});
 assert.equal(d.error,null);assert.equal(d.bytes.length,bytes.length);
 assert.deepEqual(Buffer.from(d.bytes),bytes);
 assert.deepEqual(Buffer.from(d.origins.buffer,d.origins.byteOffset,d.origins.byteLength),originRaw);
 const bt=byBit.get(spec.firstBit);assert.notEqual(bt,undefined);
 let ct=-1;for(let t=0;t<d.tokens.n;t++)if(d.tokens.bit[t]===spec.firstBit){ct=t;break;}
 assert.ok(ct>=0);const delta=d.tokens.start[ct]-baseline.tokens.start[bt];
 const resync={streamBit:spec.firstBit,baselineToken:bt,candidateToken:ct,baselineOutput:baseline.tokens.start[bt],candidateOutput:d.tokens.start[ct],outputDelta:delta};
 if(spec.recordedResync)assert.deepEqual(resync,spec.recordedResync);
 assert.equal(d.tokens.n-ct,baseline.tokens.n-bt);
 for(let a=bt,b=ct;a<baseline.tokens.n;a++,b++){
  for(const k of ['bit','end','symbol','length','distance','dsym','block'])assert.equal(d.tokens[k][b],baseline.tokens[k][a],`Suffix ${k} at ${a}/${b}`);
  assert.equal(d.tokens.start[b]-baseline.tokens.start[a],delta);
 }
 assert.equal(bytes.length-baseline.bytes.length,delta);
 assert.deepEqual(d.blocks.map(b=>[b.bit,b.body,b.endBit,b.ll,b.dd]),baseline.blocks.map(b=>[b.bit,b.body,b.endBit,b.ll,b.dd]));
 const sameIndex=emptyStats();
 for(let p=0;p<Math.min(bytes.length,baseline.bytes.length);p++)add(sameIndex,p,baseline.bytes[p],bytes[p],baseline.origins[p],origins[p]);
 if(spec.recordedSameIndex!==undefined)assert.equal(sameIndex.nominalUnequal,spec.recordedSameIndex);
 let equalRun=0,historyConvergence=null;const blocks=[];
 for(const b of baseline.blocks){
  const start=Math.max(b.start,resync.baselineOutput),end=b.end;
  if(start>=end)continue;
  assert.ok(start+delta>=0&&end+delta<=bytes.length);
  const s=emptyStats();
  for(let p=start;p<end;p++){
   const same=add(s,p,baseline.bytes[p],bytes[p+delta],baseline.origins[p],origins[p+delta]);
   equalRun=same?equalRun+1:0;
   if(equalRun===32768&&historyConvergence===null)historyConvergence={baselineNextOutput:p+1,candidateNextOutput:p+1+delta,equalWindowBaseline:[p+1-32768,p+1],equalWindowCandidate:[p+1+delta-32768,p+1+delta]};
   if(historyConvergence!==null)assert.ok(same,'Once a full LZ window converges, identical future instructions must preserve equality.');
  }
  blocks.push({block:b.block,syntheticEnding:b.synthetic,baselineRange:[start,end],candidateRange:[start+delta,end+delta],...s});
 }
 const aligned=sumStats(blocks);
 const permanentEqualSuffixBaseline=aligned.lastTagDisagreement===null?resync.baselineOutput:aligned.lastTagDisagreement+1;
 const commonKnown=commonKnownEndpoints(d,bytes,origins,ct-bt);
 const baselineReference=source.results.find(r=>r.id===0).metrics.blocks;
 const candidateReference=spec.family==='cr'?cr.results.find(r=>r.id===spec.id).continuation.blocks:source.results.find(r=>r.id===spec.id).metrics.blocks;
 for(const b of commonKnown.blocks){
  const br=baselineReference.find(r=>r.block===b.block).stats,dr=candidateReference.find(r=>r.block===b.block).stats;
  assert.equal(b.eligibleMatches,br.tested);assert.equal(b.eligibleMatches,dr.tested);
  assert.equal(b.baselineKnown,br.known_endpoint_comparisons);assert.equal(b.candidateKnown,dr.known_endpoint_comparisons);
  assert.equal(b.baselineKnownEqualities,br.equal_known);assert.equal(b.candidateKnownEqualities,dr.equal_known);
 }
 const r={family:spec.family,id:spec.id,sourceEdit:spec.sourceEdit,cache:spec.cache,streamSha256:hash(stream),payloadSha256:hash(bytes),originsSha256:hash(originRaw),outputBytes:bytes.length,resynchronization:resync,verification:{cachedBytesAndOriginsEqualCodec:true,allSuffixInstructionsAndConstantOutputDeltaExact:true,allHeadersAndBlockEndsExact:true,endpointEligibilityAndMarginalsEqualFrozenCppScores:true},sameIndex,aligned,blocks,historyConvergence,permanentEqualSuffixBaseline,permanentEqualSuffixCandidate:permanentEqualSuffixBaseline+delta,permanentEqualSuffixBytes:baseline.bytes.length-permanentEqualSuffixBaseline,lastNominalUnequalBlock:blockAt(aligned.lastNominalUnequal),lastKnownUnequalBlock:blockAt(aligned.lastKnownUnequal),lastTagDisagreementBlock:blockAt(aligned.lastTagDisagreement),commonKnownEndpointsB2to4:commonKnown};
 results.push(r);
 console.log(JSON.stringify({candidate:`${spec.family}_${spec.id}`,delta,sameIndex:sameIndex.nominalUnequal,alignedAny:aligned.nominalUnequal,alignedKnown:aligned.knownUnequal,unresolved:aligned.oneUnknown+aligned.differentUnknownSeeds,lastTag:aligned.lastTagDisagreement,lastTagBlock:r.lastTagDisagreementBlock,historyConvergence}));
}
const report={scope:'Diagnostic registration by an exact shared compressed-source token boundary. No candidate selection, image alignment, new source changes, or authenticity claim.',dictionary:'Both streams share the same arbitrary 32768-byte incoming dictionary. Known means a literal descendant under each selected nominal parse; it does not mean authenticated original data. A tag is a known value or the negative identity of an initial dictionary byte.',interpretation:{nominalUnequal:'Different decoded bytes with the codec zero dictionary.',knownUnequal:'Different values at positions where both decodes are independent of the incoming dictionary; guaranteed unequal for any shared dictionary.',symbolicTagDisagreements:'Known unequal or unresolved dictionary expressions. Different unknown tags need not have different actual values.',historyConvergence:'First 32768-byte all-tag-equal window wholly after resynchronization. Together with the verified identical future instructions, it proves aligned LZ state equality thereafter.',coordinates:'All first/last difference coordinates are zero-based baseline payload bytes, not image pixels. Ranges are half-open. candidate position = baseline position + outputDelta.',suffix:'The permanent equal suffix is equality of literal values/initial-history expressions; literal-token IDs need not coincide. Counts after resynchronization omit the locally reparsed span and are not whole-payload edit distances.',commonKnown:'B2–4 tokens are paired by the identical full instruction suffix and checked by stream bit. Both endpoint values must be independent of the incoming dictionary in both decodes. First/final data tokens and lengths258 are excluded. Positive-cost match-plus-literal absorptions may change the LL symbol; counts use the same common-known token set and retained codebook. These are encoder/cost diagnostics, not universal DEFLATE invalidity or authenticity tests.',synthetic:'Blocks 12, 13, and 20 retain synthetic endings from the baseline recipe. Results describe these candidate streams, not an authenticated complete PNG.'},baseline:{outputBytes:baseline.bytes.length,payloadSha256:hash(baseline.bytes),streamSha256:hash(baseline.stream)},results};
fs.writeFileSync(path.join(HERE,'results.json'),JSON.stringify(report,null,2)+'\n');
const fields=['family','id','block','baselineStart','baselineEnd','candidateStart','candidateEnd','delta','compared','nominalUnequal','bothKnown','knownUnequal','oneUnknown','bothUnknown','equalSameSeed','differentUnknownSeeds','symbolicallyEqual','symbolicTagDisagreements','lastNominalUnequal','lastKnownUnequal','lastTagDisagreement'];
const rows=[fields.join(',')];for(const r of results)for(const b of r.blocks){const x={...b,family:r.family,id:r.id,baselineStart:b.baselineRange[0],baselineEnd:b.baselineRange[1],candidateStart:b.candidateRange[0],candidateEnd:b.candidateRange[1],delta:r.resynchronization.outputDelta};rows.push(fields.map(k=>x[k]??'').join(','));}
fs.writeFileSync(path.join(HERE,'per_block.csv'),rows.join('\n')+'\n');
const brief=results.map(r=>({candidate:`${r.family}_${r.id}`,delta:r.resynchronization.outputDelta,resync:r.resynchronization.baselineOutput,sameIndexUnequal:r.sameIndex.nominalUnequal,alignedUnequal:r.aligned.nominalUnequal,alignedKnownUnequal:r.aligned.knownUnequal,alignedKnownCompared:r.aligned.bothKnown,alignedCompared:r.aligned.compared,lastAlignedUnequal:r.aligned.lastNominalUnequal,lastTagDisagreement:r.aligned.lastTagDisagreement,lastTagBlock:r.lastTagDisagreementBlock,convergedAt:r.historyConvergence?.baselineNextOutput??null,equalSuffixBytes:r.permanentEqualSuffixBytes}));
fs.writeFileSync(path.join(HERE,'summary.json'),JSON.stringify(brief,null,2)+'\n');
const commonFields=['family','id',...Object.keys(results[0].commonKnownEndpointsB2to4.total)];
const commonRows=[commonFields.join(',')];for(const r of results)for(const b of [...r.commonKnownEndpointsB2to4.blocks,r.commonKnownEndpointsB2to4.total]){const x={family:r.family,id:r.id,...b};commonRows.push(commonFields.map(k=>x[k]).join(','));}
fs.writeFileSync(path.join(HERE,'common_known_endpoints.csv'),commonRows.join('\n')+'\n');
input(path.join(HERE,'audit.mjs'));
const outputs={};for(const f of ['results.json','summary.json','per_block.csv','common_known_endpoints.csv']){const p=path.join(HERE,f),b=fs.readFileSync(p);outputs[rel(p)]={bytes:b.length,sha256:hash(b)};}
if(fs.existsSync(path.join(HERE,'README.md'))){const p=path.join(HERE,'README.md'),b=fs.readFileSync(p);outputs[rel(p)]={bytes:b.length,sha256:hash(b)};}
const manifest={command:'node research/2026-10-20/propagation/audit.mjs',runtime:process.version,inputs:Object.fromEntries([...inputFiles].sort(([a],[b])=>a.localeCompare(b))),outputs};
fs.writeFileSync(path.join(HERE,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
