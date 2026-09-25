import {clamp,mod,signed,tokenAt,hexBytes} from './codec.js';
export const DEFAULTS={
 source:'original',candidate:'combined',engine:'preset',sourceOffset:0,sourceLength:0,sourceBit:0,
 historySize:32768,seedHex:'00',historyMode:'continuous',resetBlocks:'',maxMiB:64,
 distancePolicy:'keep',lengthPolicy:'keep',rate:100,seed:1,editFirst:1,editLast:11,contextBytes:12,editPenalty:.2,modelKind:'recorded',modelFirst:1,modelLast:8,uniPrior:.5,biPrior:8,triPrior:16,
 patches:'',lineageThreshold:0,lineageValue:0,recipeOverride:'',
 width:5000,channels:3,sample:'u8',arrangement:'interleaved',stride:15001,prefix:1,offset:0,startRow:0,rows:0,tail:'drop',
 filter:'off',filterByte:0,filterBpp:0,invalidFilter:'0',filterSeed:'00',filterReset:0,filterOverrides:'',
 mode:'classifier',magnitudeA:7,magnitudeB:4,valueA:255,valueB:60,valueOther:0,matchSigned:false,reduce:'mean',
 magnitudeGain:25.5,signedGain:16,signedCenter:128,rawGain:1,modulusA:4,modulusB:7,remainderGain:32,remainderCenter:128,
 channelMap:'0,1,2',useAlpha:false,selection:'all',missing:'transparent',contrast:1,brightness:0,gamma:1,invert:false,
 smoothX:1,smoothY:1,repeat:10,flipX:false,flipY:false,transpose:false,drift:0,shiftOrigin:0,shiftPoints:'',shiftFill:'transparent',
 lzwMin:8,lzwMax:12,lzwMSB:false,lzwEarly:0,lzwClear:false,lzwHex:'00 01 08 1c 48 b0 a0 c1 83 08 05 06 50 58 70 61 c2 87',lzwSource:'hypothesis',
 probeStart:775210,probeLength:64,zoom:'fit',showBlocks:false
};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
function integer(v,name,min,max){if(!Number.isFinite(+v)||Math.floor(+v)!==+v||v<min||v>max)throw Error(`${name}: enter an integer from ${min} to ${max}.`);return +v;}
export function layoutFor(d,c){
 const width=integer(c.width,'Width',1,32768),channels=integer(c.channels,'Components',1,16);
 const packed=c.sample.startsWith('p'),depth=packed?Number(c.sample.slice(1)):c.sample.startsWith('u16')?16:8,bs=depth===16?2:1;
 const rowBytes=Math.ceil(width*channels*depth/8),prefix=integer(c.prefix,'Row prefix',0,65536),stride=c.stride===0?rowBytes+prefix:integer(c.stride,'Stride',1,1048576);
 const offset=integer(c.offset,'Output offset',0,Math.max(d.bytes.length,1)),total=Math.max(0,c.tail==='pad'?Math.ceil((d.bytes.length-offset)/stride):Math.floor((d.bytes.length-offset)/stride));
 const start=integer(c.startRow,'First row',0,Math.max(total,1)),height=Math.min(c.rows||total-start,total-start);
 if(height<=0)throw Error('No rows at this offset. Reduce the offset or stride.');
 if(width*height>18000000||height>32768)throw Error('Render limit: 18 million native pixels, 32768 rows. Use a row crop.');
 return {width,channels,packed,depth,bs,rowBytes,prefix,stride,offset,total,start,height,period:2**depth};
}
function parseOverrides(text){const map=new Map();for(const line of String(text||'').split(/\n|;/)){if(!line.trim())continue;const m=line.trim().match(/^(\d+)(?:-(\d+))?\s*:\s*([0-4])$/);if(!m)throw Error('Filter overrides use row:filter or first-last:filter.');const a=+m[1],b=+(m[2]||m[1]);if(b<a||b-a>32768)throw Error('Filter override range is too large.');for(let y=a;y<=b;y++)map.set(y,+m[3]);}return map;}
export function parseShifts(text){const pts=[];for(const line of String(text||'').split(/\n|;/)){if(!line.trim())continue;const m=line.trim().match(/^(\d+)\s*[: ,]\s*(-?\d+(?:\.\d+)?)$/);if(!m)throw Error('Shift points use row:horizontal shift.');pts.push([+m[1],+m[2]]);}pts.sort((a,b)=>a[0]-b[0]);for(let i=1;i<pts.length;i++)if(pts[i][0]===pts[i-1][0])throw Error('Duplicate shift row.');return pts;}
export function rowShift(y,c,pts){let s=(y-c.shiftOrigin)*c.drift;if(pts.length===1&&pts[0][0]===y)s+=pts[0][1];else if(pts.length>1&&y>=pts[0][0]&&y<=pts[pts.length-1][0]){let i=1;while(i<pts.length-1&&pts[i][0]<y)i++;const [a,v]=pts[i-1],[b,w]=pts[i];s+=v+(w-v)*(y-a)/(b-a);}return Math.round(s);}
function reflect(x,n){if(n===1)return 0;const t=mod(x,2*n);return t<n?t:2*n-1-t;}
function boxAxis(src,w,h,n,vertical){if(n<=1)return src;const out=new Float32Array(src.length),lines=vertical?w:h,len=vertical?h:w,half=Math.floor(n/2),idx=(line,p,c)=>((vertical?p*w+line:line*w+p)*4+c);
 for(let line=0;line<lines;line++)for(let c=0;c<4;c++){let sum=0;for(let j=-half;j<n-half;j++)sum+=src[idx(line,reflect(j,len),c)];for(let p=0;p<len;p++){out[idx(line,p,c)]=sum/n;sum-=src[idx(line,reflect(p-half,len),c)];sum+=src[idx(line,reflect(p+n-half,len),c)];}}return out;}
export function render(d,input){
 const c={...DEFAULTS,...input},l=layoutFor(d,c),{width:w,height:h,rowBytes:n,channels:C,depth,bs,stride,prefix,offset,start,period}=l;
 const raw=d.bytes,mask=d.fresh,orig=d.origins,overrides=parseOverrides(c.filterOverrides),seed=hexBytes(c.filterSeed),pts=parseShifts(c.shiftPoints);
 const selected=idx=>{if(idx<0||idx>=raw.length)return false;switch(c.selection){case 'fresh':return !!mask[idx];case 'copy':return !mask[idx];case 'known':return orig[idx]>=0;case 'history':return orig[idx]<0;default:return true;}};
 const mapChan=String(c.channelMap).split(/[ ,]+/).filter(Boolean).map(Number);if(['rawrgb','magrgb','signedrgb'].includes(c.mode)&&(!mapChan.length||mapChan.some(x=>!Number.isInteger(x)||x<0||x>=C)))throw Error(`Channel map needs component indices 0–${C-1}.`);
 const fields=new Float32Array(w*h*4),weights=new Float32Array(w*h),hist=new Uint32Array(256),markers=new Uint32Array(256);let prev=new Uint8Array(n),invalid=0,markerRows=0,qualifying=0,selectedBytes=0;
 if(seed.length)for(let i=0;i<n;i++)prev[i]=seed[i%seed.length];
 const needsFilter=c.filter!=='off'||overrides.size>0,first=needsFilter?0:start,bpp=c.filterBpp||Math.max(1,Math.ceil(C*depth/8));
 if(!Number.isInteger(bpp)||bpp<1||bpp>65536)throw Error('Filter byte step must be 1–65536.');
 const sampleAt=(x,k)=>{const i=c.arrangement==='planar'?k*w+x:x*C+k;return l.packed?Math.floor(i*depth/8):i*bs;};
 const transform=v=>{v=(v-128)*c.contrast+128+c.brightness;v=clamp(v,0,255);if(c.gamma!==1)v=255*Math.pow(v/255,1/c.gamma);return c.invert?255-v:v;};
 const vals=new Float64Array(C),mags=new Float64Array(C),sv=new Float64Array(C),indices=new Int32Array(C),valid=new Uint8Array(C);
 for(let row=first;row<start+h;row++){
  const base=offset+row*stride+prefix,rowData=new Uint8Array(n);rowData.set(raw.subarray(Math.min(raw.length,base),Math.min(raw.length,base+n)));
  const mi=offset+row*stride+c.filterByte,marker=raw[mi];if(row>=start&&mi<raw.length){markers[marker]++;markerRows++;if(marker>4)invalid++;}
  let ft=c.filter==='stored'?marker:c.filter==='off'?0:Number(c.filter);if(overrides.has(row))ft=overrides.get(row);
  if(!(ft>=0&&ft<=4)){if(c.invalidFilter==='stop')throw Error(`Row ${row}: filter marker ${marker}.`);ft=c.invalidFilter==='mod5'?(marker||0)%5:Number(c.invalidFilter)||0;}
  if(c.filterReset&&row%c.filterReset===0){prev.fill(0);if(seed.length)for(let i=0;i<n;i++)prev[i]=seed[i%seed.length];}
  if(needsFilter&&ft)for(let j=0;j<n;j++){const a=j>=bpp?rowData[j-bpp]:0,b=prev[j],z=j>=bpp?prev[j-bpp]:0;rowData[j]=(rowData[j]+(ft===1?a:ft===2?b:ft===3?Math.floor((a+b)/2):paeth(a,b,z)))&255;}
  if(needsFilter)prev=rowData;if(row<start)continue;
  for(let x=0;x<w;x++){
   let count=0,total=0,known=true,same=true;for(let k=0;k<C;k++){
    const j=sampleAt(x,k),ix=base+j;indices[k]=ix;let v;
    if(l.packed){const s=c.arrangement==='planar'?k*w+x:x*C+k,shift=8-depth-((s*depth)%8);v=(rowData[j]>>>shift)&(period-1);}
    else if(bs===2)v=c.sample==='u16le'?rowData[j]+rowData[j+1]*256:rowData[j]*256+rowData[j+1];else v=rowData[j];
    vals[k]=v;sv[k]=v<period/2?v:v-period;mags[k]=Math.min(v,period-v);valid[k]=+selected(ix);if(bs===2)valid[k]&=+selected(ix+1);
    if(ix<raw.length){hist[raw[ix]]++;if(orig[ix]<0||(bs===2&&orig[ix+1]<0))known=false;}else known=false;
    if(k&&sv[k]!==sv[0])same=false;if(valid[k]){count++;selectedBytes++;}
   }
   const dest=((row-start)*w+x)*4;let color=[0,0,0],alpha=255;
   if(!count){if(c.missing==='transparent')alpha=0;else color.fill(Number(c.missing)||0);}
   else if(c.mode==='shared'||c.mode==='family'){
    let family=0,remainder=0;if(known&&!same&&count===C)for(const a of [c.modulusA,c.modulusB]){if(!(Number.isInteger(a)&&a>=2&&a<=65536))throw Error('Moduli must be integers 2–65536.');const r=mod(sv[0],a);if(Array.from(sv).every(v=>mod(v,a)===r)){family=a;remainder=r;break;}}
    if(!family)alpha=0;else{qualifying++;const g=remainder>Math.floor(family/2)?remainder-family:remainder;color.fill(c.mode==='family'?(family===c.modulusB?c.valueA:c.valueB):c.remainderCenter+c.remainderGain*g);}
   }else if(['rawrgb','magrgb','signedrgb'].includes(c.mode)){
    color=[0,1,2].map(j=>{const k=mapChan[j%mapChan.length];if(!valid[k])return 0;return c.mode==='rawrgb'?vals[k]/(period-1)*255*c.rawGain:c.mode==='magrgb'?mags[k]*c.magnitudeGain:sv[k]*c.signedGain+c.signedCenter;});
    if(c.useAlpha&&C>=4)alpha=Math.floor(vals[3]/(period-1)*255);
   }else if(['distance','length','block','origin'].includes(c.mode)){
    const t=tokenAt(d,indices[0]);let v=0;if(t>=0)v=c.mode==='distance'?d.tokens.distance[t]/32768*255:c.mode==='length'?d.tokens.length[t]/258*255:c.mode==='block'?d.tokens.block[t]/Math.max(1,d.blocks.length)*255:((orig[indices[0]]%256)+256)%256;color.fill(v);
   }else{
    let mn=Infinity,mx=-Infinity;for(let k=0;k<C;k++)if(valid[k]){let v;switch(c.mode){case 'magnitude':v=mags[k]*c.magnitudeGain;break;case 'signed':v=sv[k]*c.signedGain+c.signedCenter;break;case 'rawgray':v=vals[k]/(period-1)*255*c.rawGain;break;case 'zero':v=vals[k]===0?255:0;break;case 'fresh':v=mask[indices[k]]?255:0;break;case 'history':v=orig[indices[k]]<0?255:0;break;default:{const a=c.matchSigned?sv[k]:mags[k];v=a===c.magnitudeA?c.valueA:a===c.magnitudeB?c.valueB:c.valueOther;}}
      total+=v;mn=Math.min(mn,v);mx=Math.max(mx,v);mags[k]=v;
    }
    const v=c.reduce==='max'?mx:c.reduce==='min'?mn:c.reduce==='sum'?total:c.reduce==='first'?mags[0]:total/count;color.fill(v);
   }
   for(let k=0;k<3;k++)fields[dest+k]=transform(color[k]);fields[dest+3]=alpha;weights[dest/4]=alpha&&count?(c.selection==='all'?1:count/C):0;
  }
 }
 // Weighted averaging leaves sparse windows transparent; even window sizes use
 // the same centered, half-sample symmetric convention as scipy.ndimage.
 const sx=integer(c.smoothX,'Horizontal average',1,2048),sy=integer(c.smoothY,'Vertical average',1,2048);let f=fields;
 if(sx>1||sy>1){for(let i=0;i<f.length;i+=4){const a=f[i+3]/255*weights[i/4];for(let k=0;k<3;k++)f[i+k]*=a;f[i+3]=255*a;}f=boxAxis(boxAxis(f,w,h,sy,true),w,h,sx,false);for(let i=0;i<f.length;i+=4){const a=f[i+3]/255;if(a){for(let k=0;k<3;k++)f[i+k]/=a;if(!c.useAlpha)f[i+3]=255;}else if(c.missing!=='transparent'){for(let k=0;k<3;k++)f[i+k]=Number(c.missing)||0;f[i+3]=255;}}}
 const shifts=Array.from({length:h},(_,i)=>rowShift(start+i,c,pts));let min=0,max=0;if(c.shiftFill==='expand'){min=Math.min(0,...shifts);max=Math.max(0,...shifts);}const ww=w+max-min;if(ww*h>20000000)throw Error('Shifted image exceeds pixel budget.');
 const ow=c.transpose?h:ww,oh=c.transpose?ww:h;if(ow>32768||oh>32768)throw Error('Image side exceeds 32768.');const rgba=new Uint8ClampedArray(ow*oh*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let xx=x+shifts[y]-min;if(c.shiftFill==='wrap')xx=mod(xx,ww);if(xx<0||xx>=ww)continue;
  let yy=y;if(c.flipX)xx=ww-1-xx;if(c.flipY)yy=h-1-yy;if(c.transpose)[xx,yy]=[yy,xx];const dest=(yy*ow+xx)*4,src=(y*w+x)*4;
  for(let k=0;k<4;k++)rgba[dest+k]=Math.floor(clamp(f[src+k],0,255));
 }
 return {rgba,width:ow,height:oh,layout:{...l,displayWidth:ww,minShift:min,shifts},stats:{markerRows,invalidMarkers:invalid,markerCounts:Array.from(markers),histogram:Array.from(hist),qualifying,selectedBytes,tailBytes:Math.max(0,raw.length-offset-l.total*stride)},config:c};
}
export function locatePixel(frame,x,y){const c=frame.config,l=frame.layout;if(c.transpose)[x,y]=[y,x];if(c.flipX)x=l.displayWidth-1-x;if(c.flipY)y=l.height-1-y;const shift=l.shifts[y]||0;x=x+l.minShift-shift;if(c.shiftFill==='wrap')x=mod(x,l.width);if(x<0||x>=l.width||y<0||y>=l.height)return null;const row=y+l.start,base=l.offset+row*l.stride+l.prefix,indices=[];
 for(let k=0;k<l.channels;k++){const s=c.arrangement==='planar'?k*l.width+x:x*l.channels+k;indices.push(base+Math.floor(s*l.depth/8));}return {x,row,indices};}
export function phaseScan(bytes,stride,rows=246,origin=0){stride=integer(stride,'Stride',1,100000);rows=Math.min(rows,Math.floor((bytes.length-origin)/stride)-1);if(rows<1)throw Error('Not enough rows for a phase scan.');const scores=[];for(let phase=0;phase<stride;phase++){let bad=0;for(let y=0;y<rows;y++)if(bytes[origin+phase+y*stride]>4)bad++;scores.push({phase,bad,rows});}scores.sort((a,b)=>a.bad-b.bad||a.phase-b.phase);return scores.slice(0,12);}
// Optional bright-path detector. It only generates integer row-shift control points.
export function traceBright(frame,{x0=0,x1=frame.width,y0=0,y1=frame.height,window=121,penalty=.015,maxJump=80}={}){
 const w=frame.width,h=frame.height;x0=clamp(Math.floor(x0),0,w-1);x1=clamp(Math.floor(x1),x0+1,w);y0=clamp(Math.floor(y0),0,h-1);y1=clamp(Math.floor(y1),y0+1,h);const W=x1-x0,H=y1-y0;
 if(W*H>5000000)throw Error('Use a smaller trace window.');const back=new Int16Array(W*H),scores=new Float32Array(W);let prev=new Float64Array(W);const half=Math.floor(window/2),profile=new Float64Array(w+1);
 for(let y=0;y<H;y++){
  profile[0]=0;for(let x=0;x<w;x++){const i=((y+y0)*w+x)*4;profile[x+1]=profile[x]+frame.rgba[i];}
  for(let x=0;x<W;x++){const lo=Math.max(0,x+x0-half),hi=Math.min(w,x+x0+half+1);scores[x]=(profile[hi]-profile[lo])/(hi-lo);}
  if(y===0){prev.set(scores);continue;}const cur=new Float64Array(W);
  for(let x=0;x<W;x++){let best=-Infinity,bestD=0;for(let p=Math.max(0,x-maxJump);p<=Math.min(W-1,x+maxJump);p++){const s=prev[p]-penalty*(p-x)**2;if(s>best){best=s;bestD=p-x;}}cur[x]=best+scores[x];back[y*W+x]=bestD;}prev=cur;
 }
 let p=0;for(let x=1;x<W;x++)if(prev[x]>prev[p])p=x;const path=new Int32Array(H);for(let y=H-1;y>=0;y--){path[y]=p+x0;if(y)p+=back[y*W+p];}const sorted=Array.from(path).sort((a,b)=>a-b),target=sorted[Math.floor(H/2)];return {target,points:Array.from(path,(x,y)=>`${y+y0+frame.layout.start}:${target-x}`).join('\n')};
}
