/* Byte-level source preparation and DEFLATE/LZW decoders.
 * No image assets or decoded payloads are used. All offsets are zero-based;
 * DEFLATE bit positions are least-significant-bit first. */
export const LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
export const LE=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
export const DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
export const DE=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const ORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
export const signed=b=>b<128?b:b-256;
export const mod=(a,n)=>((a%n)+n)%n;
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function hexBytes(s){const t=String(s||'').replace(/0x/gi,'').replace(/[\s,:_-]/g,'');if(t.length%2||/[^0-9a-f]/i.test(t))throw Error('Use complete hexadecimal bytes.');return Uint8Array.from(t.match(/../g)||[],x=>parseInt(x,16));}
export function sha256Pure(bytes){
 const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
 const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),W=new Uint32Array(64),n=Math.ceil((bytes.length+9)/64)*64,B=new Uint8Array(n);B.set(bytes);B[bytes.length]=128;const dv=new DataView(B.buffer);dv.setUint32(n-8,Math.floor(bytes.length/0x20000000));dv.setUint32(n-4,(bytes.length*8)>>>0);
 const rr=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let pos=0;pos<n;pos+=64){for(let j=0;j<16;j++)W[j]=dv.getUint32(pos+j*4);for(let j=16;j<64;j++){const a=W[j-15],b=W[j-2],s0=rr(a,7)^rr(a,18)^(a>>>3),s1=rr(b,17)^rr(b,19)^(b>>>10);W[j]=(W[j-16]+s0+W[j-7]+s1)>>>0;}let [a,b,c,d,e,f,g,h]=H;
 for(let j=0;j<64;j++){const s1=rr(e,6)^rr(e,11)^rr(e,25),ch=(e&f)^(~e&g),t1=(h+s1+ch+K[j]+W[j])>>>0,s0=rr(a,2)^rr(a,13)^rr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}const v=[a,b,c,d,e,f,g,h];for(let j=0;j<8;j++)H[j]=(H[j]+v[j])>>>0;
 }return Array.from(H,x=>x.toString(16).padStart(8,'0')).join('');
}
export async function sha256(bytes){if(!globalThis.crypto?.subtle)return sha256Pure(bytes);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function inverseUTF8(raw){
 const text=new TextDecoder('utf-8',{fatal:true}).decode(raw),a=new Uint8Array(text.length),offsets=new Uint32Array(text.length);
 const cp=new Map();const specials=[0x20ac,0x81,0x201a,0x192,0x201e,0x2026,0x2020,0x2021,0x2c6,0x2030,0x160,0x2039,0x152,0x8d,0x17d,0x8f,0x90,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x2dc,0x2122,0x161,0x203a,0x153,0x9d,0x17e,0x178];specials.forEach((u,i)=>cp.set(String.fromCodePoint(u),128+i));
 let j=0,p=raw[0]===239&&raw[1]===187&&raw[2]===191?3:0,unmapped=0;
 for(const c of text){const u=c.codePointAt(0);let v=cp.get(c);if(v===undefined)v=u<=255?u:63;if(v===63&&u!==63)unmapped++;a[j]=v;offsets[j++]=p;p+=u<128?1:u<2048?2:u<65536?3:4;}
 if(p!==raw.length)throw Error('UTF-8 coordinate mismatch.');
 return {bytes:a.slice(0,j),offsets:offsets.slice(0,j),text,unmapped};
}
function reverse(v,n){let r=0;while(n--){r=(r<<1)|(v&1);v>>>=1;}return r;}
export function huffman(lengths,allowEmpty=false){
 const max=Math.max(...lengths);if(!max){if(allowEmpty)return {max:1,table:new Int32Array(2),codes:[]};throw Error('Empty Huffman tree.');}
 if(max>15)throw Error('Huffman length exceeds 15.');const count=new Uint16Array(max+1),next=new Uint32Array(max+1);for(const n of lengths)if(n)count[n]++;
 let code=0;for(let n=1;n<=max;n++){code=(code+(count[n-1]||0))*2;next[n]=code;if(code+count[n]>2**n)throw Error('Oversubscribed Huffman tree.');}
 if(code+count[max]<2**max&&!(max===1&&count[1]===1))throw Error('Incomplete Huffman tree.');
 const table=new Int32Array(1<<max),codes=[];for(let s=0;s<lengths.length;s++){const n=lengths[s];if(!n)continue;const rev=reverse(next[n]++,n);codes[s]=[rev,n];for(let k=rev;k<table.length;k+=1<<n)table[k]=((s+1)<<5)|n;}
 return {table,max,codes,lengths};
}
export class Bits{
 constructor(bytes,pos=0,end=bytes.length*8){this.bytes=bytes;this.pos=pos;this.end=end;}
 peek(n){const i=this.pos>>>3,s=this.pos&7,b=this.bytes;return (((b[i]||0)|((b[i+1]||0)<<8)|((b[i+2]||0)<<16)|((b[i+3]||0)<<24))>>>s)&((1<<n)-1);}
 read(n){if(this.pos+n>this.end)throw Error('End of captured bits.');const x=this.peek(n);this.pos+=n;return x;}
 sym(h){const z=h.table[this.peek(h.max)];if(!z)throw Error('Invalid Huffman code.');this.read(z&31);return (z>>>5)-1;}
}
export function readHeader(r){
 const start=r.pos,final=r.read(1),type=r.read(2);if(type===3)throw Error('Reserved DEFLATE block type.');
 if(type===0){r.pos=(r.pos+7)&~7;const len=r.read(16),nlen=r.read(16);if((len^65535)!==nlen)throw Error('Stored-block length mismatch.');return {start,final,type,len,body:r.pos};}
 let ll,dd;if(type===1){ll=Array.from({length:288},(_,i)=>i<=143?8:i<=255?9:i<=279?7:8);dd=Array(32).fill(5);}
 else{const nl=r.read(5)+257,nd=r.read(5)+1,nc=r.read(4)+4,cl=Array(19).fill(0);if(nl>286)throw Error('Invalid literal alphabet size.');for(let j=0;j<nc;j++)cl[ORDER[j]]=r.read(3);const ct=huffman(cl),lens=[];
 while(lens.length<nl+nd){const x=r.sym(ct);if(x<16)lens.push(x);else{if(x===16&&!lens.length)throw Error('Length repeat without predecessor.');const n=x===16?3+r.read(2):x===17?3+r.read(3):11+r.read(7),v=x===16?lens[lens.length-1]:0;for(let i=0;i<n;i++)lens.push(v);}}
 if(lens.length!==nl+nd)throw Error('Code-length repeat overrun.');ll=lens.slice(0,nl);dd=lens.slice(nl);if(!ll[256])throw Error('Missing end code.');}
 return {start,final,type,ll,dd,lt:huffman(ll),dt:huffman(dd,true),body:r.pos};
}
export class BitWriter{
 constructor(cap=1500000){this.bytes=new Uint8Array(cap);this.pos=0;}
 ensure(n){if(n<=this.bytes.length*8)return;const b=new Uint8Array(Math.max(Math.ceil(n/8)+16,this.bytes.length*2));b.set(this.bytes);this.bytes=b;}
 put(v,n){this.ensure(this.pos+n);for(let j=0;j<n;j++,this.pos++)if((v>>>j)&1)this.bytes[this.pos>>>3]|=1<<(this.pos&7);}
 slice(bytes,start,end){this.ensure(this.pos+end-start);for(let p=start;p<end;){const n=Math.min(16,end-p),i=p>>>3,x=(((bytes[i]||0)|((bytes[i+1]||0)<<8)|((bytes[i+2]||0)<<16))>>>(p&7))&((1<<n)-1);this.put(x,n);p+=n;}}
 finish(){return this.bytes.slice(0,Math.ceil(this.pos/8));}
}
export function communityToInverse(p,mapping){for(const [a,b,c,d]of mapping)if(p>=c&&p<d)return a+p-c;return -1;}
export function inverseToCommunity(p,mapping){for(const [a,b,c,d]of mapping)if(p>=a&&p<b)return c+p-a;throw Error(`Inverse byte ${p} is outside the community capture.`);}
export function prepareStream(inverse,community,index,recipe){
 const bw=new BitWriter(),parts=[],ambiguities=[];const hs=recipe.headers||index.headers;
 if(!Array.isArray(recipe.blocks)||recipe.blocks.length!==hs.length)throw Error('Recipe block/header count mismatch.');
 if(hs.length>1000)throw Error('Too many recipe blocks.');
 for(let i=0;i<hs.length;i++){
  const h=hs[i],st=h.byte,en=i+1<hs.length?hs[i+1].byte+1:recipe.lastEnd,e=recipe.blocks[i];
  if(!(st>=0&&en>st&&en<=inverse.bytes.length))throw Error(`Block ${i+1}: invalid source range.`);
  let b,mp;
  if(recipe.source==='community'){const a=inverseToCommunity(st,index.communityMap),z=inverseToCommunity(en-1,index.communityMap)+1;b=Array.from(community.subarray(a,z),x=>x===0?32:x);mp=Array.from({length:z-a},(_,j)=>communityToInverse(a+j,index.communityMap));}
  else{b=Array.from(inverse.bytes.subarray(st,en));mp=Array.from({length:en-st},(_,j)=>st+j);}
  for(const [p,from,to]of h.patches||[]){if(b[p]!==from)throw Error(`Block ${i+1}: header patch mismatch at ${p}.`);b[p]=to;}
  if(h.insert!==null&&h.insert!==undefined){b.splice(h.insert,0,13);mp.splice(h.insert,0,-st-h.insert-1);}
  if(recipe.source!=='community'){const bb=[],mm=[];for(let j=0;j<b.length;j++){if(!(recipe.removals||[]).some(([a,z])=>mp[j]>=a&&mp[j]<z)){bb.push(b[j]);mm.push(mp[j]);}}b=bb;mp=mm;}
  const zs=new Set(e.nul),crs=new Set(e.cr);for(const p of [...zs,...crs])if(!Number.isInteger(p)||p<0||p>=b.length)throw Error(`Block ${i+1}: repair index out of range.`);
  const buf=new Uint8Array(b.length+crs.size),map=new Int32Array(buf.length),prep=new Uint32Array(buf.length);let k=0;
  const ambiguousLocal=[];
  for(let j=0;j<b.length;j++){if(crs.has(j)){buf[k]=13;map[k]=-Math.abs(mp[j])-1;prep[k++]=j;}let v=b[j];if(zs.has(j)){if(v!==32)throw Error(`Block ${i+1}: byte ${j} is not a space.`);v=0;}buf[k]=v;map[k]=mp[j];prep[k]=j;if(b[j]===32)ambiguousLocal.push(k);k++;}
  const end=e.end+8*[...crs].filter(p=>p*8<e.end).length;if(end>buf.length*8||end<=h.bit)throw Error(`Block ${i+1}: invalid end bit.`);
  const header=readHeader(new Bits(buf,h.bit,end)),begin=bw.pos;
  bw.slice(buf,h.bit,end);if(!e.eob){const [c,n]=header.lt.codes[256];bw.put(c,n);}
  for(const j of ambiguousLocal){const p=begin+j*8+5-h.bit;if(p>=begin+header.body-h.bit&&p<begin+end-h.bit)ambiguities.push(p);}
  parts.push({block:i+1,start:begin,end:bw.pos,sourceEnd:begin+end-h.bit,headerBit:h.bit,map,prep,synthetic:!e.eob,originalStart:st,headerBytes:buf.slice(0,Math.ceil(header.body/8))});
 }
 const stream=bw.finish();for(let i=0;i<parts.length;i++){const p=parts[i].start;stream[p>>>3]=(stream[p>>>3]&~(1<<(p&7)))|((i===parts.length-1?1:0)<<(p&7));}
 for(const p of recipe.xor||[]){if(!Number.isInteger(p)||p<0||p>=bw.pos)throw Error('Recipe XOR bit outside stream.');stream[p>>>3]^=1<<(p&7);}
 return {stream,parts,bits:bw.pos,ambiguities:new Set(ambiguities),recipe};
}
export function sourceAtBit(prepared,bit,inverse,index){
 if(!prepared?.parts)return null;
 const part=prepared.parts.find(p=>bit>=p.start&&bit<p.end);if(!part)return null;
 if(bit>=part.sourceEnd)return {block:part.block,synthetic:true,streamBit:bit};
 const q=bit-part.start+part.headerBit,j=q>>>3,m=part.map[j],inv=m<0?-m-1:m;
 let comm=null;try{comm=inverseToCommunity(inv,index.communityMap);}catch{}
 return {block:part.block,streamBit:bit,inverseByte:inv,uploadedByte:inverse.offsets[inv],communityByte:comm,bit:q&7,inserted:m<0,preparedByte:part.prep[j]};
}
export function patchStream(stream,text){
 if(!text?.trim())return 0;const e=typeof text==='string'?JSON.parse(text):text;let count=0;
 for(const p of e.xorBits||[]){if(!Number.isInteger(p)||p<0||p>=stream.length*8)throw Error('XOR bit outside stream.');stream[p>>>3]^=1<<(p&7);count++;}
 for(const [p,v]of e.setBytes||[]){if(!Number.isInteger(p)||p<0||p>=stream.length||!Number.isInteger(v)||v<0||v>255)throw Error('Byte patch out of range.');stream[p]=v;count++;}return count;
}
const TK={start:Uint32Array,bit:Uint32Array,end:Uint32Array,lbit:Uint32Array,dbit:Uint32Array,symbol:Uint16Array,length:Uint16Array,distance:Uint16Array,lmask:Uint16Array,dmask:Uint16Array,dsym:Uint8Array,block:Uint16Array};
class TokenStore{
 constructor(cap=700000){this.cap=cap;this.n=0;for(const [k,T]of Object.entries(TK))this[k]=new T(cap);}
 add(v){if(this.n>=this.cap){this.cap*=2;for(const [k,T]of Object.entries(TK)){const b=new T(this.cap);b.set(this[k]);this[k]=b;}}const j=this.n++;for(const k of Object.keys(TK))this[k][j]=v[k]||0;return j;}
 finish(){const o={n:this.n};for(const k of Object.keys(TK))o[k]=this[k].subarray(0,this.n);return o;}
}
class Output{
 constructor(cap,max){this.max=max;this.cap=Math.min(max,Math.max(1024,cap));this.bytes=new Uint8Array(this.cap);this.origins=new Int32Array(this.cap);this.fresh=new Uint8Array(this.cap);this.n=0;}
 ensure(add){const end=this.n+add;if(end>this.max)throw Error('Decoded output limit reached.');if(end<=this.cap)return;this.cap=Math.min(this.max,Math.max(end,this.cap*2));for(const [k,T]of [['bytes',Uint8Array],['origins',Int32Array],['fresh',Uint8Array]]){const b=new T(this.cap);b.set(this[k]);this[k]=b;}}
 literal(v,id){this.ensure(1);this.bytes[this.n]=v;this.origins[this.n]=id;this.fresh[this.n++]=1;}
}
function hash32(x){x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return (x^(x>>>16))>>>0;}
function bitMask(start,n,amb){let m=0;for(let k=0;k<n;k++)if(amb.has(start+k))m|=1<<k;return m;}
function writeField(stream,start,n,value){for(let k=0;k<n;k++){const p=start+k,m=1<<(p&7);stream[p>>>3]=(stream[p>>>3]&~m)|(((value>>>k)&1)?m:0);}}
function applyPolicy(value,mask,start,policy,rate,seed){if(!mask||policy==='keep'||!policy)return value;let v=value;for(let k=0;k<16;k++)if(mask&(1<<k)){const h=hash32((start+k)^seed);if((h%10000)>=rate*100)continue;const bit=policy==='zero'?0:policy==='one'?1:policy==='toggle'?1-((v>>>k)&1):hash32(h^0x9e3779b9)&1;v=(v&~(1<<k))|(bit<<k);}return v;}
export function inflate(prepared,opts={},progress=()=>{}){
 const stream=prepared.stream.slice();patchStream(stream,opts.patches);
 const max=clamp(Math.floor((opts.maxMiB||64)*1048576),1024,256*1048576),r=new Bits(stream,opts.bitOffset||0,prepared.bits||stream.length*8),out=new Output(Math.min(prepared.recipe?.expected?.bytes+65536||16000000,max),max),tokens=new TokenStore(),blocks=[];
 const seed=new Uint8Array(32768),pat=opts.dictionary instanceof Uint8Array?opts.dictionary:hexBytes(opts.seedHex||'00');const histSize=clamp(opts.historySize??32768,0,32768);
 if(pat.length){if(opts.dictionary instanceof Uint8Array){const tail=pat.subarray(Math.max(0,pat.length-32768));seed.set(tail,32768-tail.length);}else for(let j=0;j<32768;j++)seed[j]=pat[j%pat.length];}
 const resets=new Set(String(opts.resetBlocks||'').split(/[ ,]+/).filter(Boolean).map(Number)),amb=prepared.ambiguities||new Set(),edited=[],lp=opts.model,search=opts.distancePolicy==='context';
 let historyBase=0,bnum=0,error=null;
 const get=(p)=>p>=historyBase?out.bytes[p]:seed[32768+p-historyBase];
 const org=(p)=>p>=historyBase?out.origins[p]:p-historyBase;
 try{
 let last=false;while(!last){
  if(++bnum>1000)throw Error('Block count limit reached.');const h=readHeader(r),start=out.n,tstart=tokens.n;last=!!h.final;
  if(opts.historyMode==='block'||resets.has(bnum))historyBase=out.n;
  const block={block:bnum,start,end:start,bit:h.start,body:h.body,type:h.type,final:last,tokens:0,literals:0,matches:0,synthetic:prepared.parts?.[bnum-1]?.synthetic||false,source:prepared.parts?.[bnum-1]?.originalStart??null,ll:h.ll,dd:h.dd};blocks.push(block);
  const record=v=>tokens.add({...v,block:bnum});
  if(h.type===0){for(let j=0;j<h.len;j++){const bit=r.pos,v=r.read(8),id=record({start:out.n,bit,end:r.pos,symbol:v,length:1});out.literal(v,id);block.literals++;}}
  else while(true){
   const bit=r.pos,s=r.sym(h.lt);if(s===256){record({start:out.n,bit,end:r.pos,symbol:s});break;}
   if(s<256){const id=record({start:out.n,bit,end:r.pos,symbol:s,length:1});out.literal(s,id);block.literals++;continue;}
   if(s>285)throw Error('Invalid length symbol.');const ln=LE[s-257],lbit=r.pos,lraw=r.read(ln),lm=bitMask(lbit,ln,amb);
   const use=bnum>=(opts.editFirst||1)&&bnum<=(opts.editLast||20),lextra=use?applyPolicy(lraw,lm,lbit,opts.lengthPolicy,opts.rate??100,opts.seed||1):lraw,L=LB[s-257]+lextra;
   const ds=r.sym(h.dt);if(ds>29)throw Error('Invalid distance symbol.');const dn=DE[ds],dbit=r.pos,draw=r.read(dn),dm=bitMask(dbit,dn,amb);let dextra=use?applyPolicy(draw,dm,dbit,search?'keep':opts.distancePolicy,opts.rate??100,opts.seed||1):draw,D=DB[ds]+dextra;
   if(search&&use&&dm&&lp){
    let sub=dm,best=-Infinity,bestD=D;const K=Math.min(L,Math.max(1,opts.contextBytes||12));
    do{
     const dd=DB[ds]+(draw^sub);let score=0,valid=out.n>=2&&(out.n-dd>=historyBase-histSize),known=true,a=signed(get(out.n-2))+10,b=signed(get(out.n-1))+10;
     if(valid&&(org(out.n-2)<0||org(out.n-1)<0))known=false;
     if(valid)for(let j=0;j<K;j++){const ref=out.n-dd+(j%dd),c=signed(get(ref))+10;if(org(ref)<0)known=false;if(a<0||a>20||b<0||b>20||c<0||c>20){valid=false;break;}score+=lp[(a*21+b)*21+c];a=b;b=c;}
     if(!valid||!known)score=-1e50;else score=score/K*3;
     let flips=0;for(let sb=sub;sb;sb&=sb-1)flips++;score-=(opts.editPenalty??.2)*flips;
     if(score>best+1e-9||(Math.abs(score-best)<1e-9&&dd===D)){best=score;bestD=dd;}
     if(!sub)break;sub=(sub-1)&dm;
    }while(true);D=bestD;dextra=D-DB[ds];
   }
   if(out.n-D<historyBase-histSize)throw Error(`Distance ${D} exceeds available history.`);
   if(lextra!==lraw){writeField(stream,lbit,ln,lextra);edited.push({block:bnum,token:tokens.n,field:'length',bit:lbit,before:LB[s-257]+lraw,after:L});}
   if(dextra!==draw){writeField(stream,dbit,dn,dextra);edited.push({block:bnum,token:tokens.n,field:'distance',bit:dbit,before:DB[ds]+draw,after:D});}
   record({start:out.n,bit,end:r.pos,symbol:s,length:L,distance:D,lbit,dbit,lmask:lm,dmask:dm,dsym:ds});out.ensure(L);
   for(let j=0;j<L;j++){const ref=out.n-D;out.bytes[out.n]=get(ref);out.origins[out.n]=org(ref);out.n++;}block.matches++;
  }
  block.end=out.n;block.endBit=r.pos;block.tokens=tokens.n-tstart;progress({block:bnum,bytes:out.n});
 }
 }catch(e){error={message:e.message,bit:r.pos,block:bnum};const b=blocks[blocks.length-1];if(b){b.end=out.n;b.endBit=r.pos;}}
 const t=tokens.finish();let lineageEdits=0;
 if(opts.lineageThreshold>0){const ids=new Set();let st=0;for(let p=1;p<=out.n;p++)if(p===out.n||out.origins[p]!==out.origins[st]){if(p-st>=opts.lineageThreshold&&out.origins[st]>=0&&out.bytes[st]!==0)ids.add(out.origins[st]);st=p;}for(let p=0;p<out.n;p++)if(ids.has(out.origins[p])){if(out.bytes[p]!==opts.lineageValue)lineageEdits++;out.bytes[p]=opts.lineageValue??0;}}
 return {bytes:out.bytes.subarray(0,out.n),origins:out.origins.subarray(0,out.n),fresh:out.fresh.subarray(0,out.n),tokens:t,blocks,stream,bitEnd:r.pos,error,edited,lineageEdits,seed,historySize:histSize,prepared};
}
export function tokenAt(decoded,p){const a=decoded.tokens?.start;if(!a?.length||p<0||p>=decoded.bytes.length)return -1;let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>>1;if(a[m]<=p)lo=m+1;else hi=m;}let i=lo-1;while(i>=0&&decoded.tokens.length[i]===0)i--;return i;}
/* GIF-style LZW, also configurable for MSB-first/early-change experiments. */
export function lzw(bytes,{minBits=8,maxBits=12,bitOffset=0,msb=false,earlyChange=0,requireClear=false,maxMiB=64}={}){
 minBits=clamp(minBits,2,11);maxBits=clamp(maxBits,minBits+1,16);const clear=1<<minBits,end=clear+1,limit=1<<maxBits,max=maxMiB*1048576;
 let dict=[],size,next,prev=null,pos=bitOffset,out=[],codes=[],error=null,ended=false;
 const reset=()=>{dict=Array(limit);for(let i=0;i<clear;i++)dict[i]=[i];next=end+1;size=minBits+1;prev=null;};reset();
 const read=n=>{let v=0;for(let j=0;j<n;j++){const bit=msb?((bytes[pos>>>3]>>>(7-(pos&7)))&1):((bytes[pos>>>3]>>>(pos&7))&1);if(msb)v=(v<<1)|bit;else v|=bit<<j;pos++;}return v;};
 try{while(pos+size<=bytes.length*8){const s=read(size);codes.push(s);if(requireClear&&codes.length===1&&s!==clear)throw Error('Expected initial clear code.');if(s===clear){reset();continue;}if(s===end){ended=true;break;}let word=dict[s];if(!word){if(s===next&&prev)word=prev.concat(prev[0]);else throw Error(`Invalid LZW code ${s}; next dictionary slot ${next}.`);}if(out.length+word.length>max)throw Error('Decoded output limit reached.');for(const v of word)out.push(v&255);if(prev&&next<limit){dict[next++]=prev.concat(word[0]);if(next+earlyChange===(1<<size)&&size<maxBits)size++;}prev=word;}}catch(e){error={message:e.message,bit:pos};}
 return {bytes:Uint8Array.from(out),origins:new Int32Array(out.length).fill(-1),fresh:new Uint8Array(out.length),tokens:null,blocks:[],stream:bytes,bitEnd:pos,error,codes,ended,edited:[],codec:'lzw'};
}
