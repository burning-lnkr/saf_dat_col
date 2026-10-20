// Exact numerical renderings of decoded bytes. No generated or inferred imagery.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {render} from '../../../js/render.js';
import {encodePNG} from '../../../js/png.js';

const ROOT=path.resolve(import.meta.dirname,'../../..'),HERE=import.meta.dirname;
const CACHE=path.join(ROOT,'research/2026-10-20/cache/visuals');fs.mkdirSync(CACHE,{recursive:true});
const root='research/2026-10-20/cache/';
const cases=[
 {key:'baseline',title:'Baseline',detail:'Original Header-guided recipe; nominal zero history',folder:root+'baseline',native:true},
 {key:'length_16',title:'Length alternative 16',detail:'One NUL/space choice; length 12 to 11; output -1 byte',folder:root+'source_search/candidate_16'},
 {key:'symbol_1',title:'Symbol alternative 1',detail:'Exploratory bit 10062; 16 tokens become 18; output +21 bytes',folder:root+'source_search/candidate_1',native:true},
 {key:'cr_1244',title:'CR alternative 1244',detail:'Inserted CR 22964 to 22957; output +2 bytes',folder:root+'cr_search/candidate_1244',native:true},
 {key:'cr_425',title:'CR alternative 425',detail:'Inserted CR 9624 to 9618; output -68 bytes',folder:root+'cr_search/candidate_425'}
];
const views=[
 {key:'magnitude_classes',title:'Magnitude classes',settings:{filter:'off',mode:'classifier',magnitudeA:7,magnitudeB:4,valueA:255,valueB:60,valueOther:0}},
 {key:'raw_rgb',title:'Bytes treated as RGB',settings:{filter:'off',mode:'rawrgb'}},
 {key:'sub_rgb',title:'RGB after fixed Sub inverse',settings:{filter:'1',mode:'rawrgb'}},
 {key:'paeth_rgb',title:'RGB after fixed Paeth inverse',settings:{filter:'4',mode:'rawrgb'}}
];
const config={width:5000,channels:3,sample:'u8',arrangement:'interleaved',stride:15001,prefix:1,offset:0,startRow:0,rows:785,
  tail:'drop',filterSeed:'00',filterReset:0,filterOverrides:'',filterBpp:3,selection:'all',repeat:1,smoothX:1,smoothY:1};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest={scope:'Provisional interpretations of the supplied damaged capture; no verified original image or recognizable recovery is asserted.',
  geometry:'Unverified width5000/RGB8/stride15001/prefix1 hypothesis; rows785. Every case uses identical settings. Unknown initial-history bytes are zero-filled for display.',
  preview:'Overview uses area averaging at preserved aspect before repeating preview rows four times. A separate fixed crop retains native pixels. Native PNGs contain unscaled pixels.',
  config,views,cases:[]};
for(const c of cases){
 const folder=path.join(ROOT,c.folder),bytes=new Uint8Array(fs.readFileSync(path.join(folder,'bytes.bin')));
 const ob=fs.readFileSync(path.join(folder,'origins.bin')),origins=new Int32Array(ob.buffer.slice(ob.byteOffset,ob.byteOffset+ob.byteLength));
 const d={bytes,origins,fresh:new Uint8Array(bytes.length)},record={...c,outputBytes:bytes.length,outputSha256:hash(bytes),images:[]};
 for(const view of views){
  const frame=render(d,{...config,...view.settings});
  const png=await encodePNG(frame,1,{candidate:c.key,description:c.detail,provisional:true,outputSha256:record.outputSha256,config:frame.config});
  const name=c.key+'_'+view.key+'.png',cachePath=path.join(CACHE,name);fs.writeFileSync(cachePath,png);
  let published=null;
  if((c.native&&view.key==='sub_rgb')||(c.key==='baseline'&&view.key==='magnitude_classes')){
    published=path.join(HERE,name);fs.writeFileSync(published,png);
  }
  record.images.push({view:view.key,width:frame.width,height:frame.height,cache:path.relative(ROOT,cachePath),
    published:published?path.relative(ROOT,published):null,cacheSha256:hash(png),cacheBytes:png.length});
 }
 manifest.cases.push(record);console.log(JSON.stringify({rendered:c.key,outputBytes:bytes.length}));
}
fs.writeFileSync(path.join(HERE,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
