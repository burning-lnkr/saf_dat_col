/* Independent repository-codec and native-zlib verification, no image selection. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import * as C from '../../../js/codec.js';
import {zlibLengths} from './zlib_lengths.mjs';

const HERE=import.meta.dirname,ROOT=path.resolve(HERE,'../../..'),CACHE=path.join(ROOT,'research/2026-10-20/cache/source_search');
const read=p=>fs.readFileSync(path.join(ROOT,p)),json=p=>JSON.parse(read(p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=JSON.parse(fs.readFileSync(path.join(HERE,'candidates.json'))),frozen=JSON.parse(fs.readFileSync(path.join(HERE,'shortlist.json')));
const scores=[...fs.readFileSync(path.join(HERE,'continuation_scores.jsonl'),'utf8').trim().split('\n'),...fs.readFileSync(path.join(HERE,'frontier_continuation.jsonl'),'utf8').trim().split('\n')].map(JSON.parse);
const byScore=new Map(scores.map(s=>[Number(s.id),s]));
const original=read('data/saf_dat_col.utf8.bin'),community=read('data/community.bin'),index=json('data/index.json'),baseRecipe=json('data/original_headerguided.json');
const inverse=C.inverseUTF8(original),basePrepared=C.prepareStream(inverse,community,index,baseRecipe),base=C.inflate(basePrepared);
assert.equal(base.error,null);assert.equal(hash(base.bytes),cases.baseline_payload_sha256);
const cycle=Uint8Array.from({length:32768},(_,i)=>i&255),results=[];
const keys=['data_tokens','output_bytes','literals','matches','known_output_bytes','tested','known_endpoint_comparisons','unresolved_endpoint_comparisons','endpoint_equalities','equal_known','equal_same_seed','cheaper_absorptions','same_symbol_absorptions','saved_bits','new_length_symbol_absent','distance_gt32506'];
const newStats=()=>({...Object.fromEntries(keys.map(k=>[k,0])),first_endpoint_bit:-1,first_cheaper_bit:-1});
function record(stats,d,i,first,last,b){
 const t=d.tokens,p=t.start[i],l=t.length[i],s=t.symbol[i],dist=t.distance[i];if(!l)return;
 stats.data_tokens++;stats.output_bytes+=l;
 for(let q=p;q<p+l;q++)stats.known_output_bytes+=d.origins[q]>=0;
 if(!dist){stats.literals++;return;}stats.matches++;stats.distance_gt32506+=dist>32506;
 if(l>=258||i===first||i===last)return;stats.tested++;
 const value=q=>q<0?q:d.origins[q]<0?d.origins[q]:d.bytes[q],x=value(p+l),y=value(p+l-dist);
 if(x>=0&&y>=0)stats.known_endpoint_comparisons++;else if(x!==y)stats.unresolved_endpoint_comparisons++;
 if(x!==y)return;stats.endpoint_equalities++;if(x>=0)stats.equal_known++;else stats.equal_same_seed++;
 if(stats.first_endpoint_bit<0)stats.first_endpoint_bit=t.bit[i];
 if(i+1>last||t.symbol[i+1]>=256)return;
 let ns=257;while(ns<285&&C.LB[ns-256]<=l+1)ns++;
 if(!b.ll[ns]){stats.new_length_symbol_absent++;return;}
 const saving=b.ll[s]+C.LE[s-257]+b.ll[t.symbol[i+1]]-b.ll[ns]-C.LE[ns-257];
 if(saving>0){stats.cheaper_absorptions++;stats.saved_bits+=saving;if(stats.first_cheaper_bit<0)stats.first_cheaper_bit=t.bit[i];}
 stats.same_symbol_absorptions+=ns===s;
}
function independentStats(d){
 const train=newStats(),heldout_b1=newStats(),blocks=[],t=d.tokens,cut=cases.training_cut_bit;
 for(let k=0;k<4;k++){
  const b=d.blocks[k],ix=[];for(let i=0;i<t.n;i++)if(t.block[i]===b.block&&t.length[i]>0)ix.push(i);
  const stats=newStats(),lf=Array(286).fill(0),df=Array(30).fill(0);
  for(let i=ix[0];i<=ix.at(-1)+1;i++){lf[t.symbol[i]]++;if(t.distance[i])df[t.dsym[i]]++;}
  for(const i of ix){record(stats,d,i,ix[0],ix.at(-1),b);if(!k)record(t.bit[i]<cut?train:heldout_b1,d,i,ix[0],ix.at(-1),b);}
  blocks.push({block:b.block,stats,ll_frequency:lf,dd_frequency:df});
 }
 return {train,heldout_b1,blocks};
}
function range(t,b){let a=0;while(a<t.n&&t.block[a]!==b)a++;let z=a;while(z<t.n&&t.block[z]===b)z++;return [a,z];}
function token(t,i){return {token:i,position:t.start[i],length:t.length[i],distance:t.distance[i],symbol:t.symbol[i],bit:t.bit[i],end:t.end[i],dsym:t.dsym[i]};}
function framing(d,c){
 const t=d.tokens,u=base.tokens,old=c.baseline_token,lookup=new Map();for(let i=0;i<u.n&&u.block[i]===1;i++)lookup.set(u.bit[i],i);
 let ci=0;while(t.bit[ci]<u.bit[old])ci++;
 let next=ci+1;while(next<t.n&&(!lookup.has(t.bit[next])||t.bit[next]<=c.bit))next++;
 assert.equal(t.block[next],1);const oldNext=lookup.get(t.bit[next]);
 const fields=['symbol','length','distance','dsym','bit','end'];
 for(let i=next,j=oldNext;t.block[i]===1&&u.block[j]===1;i++,j++)for(const f of fields)assert.equal(t[f][i],u[f][j]);
 return {resynchronization_bit:t.bit[next],old_token_span:[old,oldNext],new_token_span:[ci,next],
   old_tokens:Array.from({length:oldNext-old},(_,j)=>token(u,old+j)),new_tokens:Array.from({length:next-ci},(_,j)=>token(t,ci+j)),
   same_remaining_block1_instructions_after_resynchronization:true};
}
for(const id of [0,...new Set([...frozen.selected,1])]){
 const c=id?cases.cases.find(c=>c.id===id):null,recipe=structuredClone(baseRecipe);let delta=null;
 if(c){
  const p=c.source.preparedByte,ns=new Set(recipe.blocks[0].nul),was=ns.has(p);if(was)ns.delete(p);else ns.add(p);recipe.blocks[0].nul=[...ns].sort((a,b)=>a-b);
  delta={base_recipe:'data/original_headerguided.json',block:1,nul_add:was?[]:[p],nul_remove:was?[p]:[],stream_xor_bits:[c.bit],
    observed_uploaded_byte:c.source.uploadedByte,observed_uploaded_value:original[c.source.uploadedByte],
    prior_interpretation:was?0:32,new_interpretation:was?32:0,selection:frozen.selected.includes(id)?'preregistered_training_shortlist':'exploratory_frontier_audit'};
 }
 const prep=C.prepareStream(inverse,community,index,recipe),patched=basePrepared.stream.slice();if(c)patched[c.bit>>3]^=1<<(c.bit&7);
 assert.deepEqual(prep.stream,patched);assert.equal(prep.bits,basePrepared.bits);
 for(let b=0;b<20;b++){
  for(const field of ['start','end','sourceEnd','headerBit','synthetic','originalStart'])assert.equal(prep.parts[b][field],basePrepared.parts[b][field]);
  assert.deepEqual(prep.parts[b].headerBytes,basePrepared.parts[b].headerBytes);
 }
 const d=C.inflate(prep);assert.equal(d.error,null);assert.equal(d.bitEnd,base.bitEnd);
 assert.deepEqual(zlib.inflateRawSync(prep.stream,{dictionary:Buffer.alloc(32768)}),Buffer.from(d.bytes));
 const cycled=C.inflate(prep,{dictionary:cycle});assert.equal(cycled.error,null);
 assert.deepEqual(zlib.inflateRawSync(prep.stream,{dictionary:cycle}),Buffer.from(cycled.bytes));
 const stats=independentStats(d),cpp=byScore.get(id);assert.equal(cpp.valid,true);
 for(const field of ['train','heldout_b1','blocks'])assert.deepEqual(stats[field],cpp[field],`Independent metric mismatch${id}/${field}`);
 const cb=fs.readFileSync(path.join(CACHE,'cpp_selected',id+'.bytes.bin'));
 assert.deepEqual(cb,Buffer.from(d.bytes.subarray(0,cb.length)));
 const tb=fs.readFileSync(path.join(CACHE,'cpp_selected',id+'.tags.i32')),tags=new Int32Array(tb.buffer,tb.byteOffset,tb.length/4);
 for(let p=0;p<tags.length;p++)assert.equal(tags[p],d.origins[p]<0?d.origins[p]:d.bytes[p]);
 const outputDelta=d.blocks[0].end-base.blocks[0].end;
 for(let b=1;b<20;b++){
  const [a,z]=range(d.tokens,b+1),[oa,oz]=range(base.tokens,b+1);assert.equal(z-a,oz-oa);
  for(let i=a,j=oa;i<z;i++,j++){
   for(const field of ['bit','end','symbol','length','distance','dsym'])assert.equal(d.tokens[field][i],base.tokens[field][j]);
   assert.equal(d.tokens.start[i],base.tokens.start[j]+outputDelta);
  }
 }
 const treeCompatibility=stats.blocks.map(row=>{
  const b=d.blocks[row.block-1],ll=zlibLengths(row.ll_frequency),dd=zlibLengths(row.dd_frequency);
  return {block:row.block,ll_differing_symbols:ll.flatMap((v,i)=>v===(b.ll[i]||0)?[]:[i]),dd_differing_symbols:dd.flatMap((v,i)=>v===(b.dd[i]||0)?[]:[i]),
   qualification:'Historical zlib frequency-to-tree fingerprint only, not a general DEFLATE validity condition or selection gate.'};
 });
 const rec={id,selection:id===0?'baseline':delta.selection,source:c?.source||null,recipe_delta:delta,
   output_bytes:d.bytes.length,payload_sha256:hash(d.bytes),stream_sha256:hash(prep.stream),origins_sha256:hash(Buffer.from(d.origins.buffer,d.origins.byteOffset,d.origins.byteLength)),
   block1_output_delta:outputDelta,block1_token_delta:d.blocks[0].tokens-base.blocks[0].tokens,
   first4_cpp_tags_and_bytes_identical:true,first4_cpp_metrics_identical:true,native_zero_and_cycle_dictionary_equal:true,
   captured_headers_and_source_endpoints_identical:true,only_claimed_wire_bit_changed:true,
   later_source_tokens_identical:true,later_checks_are_history_dependent:true,tree_compatibility:treeCompatibility,
   framing:c?framing(d,c):null,metrics:stats};
 if(id){
  const dir=path.join(CACHE,'candidate_'+id);fs.mkdirSync(dir,{recursive:true});
  recipe.name='provisional_source_search_'+id;recipe.expected={bytes:d.bytes.length,sha256:rec.payload_sha256};
  fs.writeFileSync(path.join(HERE,'candidate_'+id+'.recipe.json'),JSON.stringify(recipe)+'\n');
  fs.writeFileSync(path.join(HERE,'candidate_'+id+'.delta.json'),JSON.stringify(delta,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'bytes.bin'),d.bytes);fs.writeFileSync(path.join(dir,'origins.bin'),Buffer.from(d.origins.buffer,d.origins.byteOffset,d.origins.byteLength));
  fs.writeFileSync(path.join(dir,'stream.bin'),prep.stream);fs.writeFileSync(path.join(dir,'blocks.json'),JSON.stringify(d.blocks,null,2)+'\n');
  rec.cache_payload=path.relative(ROOT,path.join(dir,'bytes.bin'));rec.cache_origins=path.relative(ROOT,path.join(dir,'origins.bin'));
  rec.recipe_path=path.relative(ROOT,path.join(HERE,'candidate_'+id+'.recipe.json'));
 }
 results.push(rec);console.log(JSON.stringify({id,outputDelta,tokenDelta:rec.block1_token_delta,payloadSHA256:rec.payload_sha256,framing:rec.framing,
   cppNativeVerified:true,cache_payload:rec.cache_payload}));
}
fs.writeFileSync(path.join(HERE,'verification_summary.json'),JSON.stringify({scope:'Actual-source one-bit alternative interpretations. All selected recipes retain source endpoints and are provisional; untouched later source is evaluated with altered history, not statistically independent data.',
  protocol_sha256:cases.protocol_sha256,freeze_ledger_sha256:hash(fs.readFileSync(path.join(HERE,'freeze_ledger.json'))),
  native_zlib:process.versions.zlib,results},null,2)+'\n');
