import {inverseUTF8,prepareStream,inflate,sourceAtBit,sha256,lzw,hexBytes,signed,tokenAt}from './codec.js';
import {DEFAULTS,render,locatePixel,phaseScan,traceBright}from './render.js';
import {encodePNG}from './png.js';
let index,inverse,community,original,model,decoded,frame,currentRecipe,decodeKey='',dictionary=null,custom=null,recipeCache=new Map();
const base=new URL('../',import.meta.url);
async function fetchBytes(path){const r=await fetch(new URL(path,base));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return new Uint8Array(await r.arrayBuffer());}
async function init(){if(index)return;index=JSON.parse(new TextDecoder().decode(await fetchBytes('data/index.json')));[original,community]=await Promise.all([fetchBytes(index.sources.original.path),fetchBytes(index.sources.community.path)]);for(const [name,b]of [['original',original],['community',community]])if(await sha256(b)!==index.sources[name].sha256)throw Error(`${name} source hash mismatch.`);inverse=inverseUTF8(original);model=new Float32Array((await fetchBytes('data/trigram.f32')).buffer);}
const fields=['source','candidate','engine','sourceOffset','sourceLength','sourceBit','historySize','seedHex','historyMode','resetBlocks','maxMiB','distancePolicy','lengthPolicy','rate','seed','editFirst','editLast','contextBytes','editPenalty','patches','lineageThreshold','lineageValue','recipeOverride','lzwMin','lzwMax','lzwMSB','lzwEarly','lzwClear','lzwSource','lzwHex','probeStart','probeLength','inputEncoding','modelKind','modelFirst','modelLast','uniPrior','biPrior','triPrior'];
function rawResult(bytes,label){return {bytes,origins:new Int32Array(bytes.length),fresh:new Uint8Array(bytes.length).fill(1),tokens:null,blocks:[],stream:bytes,error:null,edited:[],codec:label,lineageEdits:0};}
async function build(c,id){
 const key=JSON.stringify(fields.map(k=>c[k]));if(decoded&&key===decodeKey)return;postMessage({type:'progress',id,message:'Preparing source…'});let data=c.source==='community'?community:original;currentRecipe=null;
 if(c.engine==='preset'){
  const candidate=index.candidates.find(v=>v.id===`${c.source}_${c.candidate}`);if(!candidate)throw Error('This candidate belongs to the original input. Select another recipe.');
  if(c.recipeOverride?.trim())currentRecipe=JSON.parse(c.recipeOverride);else{if(!recipeCache.has(candidate.id))recipeCache.set(candidate.id,JSON.parse(new TextDecoder().decode(await fetchBytes(candidate.path))));currentRecipe=recipeCache.get(candidate.id);}
  const prep=prepareStream(inverse,community,index,currentRecipe);postMessage({type:'progress',id,message:'Decoding Huffman tokens…'});
  let activeModel=model,modelTriples=null;if(c.distancePolicy==='context'&&c.modelKind==='local'){const training=inflate(prep,{...c,dictionary,distancePolicy:'keep',lengthPolicy:'keep',lineageThreshold:0});const trained=trainModel(training,c);activeModel=trained.model;modelTriples=trained.triples;}
  decoded=inflate(prep,{...c,dictionary,model:activeModel},p=>postMessage({type:'progress',id,message:`Block ${p.block} · ${p.bytes.toLocaleString()} bytes`}));
  decoded.expected=candidate.sha256;decoded.modelTriples=modelTriples;
 }else if(c.engine==='lzw'){
  if(c.lzwSource==='hypothesis')data=hexBytes(c.lzwHex);
  else if(c.lzwSource==='utf8')data=new TextEncoder().encode(inverse.text.slice(c.probeStart,c.probeStart+c.probeLength));
  else{data=c.source==='community'?community:inverse.bytes;data=data.slice(c.probeStart,c.probeStart+c.probeLength);}
  decoded=lzw(data,{minBits:c.lzwMin,maxBits:c.lzwMax,bitOffset:c.sourceBit,msb:c.lzwMSB,earlyChange:c.lzwEarly,requireClear:c.lzwClear,maxMiB:c.maxMiB});
 }else{
  if(c.engine==='custom'){if(!custom)throw Error('Load a local byte file.');data=custom;}
  else if(c.engine==='inverse'||(c.engine==='deflate'&&c.inputEncoding!=='raw'))data=c.source==='community'?community:inverse.bytes;
  const start=Math.max(0,c.sourceOffset),end=c.sourceLength?Math.min(data.length,start+c.sourceLength):data.length;if(start>=data.length||end<=start)throw Error('Input range is empty.');data=data.slice(start,end);
  decoded=c.engine==='deflate'?inflate({stream:data,parts:null,ambiguities:new Set()},{...c,bitOffset:c.sourceBit,dictionary}):rawResult(data,c.engine);
 }
 decoded.hash=await sha256(decoded.bytes);decodeKey=key;
}
function trainModel(d,c){
 if(!(c.uniPrior>0&&c.biPrior>0&&c.triPrior>0))throw Error('Model priors must be positive.');
 const t=d.tokens,N=21,un=new Float64Array(N).fill(c.uniPrior),bi=new Float64Array(N*N),tri=new Float64Array(N*N*N),good=new Uint8Array(t.n),v=new Int8Array(t.n);let triples=0;
 for(let i=0;i<t.n;i++)if(t.symbol[i]<256&&t.block[i]>=c.modelFirst&&t.block[i]<=c.modelLast){const x=signed(t.symbol[i])+10;if(x<0||x>=N)continue;let ok=true;for(let b=t.bit[i];b<t.end[i];b++){if(d.prepared.ambiguities.has(b)||sourceAtBit(d.prepared,b,inverse,index)?.inserted){ok=false;break;}}if(ok){good[i]=1;v[i]=x;un[x]++;}}
 let total=un.reduce((a,b)=>a+b,0);for(let j=0;j<N;j++)un[j]/=total;
 for(let i=0;i<t.n-1;i++)if(good[i]&&good[i+1])bi[v[i]*N+v[i+1]]++;
 for(let a=0;a<N;a++){let sum=c.biPrior;for(let b=0;b<N;b++)sum+=bi[a*N+b];for(let b=0;b<N;b++)bi[a*N+b]=(bi[a*N+b]+c.biPrior*un[b])/sum;}
 for(let i=0;i<t.n-2;i++)if(good[i]&&good[i+1]&&good[i+2]){tri[(v[i]*N+v[i+1])*N+v[i+2]]++;triples++;}
 for(let a=0;a<N;a++)for(let b=0;b<N;b++){const start=(a*N+b)*N;let sum=c.triPrior;for(let z=0;z<N;z++)sum+=tri[start+z];for(let z=0;z<N;z++)tri[start+z]=Math.log((tri[start+z]+c.triPrior*bi[b*N+z])/sum);}
 return {model:tri,triples};
}
function summary(){return {bytes:decoded.bytes.length,hash:decoded.hash,recipeMatch:decoded.hash===decoded.expected,error:decoded.error,edited:decoded.edited.length,lineageEdits:decoded.lineageEdits||0,modelTriples:decoded.modelTriples??null,codes:decoded.codes?.length,blocks:decoded.blocks.map(b=>({block:b.block,start:b.start,end:b.end,bit:b.bit,endBit:b.endBit,tokens:b.tokens,literals:b.literals,matches:b.matches,synthetic:b.synthetic,source:b.source}))};}
function pixelInfo(x,y){const p=locatePixel(frame,x,y);if(!p)return {padding:true};const values=p.indices.map(i=>decoded.bytes[i]??null),ts=p.indices.map(i=>tokenAt(decoded,i));const t=ts[0],origin=decoded.origins[p.indices[0]],tok=decoded.tokens;
 return {...p,values,signed:values.map(v=>v===null?null:signed(v)),mod4:values.map(v=>v===null?null:((signed(v)%4)+4)%4),mod7:values.map(v=>v===null?null:((signed(v)%7)+7)%7),fresh:p.indices.map(i=>!!decoded.fresh[i]),history:p.indices.map(i=>decoded.origins[i]<0),token:t<0?null:{index:t,symbol:tok.symbol[t],length:tok.length[t],distance:tok.distance[t],outputStart:tok.start[t],bit:tok.bit[t],endBit:tok.end[t],lbit:tok.lbit[t],dbit:tok.dbit[t],lmask:tok.lmask[t],dmask:tok.dmask[t],block:tok.block[t]},source:t<0?null:sourceAtBit(decoded.prepared,tok.bit[t],inverse,index),literalOrigin:origin>=0&&tok?{index:origin,outputStart:tok.start[origin],value:tok.symbol[origin],source:sourceAtBit(decoded.prepared,tok.bit[origin],inverse,index)}:null};}
async function handle({data:m}){const {type,id}=m;try{
 await init();
 if(type==='init'){postMessage({type:'ready',id,index});return;}
 if(type==='load'){if(m.kind==='dictionary')dictionary=new Uint8Array(m.buffer);else custom=new Uint8Array(m.buffer);decoded=null;decodeKey='';postMessage({type:'loaded',id,kind:m.kind,bytes:m.buffer.byteLength});return;}
 if(type==='clearDictionary'){dictionary=null;decoded=null;decodeKey='';postMessage({type:'loaded',id,kind:'dictionary',bytes:0});return;}
 if(type==='run'){
  const c={...DEFAULTS,...m.config},st=performance.now();await build(c,id);postMessage({type:'progress',id,message:'Rendering bytes…'});frame=render(decoded,c);frame.config=c;
  const rgba=frame.rgba.slice();postMessage({type:'frame',id,config:c,width:frame.width,height:frame.height,rgba:rgba.buffer,layout:{...frame.layout,shifts:undefined},stats:frame.stats,decode:summary(),ms:performance.now()-st},[rgba.buffer]);return;
 }
 if(type==='recipe'){if(!currentRecipe)throw Error('Choose a recorded recipe first.');postMessage({type:'recipe',id,recipe:currentRecipe});return;}
 if(type==='inspect'){if(frame&&decoded)postMessage({type:'inspect',id,info:pixelInfo(m.x,m.y)});return;}
 if(type==='scan'){if(!decoded)throw Error('Decode a source first.');postMessage({type:'scan',id,scores:phaseScan(decoded.bytes,m.stride,m.rows,m.origin)});return;}
 if(type==='trace'){if(!frame)throw Error('Render first.');postMessage({type:'trace',id,result:traceBright(frame,m.options)});return;}
 if(type==='export'){
  if(!decoded)throw Error('Decode a source first.');let data,mime='application/octet-stream',name;
  const stem=`saf_${m.config.source}_${m.config.candidate}`;
  if(m.kind==='png'||m.kind==='png-native'){data=await encodePNG(frame,m.kind==='png'?m.config.repeat:1,{version:1,settings:m.config,source:index.sources[m.config.source],payloadSHA256:decoded.hash,decode:summary()});mime='image/png';name=`${stem}_${m.config.mode}${m.kind==='png'?'_rows'+m.config.repeat:''}.png`;}
  else if(m.kind==='decoded'){data=decoded.bytes.slice();name=stem+'.bin';}
  else if(m.kind==='deflate'){data=decoded.stream.slice();name=stem+(m.config.engine==='lzw'?'.lzw':'.deflate');}
  else if(m.kind==='source'){data=(m.config.source==='community'?community:original).slice();name=m.config.source==='community'?'community.bin':'saf_dat_col.utf8.bin';}
  else if(m.kind==='edits'){data=new TextEncoder().encode(JSON.stringify({settings:m.config,source:index.sources[m.config.source],recordedRecipe:currentRecipe,extraFieldEdits:decoded.edited},null,2));name=stem+'_repairs.json';mime='application/json';}
  else if(m.kind==='tokens'){const t=decoded.tokens;if(!t)throw Error('Token table is available for DEFLATE.');const lines=['token,block,output_start,length,distance,symbol,stream_bit,stream_end_bit,inverse_byte,uploaded_utf8_byte'];for(let i=0;i<t.n;i++){const s=sourceAtBit(decoded.prepared,t.bit[i],inverse,index);lines.push([i,t.block[i],t.start[i],t.length[i],t.distance[i],t.symbol[i],t.bit[i],t.end[i],s?.inverseByte??'',s?.uploadedByte??''].join(','));}data=new TextEncoder().encode(lines.join('\n'));name=stem+'_tokens.csv';mime='text/csv';}
  else if(m.kind==='rgba'){data=frame.rgba.slice();name=stem+'.rgba';}
  else if(m.kind==='recipe'){data=new TextEncoder().encode(JSON.stringify(currentRecipe,null,2));name=stem+'_recipe.json';mime='application/json';}
  else throw Error('Unknown export.');
  postMessage({type:'download',id,data:data.buffer,mime,name},[data.buffer]);return;
 }
}catch(e){postMessage({type:'error',id,error:e.message,stack:e.stack});}}
let messageQueue=Promise.resolve();
self.onmessage=event=>{messageQueue=messageQueue.then(()=>handle(event));};
