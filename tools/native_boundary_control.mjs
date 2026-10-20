// Recompress unchanged actual bytes; expose native token-selection masks.
import fs from 'node:fs'; import zlib from 'node:zlib'; import {inflate} from '../js/codec.js';
const base=new URL('../cache/format-neutral/',import.meta.url);
const b=fs.readFileSync(new URL('headerguided.bin',base));
const reports=[];
for(const level of [6,9]) {
 const stream=zlib.deflateRawSync(b,{level,strategy:zlib.constants.Z_FILTERED});
 const d=inflate({stream:new Uint8Array(stream)});
 if(d.error || !Buffer.from(d.bytes).equals(b)) throw Error('Native control replay failed');
 fs.writeFileSync(new URL(`native${level}.fresh.u8`,base),d.fresh);
 reports.push({level,input_bytes:b.length,compressed_bytes:stream.length,tokens:d.tokens.n,literals:d.blocks.reduce((s,v)=>s+v.literals,0),exact:true});
}
fs.writeFileSync(new URL('native_selection.json',base),JSON.stringify(reports,null,2)+'\n');
console.log(reports);
