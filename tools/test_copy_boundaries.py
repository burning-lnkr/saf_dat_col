#!/usr/bin/env python3
"""Exploratory comparison, not an untouched test of the historic Combined recipe.
The recipes share literal runs. Test the same literal targets after copied bytes.
"""
import json
from pathlib import Path
import numpy as np
import analyze_format_neutral as a
P=a.OUT; C=a.CACHE
# The predictor is fitted only to the earlier pure literal pairs.
c,y=a.samples(a.get_runs('headerguided'),1)[0]
counts=np.bincount(c*21+y,minlength=441).reshape(21,21)
prob=(counts+.5)/(counts.sum(1,keepdims=True)+10.5)
marginal=(counts.sum(0)+.5)/(counts.sum()+10.5)

def boundary(name):
    x=np.fromfile(C/f'{name}.bin',np.uint8).astype(np.int16)
    x[x>=128]-=256
    fresh=np.fromfile(C/f'{name}.fresh.u8',np.uint8)
    support=np.fromfile(C/f'{name}.supported.u8',np.uint8)
    roots=np.fromfile(C/f'{name}.origins.i32','<i4')
    blocks=json.loads((C/f'{name}.blocks.json').read_text())
    p=np.flatnonzero((support[1:]>0)&(fresh[:-1]==0)&(roots[:-1]>=0))+1
    starts=np.array([b['start']for b in blocks]);p=p[~np.isin(p,starts)]
    block=np.searchsorted(starts,p,side='right')
    return roots[p],x[p-1]+10,x[p]+10,block

ids0,c0,y0,b0=boundary('headerguided');ids1,c1,y1,b1=boundary('combined')
ids,i,j=np.intersect1d(ids0,ids1,assume_unique=True,return_indices=True)
assert np.array_equal(y0[i],y1[j]) and np.array_equal(b0[i],b1[j])
c0,y0,b=c0[i],y0[i],b0[i];c1=c1[j]
r={'scope':'Retrospective candidate comparison. Combined was historically selected using related local statistics; these are not fresh confirmation data for it. Same literal token IDs, known nominal previous origin in both candidates, no within-block start crossing.', 'shared_targets':len(ids), 'splits':{}}
for label,bs in [('train',a.TRAIN),('near',a.NEAR),('late',a.LATE)]:
    take=np.isin(b,list(bs));base=-np.log2(marginal[y0[take]])
    z0=-np.log2(prob[c0[take],y0[take]]);z1=-np.log2(prob[c1[take],y0[take]])
    delta=z0-z1
    perblock=[]
    for bb in sorted(bs):
        m=b==bb;d=-np.log2(prob[c0[m],y0[m]])+np.log2(prob[c1[m],y0[m]])
        perblock.append({'block':bb,'n':int(m.sum()),'combined_improvement_bits':float(d.mean())})
    r['splits'][label]={'n':int(take.sum()),'changed_previous_value':int((c0[take]!=c1[take]).sum()),'baseline_bits':float(base.mean()),'headerguided_bits':float(z0.mean()),'combined_bits':float(z1.mean()),'combined_improvement_bits':float(delta.mean()),'per_block':perblock}
a.dump(P/'copy_boundary_results.json',r)
print(json.dumps(r,indent=2))
