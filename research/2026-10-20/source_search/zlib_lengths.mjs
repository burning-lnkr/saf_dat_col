// JavaScript reimplementation of historical zlib build_tree/gen_bitlen,
// including heap/depth tie breaking. Used only as a conditional fingerprint.
export function zlibLengths(counts,maxBits=15){
 const elems=counts.length,N=2*elems+1,freq=[...counts,...Array(elems+1).fill(0)],depth=Array(N).fill(0),dad=Array(N).fill(0),len=Array(N).fill(0),heap=Array(N).fill(0);
 let hl=0,hm=N,max=-1;for(let i=0;i<elems;i++)if(freq[i]){heap[++hl]=i;max=i;}
 while(hl<2){let j=max<2?++max:0;heap[++hl]=j;freq[j]=1;}
 const small=(a,b)=>freq[a]<freq[b]||freq[a]===freq[b]&&depth[a]<=depth[b];
 function down(k){let v=heap[k],j=k*2;while(j<=hl){if(j<hl&&small(heap[j+1],heap[j]))j++;if(small(v,heap[j]))break;heap[k]=heap[j];k=j;j*=2;}heap[k]=v;}
 for(let j=hl>>1;j;j--)down(j);let node=elems;
 do{let n=heap[1];heap[1]=heap[hl--];down(1);let m=heap[1];heap[--hm]=n;heap[--hm]=m;freq[node]=freq[n]+freq[m];depth[node]=Math.max(depth[n],depth[m])+1;dad[n]=dad[m]=node;heap[1]=node++;down(1);}while(hl>=2);
 heap[--hm]=heap[1];let overflow=0,bc=Array(maxBits+1).fill(0);
 for(let h=hm+1;h<N;h++){let n=heap[h],bits=len[dad[n]]+1;if(bits>maxBits){bits=maxBits;overflow++;}len[n]=bits;if(n<=max)bc[bits]++;}
 if(overflow){do{let bits=maxBits-1;while(!bc[bits])bits--;bc[bits]--;bc[bits+1]+=2;bc[maxBits]--;overflow-=2;}while(overflow>0);let h=N;for(let bits=maxBits;bits;bits--){let n=bc[bits];while(n){let m=heap[--h];if(m>max)continue;len[m]=bits;n--;}}}
 return len.slice(0,elems);
}
