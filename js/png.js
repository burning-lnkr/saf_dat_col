// Small PNG writer. Compression and row repetition are computed in the browser.
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b){let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const be=n=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
function concat(parts){const a=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let p=0;for(const b of parts){a.set(b,p);p+=b.length;}return a;}
function chunk(name,b){const t=new TextEncoder().encode(name),all=concat([t,b]);return concat([be(b.length),all,be(crc(all))]);}
export async function encodePNG(frame,repeat=1,metadata={}){
 const w=frame.width,h=frame.height*repeat;if(!Number.isInteger(repeat)||repeat<1||repeat>100||w*h>100000000||w>32768||h>32768)throw Error('PNG export limit: 100 million pixels and 32768 pixels per side. Reduce repetition or crop.');
 const rowLen=w*4;let y=0;
 const rs=new ReadableStream({pull(controller){if(y>=h){controller.close();return;}const row=new Uint8Array(rowLen+1),p=Math.floor(y/repeat)*rowLen;row.set(frame.rgba.subarray(p,p+rowLen),1);controller.enqueue(row);y++;}});
 const compressed=new Uint8Array(await new Response(rs.pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
 const info=new TextEncoder().encode('SAF.recipe\0\0\0\0\0'+JSON.stringify(metadata));
 return concat([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',concat([be(w),be(h),new Uint8Array([8,6,0,0,0])])),chunk('iTXt',info),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())]);
}
