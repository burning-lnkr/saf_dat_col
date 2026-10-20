import fs from 'node:fs';
import {inverseUTF8,prepareStream,inflate} from '../js/codec.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const inv=inverseUTF8(read('data/saf_dat_col.utf8.bin'));
const prep=prepareStream(inv,new Uint8Array(read('data/community.bin')),JSON.parse(read('data/index.json')),JSON.parse(read('data/original_headerguided.json')));
const dec=inflate(prep);if(dec.error)throw Error(dec.error);
const x=dec.bytes,N=x.length;
const modes=[{name:'byte',width:1},{name:'triple',width:3},{name:'word16',width:2}];
const blockRanges=dec.blocks.map((b,i)=>({i,start:b.outStart??b.outputStart??b.out_start,end:b.outEnd??b.outputEnd??b.out_end}));
function stats(lo,hi){
 const counts=new Uint32Array(256);let n=0,sum=0,sum2=0,eq3=0,eq1=0;
 for(let i=lo;i<hi;i++){const v=x[i];counts[v]++;sum+=v;sum2+=v*v;n++;if(i>=lo+3&&x[i]===x[i-3])eq3++;if(i>lo&&x[i]===x[i-1])eq1++;}
 let entropy=0;for(const c of counts)if(c){const p=c/n;entropy-=p*Math.log2(p);}
 const top=[...counts].map((count,value)=>({value,count})).sort((a,b)=>b.count-a.count).slice(0,8);
 return {lo,hi,n,entropy,top,eq1: eq1/Math.max(1,n-1),eq3:eq3/Math.max(1,n-3),zero:counts[0]/n,plus4:counts[4]/n,minus4:counts[252]/n,plus7:counts[7]/n,minus7:counts[249]/n};
}
const chunks=[];const size=65536;for(let lo=0;lo<N;lo+=size)chunks.push(stats(lo,Math.min(lo+size,N)));
const out={description:'Format-agnostic 64KiB decoded-byte windows: byte histogram entropy, repetition and exact value frequencies. No PNG filters, widths, channels, or raster layout assumed.',N,size,chunks};
console.log(JSON.stringify(out));
