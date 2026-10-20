/** Portable, repository-relative readers for the frozen baseline export. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
export const HERE=fileURLToPath(new URL('./',import.meta.url));
export const CACHE=path.join(ROOT,'research/2026-10-20/cache/baseline');
export const TOKEN_TYPES={start:Uint32Array,bit:Uint32Array,end:Uint32Array,lbit:Uint32Array,dbit:Uint32Array,symbol:Uint16Array,length:Uint16Array,distance:Uint16Array,lmask:Uint16Array,dmask:Uint16Array,dsym:Uint8Array,block:Uint16Array};
const little=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
export function readTyped(file,T){
 const b=fs.readFileSync(file);if(b.length%T.BYTES_PER_ELEMENT)throw Error(`Misaligned array ${file}`);
 const a=new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 if(!little&&T.BYTES_PER_ELEMENT>1){const v=new DataView(b.buffer,b.byteOffset,b.byteLength),method=T===Int32Array?'getInt32':T===Uint32Array?'getUint32':'getUint16';for(let i=0;i<a.length;i++)a[i]=v[method](i*T.BYTES_PER_ELEMENT,true);}
 return a;
}
export function writeTyped(file,a){
 if(little||a.BYTES_PER_ELEMENT===1){fs.writeFileSync(file,Buffer.from(a.buffer,a.byteOffset,a.byteLength));return;}
 const b=Buffer.alloc(a.byteLength),method=a instanceof Int32Array?'writeInt32LE':a instanceof Uint32Array?'writeUInt32LE':'writeUInt16LE';for(let i=0;i<a.length;i++)b[method](a[i],i*a.BYTES_PER_ELEMENT);fs.writeFileSync(file,b);
}
export function loadBaseline({cache=CACHE,sourceMaps=true,payload=true}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(cache,'manifest.json')));
 const tokens={};for(const[k,T]of Object.entries(TOKEN_TYPES))tokens[k]=readTyped(path.join(cache,`token_${k}.bin`),T);tokens.n=tokens.start.length;
 const data={cache,manifest,tokens,stream:readTyped(path.join(cache,'stream.bin'),Uint8Array),bits:manifest.streamBits,blocks:JSON.parse(fs.readFileSync(path.join(cache,'blocks.json'))),ambiguities:new Set(readTyped(path.join(cache,'ambiguities.u32'),Uint32Array))};
 if(payload)for(const[k,T]of [['bytes',Uint8Array],['origins',Int32Array],['tags',Int32Array],['fresh',Uint8Array]])data[k]=readTyped(path.join(cache,k+'.bin'),T);
 if(sourceMaps){
  data.inverse={bytes:readTyped(path.join(cache,'inverse.bin'),Uint8Array),offsets:readTyped(path.join(cache,'inverse_offsets.u32'),Uint32Array),unmapped:readTyped(path.join(cache,'inverse_unmapped.u8'),Uint8Array)};
  data.index=JSON.parse(fs.readFileSync(path.join(ROOT,'data/index.json')));
  data.parts=JSON.parse(fs.readFileSync(path.join(cache,'parts.json'))).map(p=>({...p,map:readTyped(path.join(cache,p.files.map),Int32Array),prep:readTyped(path.join(cache,p.files.prep),Uint32Array),rawPrepared:readTyped(path.join(cache,p.files.rawPrepared),Uint8Array),rawMap:readTyped(path.join(cache,p.files.rawMap),Int32Array),preparedBytes:readTyped(path.join(cache,p.files.preparedBytes),Uint8Array),preparedFlags:readTyped(path.join(cache,p.files.preparedFlags),Uint8Array)}));
 }
 return data;
}
export function sourceAtStreamBit(data,bit){
 const part=data.parts.find(p=>bit>=p.start&&bit<p.end);if(!part)return null;
 if(bit>=part.sourceEnd)return {block:part.block,streamBit:bit,synthetic:true};
 const localBit=bit-part.start+part.headerBit,j=localBit>>>3,m=part.map[j],inverseByte=m<0?-m-1:m,preparedByte=part.prep[j];
 let communityByte=null;for(const[a,b,c]of data.index.communityMap)if(inverseByte>=a&&inverseByte<b){communityByte=c+inverseByte-a;break;}
 return {block:part.block,streamBit:bit,synthetic:false,preparedStreamByte:j,preparedByte,bit:localBit&7,inverseByte,uploadedByte:data.inverse.offsets[inverseByte],communityByte,inserted:m<0,flags:part.preparedFlags[j],unmappedInverse:Boolean(data.inverse.unmapped[inverseByte]),observedInverseValue:data.inverse.bytes[inverseByte],rawPreparedValue:part.rawPrepared[preparedByte],preparedValue:part.preparedBytes[j]};
}
