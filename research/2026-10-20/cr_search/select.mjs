import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const HERE=import.meta.dirname,read=n=>fs.readFileSync(path.join(HERE,n));
const inventory=JSON.parse(read('candidates.json'));
const scores=read('scores.jsonl').toString().trim().split('\n').map(JSON.parse);
assert.equal(scores.length,inventory.cases.length+1);
const baseline=scores.find(s=>s.id==='0'),cases=new Map(inventory.cases.map(c=>[String(c.id),c]));
assert.ok(baseline.valid);
const valid=scores.filter(s=>s.id!=='0'&&s.valid);
const selected=new Map();
for(const [key,limit] of [['cheaper_absorptions',2],['endpoint_equalities',2],['same_symbol_absorptions',1]]){
  const ranked=[...valid].sort((a,b)=>{
    let v=a.train[key]*b.train.tested-b.train[key]*a.train.tested;
    if(v)return v;
    v=Math.abs(a.output_bytes-baseline.output_bytes)-Math.abs(b.output_bytes-baseline.output_bytes);if(v)return v;
    const ca=cases.get(a.id),cb=cases.get(b.id);
    return Math.abs(ca.delta)-Math.abs(cb.delta)||ca.from-cb.from||ca.to-cb.to;
  });
  for(const s of ranked.slice(0,limit)){
    if(!selected.has(s.id))selected.set(s.id,{...cases.get(s.id),selectedBy:[],score:s});
    selected.get(s.id).selectedBy.push(key);
  }
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const out={frozenBeforeBlocks2To4Evaluation:true,protocolSha256:hash(read('protocol.json')),
  candidateManifestSha256:hash(read('candidates.json')),scoresSha256:hash(read('scores.jsonl')),
  candidates:inventory.cases.length,structurallyValid:valid.length,invalid:inventory.cases.length-valid.length,
  baseline,selected:[...selected.values()]};
fs.writeFileSync(path.join(HERE,'shortlist.json'),JSON.stringify(out,null,2)+'\n');
const wanted=new Set(['0',...selected.keys()]);
fs.writeFileSync(path.join(HERE,'shortlist.tsv'),read('candidates.tsv').toString().split('\n').filter(l=>wanted.has(l.split(' ')[0])).join('\n')+'\n');
const fields=['id','valid','from','to','delta','changed_bits','tokens_including_eob','output_bytes','output_delta','error'];
const metrics=['tested','known_endpoint_comparisons','unresolved_endpoint_comparisons','endpoint_equalities','cheaper_absorptions','same_symbol_absorptions','known_output_bytes'];
const allFields=[...fields,...['train','heldout_b1'].flatMap(r=>metrics.map(m=>r+'_'+m))];
const rows=scores.map(s=>{const c=cases.get(s.id)||{from:'',to:'',delta:0};const r={...s,...c,output_delta:s.output_bytes-baseline.output_bytes};
  for(const region of ['train','heldout_b1'])for(const m of metrics)r[region+'_'+m]=s[region]?.[m]??'';
  return allFields.map(k=>JSON.stringify(r[k]??'')).join(',');});
fs.writeFileSync(path.join(HERE,'all_candidates.csv'),allFields.join(',')+'\n'+rows.join('\n')+'\n');
console.log(JSON.stringify({candidates:out.candidates,valid:out.structurallyValid,invalid:out.invalid,
  selected:out.selected.map(c=>({id:c.id,from:c.from,to:c.to,selectedBy:c.selectedBy,train:c.score.train,outputDelta:c.score.output_bytes-baseline.output_bytes}))},null,2));
