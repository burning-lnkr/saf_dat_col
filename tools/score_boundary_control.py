#!/usr/bin/env python3
"""Assess literal-selection bias by recompressing the same actual output bytes.
This is a post-hoc calibration, not an original-source authentication test.
"""
import json
import numpy as np
import analyze_format_neutral as a
C=a.CACHE;P=a.OUT
x=np.fromfile(C/'headerguided.bin',np.uint8).astype(np.int16);x[x>=128]-=256;x+=10
roots=np.fromfile(C/'headerguided.origins.i32','<i4')
blocks=json.loads((C/'headerguided.blocks.json').read_text());starts=np.array([b['start']for b in blocks])
rows=[]
for name in ['headerguided','native6','native9']:
    f=np.fromfile(C/f'{name}.fresh.u8',np.uint8)
    support=np.fromfile(C/'headerguided.supported.u8',np.uint8) if name=='headerguided' else f
    eligible=(roots[1:]>=0)&(roots[:-1]>=0)
    masks={'pure':(support[1:]>0)&(support[:-1]>0)&eligible,'boundary':(support[1:]>0)&(f[:-1]==0)&eligible}
    samples={}
    for typ,mask in masks.items():
        p=np.flatnonzero(mask)+1;p=p[~np.isin(p,starts)]
        b=np.searchsorted(starts,p,side='right');samples[typ]=(p,b)
    p,b=samples['pure'];q=p[np.isin(b,list(a.TRAIN))]
    counts=np.bincount(x[q-1]*21+x[q],minlength=441).reshape(21,21)
    pr=(counts+.5)/(counts.sum(1,keepdims=True)+10.5);marg=(counts.sum(0)+.5)/(counts.sum()+10.5)
    result={'name':name,'train_pure_pairs':len(q),'scores':{}}
    for typ,(p,b) in samples.items():
        result['scores'][typ]={}
        for split,bs in [('near',a.NEAR),('late',a.LATE)]:
            q=p[np.isin(b,list(bs))];base=-np.log2(marg[x[q]]);loss=-np.log2(pr[x[q-1],x[q]])
            result['scores'][typ][split]={'n':len(q),'marginal_bits':float(base.mean()),'conditional_bits':float(loss.mean()),'gain_bits':float((base-loss).mean())}
    rows.append(result)
a.dump(P/'boundary_calibration.json',{'scope':'Same Header-guided output, normally recompressed with Z_FILTERED levels 6 and 9. Each selection mask gets its own earlier-pure-literal predictor. Only positions with known nominal roots in the original reconstruction. Sample populations differ; this diagnoses selection bias and does not repair bytes.','native':json.loads((C/'native_selection.json').read_text()),'results':rows})
print(json.dumps(rows,indent=2))
