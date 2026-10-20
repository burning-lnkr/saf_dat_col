import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {loadBaseline,ROOT,sourceAtStreamBit} from '../baseline/io.mjs';

const HERE=import.meta.dirname;
const protocol=JSON.parse(fs.readFileSync(path.join(HERE,'protocol.json')));
const data=loadBaseline({payload:false}),part=data.parts[0],block=data.blocks[0];
const recipe=JSON.parse(fs.readFileSync(path.join(ROOT,protocol.baseline_recipe)));
const originalCRs=new Set(recipe.blocks[0].cr);
const cut=Math.floor((block.body+block.endBit)/2);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const cases=[];
function firstPrepared(p){
  let lo=0,hi=part.prep.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(part.prep[mid]<p)lo=mid+1;else hi=mid;}
  return lo;
}
for(const from of [...originalCRs].sort((a,b)=>a-b)){
  const i=firstPrepared(from);
  assert.equal(part.prep[i],from);
  assert.ok(part.map[i]<0,'Existing CR must be an inserted byte');
  assert.equal(part.preparedBytes[i],13);
  for(const delta of protocol.candidate_domain.prepared_position_deltas){
    const to=from+delta;
    if(to<0||to>=part.rawPrepared.length||originalCRs.has(to))continue;
    const j=firstPrepared(to);
    if(part.prep[j]!==to)continue;
    const lo=delta>0?i:j,hi=delta>0?j:i+1;
    const startBit=part.start+lo*8-part.headerBit,endBit=part.start+hi*8-part.headerBit;
    if(startBit<block.body||endBit>cut)continue;
    const replacement=part.preparedBytes.slice(lo,hi);
    if(delta>0){replacement.copyWithin(0,1);replacement[replacement.length-1]=13;}
    else {replacement.copyWithin(1,0,replacement.length-1);replacement[0]=13;}
    assert.equal(replacement.length*8,endBit-startBit);
    const baseline=part.preparedBytes.slice(lo,hi);
    const differingBits=[];
    for(let k=0;k<replacement.length;k++)for(let b=0;b<8;b++)if(((replacement[k]^baseline[k])>>b)&1)differingBits.push(startBit+k*8+b);
    if(!differingBits.length)continue;
    const source=sourceAtStreamBit(data,part.start+i*8-part.headerBit);
    const target=sourceAtStreamBit(data,part.start+j*8-part.headerBit);
    cases.push({id:cases.length+1,block:1,from,to,delta,source,target,startBit,endBit,nbits:endBit-startBit,
      replacementHex:Buffer.from(replacement).toString('hex'),differingBits,changedBitCount:differingBits.length});
  }
}
fs.writeFileSync(path.join(HERE,'candidates.json'),JSON.stringify({
  protocolSha256:hash(fs.readFileSync(path.join(HERE,'protocol.json'))),
  sourceSha256:'53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c',
  recipeSha256:hash(fs.readFileSync(path.join(ROOT,protocol.baseline_recipe))),
  streamSha256:hash(data.stream),bodyBit:block.body,endBit:block.endBit,trainingCutBit:cut,
  existingCRs:originalCRs.size,eligible:cases.length,cases
},null,2)+'\n');
fs.writeFileSync(path.join(HERE,'candidates.tsv'),'0 N\n'+cases.map(c=>`${c.id} P ${c.startBit} ${c.nbits} ${c.replacementHex}`).join('\n')+'\n');
console.log(JSON.stringify({eligible:cases.length,existingCRs:originalCRs.size,trainingCutBit:cut}));
