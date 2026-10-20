import fs from 'node:fs';
import {inverseUTF8,prepareStream,inflate} from '../js/codec.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const inv=inverseUTF8(read('data/saf_dat_col.utf8.bin'));
const prep=prepareStream(inv,new Uint8Array(read('data/community.bin')),JSON.parse(read('data/index.json')),JSON.parse(read('data/original_headerguided.json')));
const dec=inflate(prep);if(dec.error)throw Error(dec.error);
const x=dec.bytes,N=x.length,results=[];
for(let width=4800;width<=5200;width++){
 const stride=width*3+1,rows=Math.floor(N/stride),mid=Math.floor(rows/2);if(rows<300)continue;
 let best={train:-1,phase:0,test:0};
 for(let phase=0;phase<stride;phase+=3){
  let train=0,test=0;for(let r=0;r<rows;r++){const legal=x[phase+r*stride]<=4;if(legal){if(r<mid)train++;else test++;}}
  if(train>best.train)best={train,phase,test};
 }
 results.push({width,stride,rows,phase:best.phase,train_fraction:best.train/mid,test_fraction:best.test/(rows-mid)});
}
results.sort((a,b)=>b.test_fraction-a.test_fraction);
const fraction=b=>b.reduce((s,v)=>s+(v<=4),0)/b.length;
const report={method:'Candidate PNG RGB8 row marker test; choose phase on first half, evaluate held-out second half; phase sampled in increments of three; baseline decoded bytes unverified.',top20:results.slice(0,20),at5000:results.find(r=>r.width===5000),global_legal_byte_fraction:fraction(x),first_half_legal_byte_fraction:fraction(x.subarray(0,Math.floor(N/2))),second_half_legal_byte_fraction:fraction(x.subarray(Math.floor(N/2)))};
console.log(JSON.stringify(report,null,2));
