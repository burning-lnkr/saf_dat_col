/* Run with Node 20+ from any working directory: node tests/core.test.mjs */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {inverseUTF8,prepareStream,inflate,sha256,sha256Pure,lzw,hexBytes} from '../js/codec.js';
import {DEFAULTS,render,locatePixel,phaseScan} from '../js/render.js';
import {encodePNG} from '../js/png.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const index=JSON.parse(read('data/index.json')),original=new Uint8Array(read('data/saf_dat_col.utf8.bin')),community=new Uint8Array(read('data/community.bin')),inv=inverseUTF8(original),fixtures=JSON.parse(read('tests/fixtures.json'));
const report={sources:{},candidateChecks:[],pixelChecks:[],syntheticChecks:[]};
for(const [k,b]of [['original',original],['community',community]]){assert.equal(await sha256(b),index.sources[k].sha256);assert.equal(sha256Pure(b),index.sources[k].sha256);report.sources[k]={bytes:b.length,sha256:index.sources[k].sha256};}
assert.equal(inv.bytes.length,1265969);assert.equal(inv.unmapped,1987);
for(const c of index.candidates){
 const recipe=JSON.parse(read(c.path)),prepared=prepareStream(inv,community,index,recipe),d=inflate(prepared);
 assert.equal(d.error,null,c.id);assert.equal(d.bytes.length,c.bytes);assert.equal(await sha256(d.bytes),c.sha256,c.id);
 assert.deepEqual(new Uint8Array(zlib.inflateRawSync(d.stream,{dictionary:Buffer.alloc(32768)})),d.bytes,c.id+' independent zlib');
 assert.equal(d.blocks.length,20);const result={id:c.id,bytes:d.bytes.length,payloadSHA256:c.sha256,standardZlib:true};report.candidateChecks.push(result);
 const g=fixtures.find(f=>f.candidate===c.id);if(g){const image=render(d,DEFAULTS);assert.equal(image.width,g.width);assert.equal(image.height,g.height);assert.equal(await sha256(image.rgba),g.rgbaSHA256);report.pixelChecks.push({id:c.id,rgbaSHA256:g.rgbaSHA256});
  if(c.id==='original_combined'){
   const cr=render(d,{...DEFAULTS,startRow:12,rows:7});assert.deepEqual(cr.rgba,image.rgba.slice(12*5000*4,19*5000*4));
   const loc=locatePixel(cr,25,1);assert.deepEqual(loc.indices,[13*15001+1+25*3,13*15001+2+25*3,13*15001+3+25*3]);
   const phases=phaseScan(d.bytes,15001,246);assert.equal(phases[0].bad,64);
   const png=await encodePNG(cr,3,{test:'three repeated rows'});let p=8,idat=[],w,h;while(p<png.length){const dv=new DataView(png.buffer,p),n=dv.getUint32(0),type=String.fromCharCode(...png.slice(p+4,p+8));if(type==='IHDR'){w=dv.getUint32(8);h=dv.getUint32(12);}if(type==='IDAT')idat.push(png.slice(p+8,p+8+n));p+=12+n;}assert.equal(w,5000);assert.equal(h,21);const rows=zlib.inflateSync(Buffer.concat(idat));for(let y=0;y<21;y++){assert.equal(rows[y*(w*4+1)],0);assert.deepEqual(new Uint8Array(rows.subarray(y*(w*4+1)+1,(y+1)*(w*4+1))),new Uint8Array(cr.rgba.slice(Math.floor(y/3)*w*4,(Math.floor(y/3)+1)*w*4)));}
   report.syntheticChecks.push('PNG export: repeated RGBA rows and standard-zlib IDAT');
  }
 }
 console.log('PASS',c.id);
}
for(const opts of [{level:0},{level:6,strategy:zlib.constants.Z_FIXED},{level:6},{level:9}]){
 const input=Buffer.concat([Buffer.from('fixed, dynamic and stored Huffman tests.\n'.repeat(15000)),crypto.randomBytes(8000)]),stream=new Uint8Array(zlib.deflateRawSync(input,opts)),d=inflate({stream},{historySize:0});assert.equal(d.error,null);assert.deepEqual(d.bytes,new Uint8Array(input));report.syntheticChecks.push('DEFLATE '+JSON.stringify(opts));
}
const seed=crypto.randomBytes(32768),input=Buffer.concat([seed.subarray(20000,22000),Buffer.from('abc'.repeat(500))]),stream=new Uint8Array(zlib.deflateRawSync(input,{dictionary:seed})),seeded=inflate({stream},{dictionary:seed});assert.equal(seeded.error,null);assert.deepEqual(seeded.bytes,new Uint8Array(input));report.syntheticChecks.push('Preset dictionary, including overlapping copies');
const l=lzw(hexBytes(DEFAULTS.lzwHex),{minBits:8});assert.equal(l.bytes.length,68);assert.equal(l.codes.length,16);assert.ok([...l.bytes].every(x=>x===0||x===1));report.syntheticChecks.push('Conditional LZW prefix: 16 codes / 68 indices');
// Five reversible byte predictors, also cropped after reconstructing prior rows.
function paeth(a,b,c){const q=a+b-c;return Math.abs(q-a)<=Math.abs(q-b)&&Math.abs(q-a)<=Math.abs(q-c)?a:Math.abs(q-b)<=Math.abs(q-c)?b:c;}
const width=11,height=9,C=3,N=width*C,raw=crypto.randomBytes(N*height);
for(let ft=0;ft<=4;ft++){
 const filtered=new Uint8Array((N+1)*height);for(let y=0;y<height;y++){filtered[y*(N+1)]=ft;for(let x=0;x<N;x++){const v=raw[y*N+x],a=x>=C?raw[y*N+x-C]:0,b=y?raw[(y-1)*N+x]:0,c=y&&x>=C?raw[(y-1)*N+x-C]:0;filtered[y*(N+1)+1+x]=(v-(ft===0?0:ft===1?a:ft===2?b:ft===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}}
 const decoded={bytes:filtered,fresh:new Uint8Array(filtered.length).fill(1),origins:new Int32Array(filtered.length)};
 const im=render(decoded,{...DEFAULTS,width,stride:N+1,rows:height,filter:'stored',mode:'rawrgb',invalidFilter:'stop'});for(let i=0;i<width*height;i++)assert.deepEqual(Array.from(im.rgba.slice(i*4,i*4+3)),Array.from(raw.slice(i*3,i*3+3)));
 const crop=render(decoded,{...DEFAULTS,width,stride:N+1,startRow:3,rows:3,filter:'stored',mode:'rawrgb',invalidFilter:'stop'});assert.deepEqual(crop.rgba,im.rgba.slice(3*width*4,6*width*4));report.syntheticChecks.push('PNG filter '+ft+' and prior-row crop');
}
// Context search is actually executed, not just a preset selector.
{const prep=prepareStream(inv,community,index,JSON.parse(read('data/original_headerguided.json'))),mb=read('data/trigram.f32'),model=new Float32Array(mb.buffer.slice(mb.byteOffset,mb.byteOffset+mb.byteLength)),live=inflate(prep,{model,distancePolicy:'context',contextBytes:12,editPenalty:.2,editFirst:1,editLast:11});assert.equal(live.edited.length,1005);assert.equal(await sha256(live.bytes),index.candidates.find(c=>c.id==='original_copy_context').sha256);report.syntheticChecks.push('Live copy-context search reproduces v5 A: 1,005 distance edits');}
for(const sample of ['u16le','u16be','p1','p2','p4']){const bytes=Uint8Array.from([0,1,2,3,4,5,6,7,8,9,10,11]),d={bytes,fresh:new Uint8Array(12).fill(1),origins:new Int32Array(12)},im=render(d,{...DEFAULTS,width:3,channels:1,channelMap:'0',prefix:0,stride:6,sample,mode:'rawgray'});assert.equal(im.width,3);assert.equal(im.height,2);report.syntheticChecks.push('Sample layout '+sample);}
report.passed=true;fs.writeFileSync(new URL('./validation.json',import.meta.url),JSON.stringify(report,null,2));console.log('ALL TESTS PASSED');
