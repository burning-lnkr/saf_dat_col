#!/usr/bin/env python3
"""Layout-free profiles and fixed-holdout sequence tests. Requires NumPy.
Run export_format_neutral.mjs first. No original-image authenticity is assumed.
"""
from pathlib import Path
import argparse, csv, hashlib, json, platform
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'cache/format-neutral'
OUT = ROOT / 'research/2026-10-20/format-neutral-run'
TRAIN = set(range(1,9)); NEAR = {9,10,11}; LATE = set(range(14,20))
GROUP = lambda b: 0 if b in TRAIN else 1 if b in NEAR else 2 if b in LATE else -1

def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')

def entropy(c):
    p=c[c>0]/max(1,c.sum()); return float(-(p*np.log2(p)).sum())

def profile(x, mask, fresh, origins, lo, hi):
    a=x[lo:hi]; s=a.astype(np.int16); s[s>=128]-=256
    h=np.bincount(a,minlength=256)
    m=mask[lo:hi].astype(bool); hs=np.bincount(a[m],minlength=256)
    f=fresh[lo:hi].astype(bool); hf=np.bincount(a[f],minlength=256)
    ids,c=np.unique(origins[lo:hi],return_counts=True); j=int(c.argmax())
    out={'lo':int(lo),'hi':int(hi),'bytes':int(hi-lo),'entropy':entropy(h),
         'fresh_count':int(f.sum()),'supported_count':int(m.sum()),
         'signed_mean':float(s.mean()),'mean_abs':float(np.abs(s).mean()),
         'history_fraction':float((origins[lo:hi]<0).mean()),
         'top_root':int(ids[j]),'top_root_fraction':float(c[j]/len(a)),
         'unique_roots':int(len(ids)), 'fresh_entropy':entropy(hf),
         'supported_entropy':entropy(hs)}
    for name,hist in [('all',h),('fresh',hf),('supported',hs)]:
        n=int(hist.sum())
        out[name+'_counts']=[int(hist[v%256]) for v in range(-10,11)]
        out[name+'_outside_small_alphabet']=int(n-sum(out[name+'_counts']))
        out[name+'_mean']=float(sum(v*int(hist[v%256]) for v in range(-10,11))/max(1,n))
    return out

def get_runs(candidate):
    data=json.loads((CACHE/f'{candidate}.runs.json').read_text())['runs']
    return [(r['block'],r['start'],np.asarray(r['values'],dtype=np.int16)) for r in data if GROUP(r['block'])>=0]

def samples(runs, lag, second=False):
    groups=[([],[]) for _ in range(3)]
    off=lag*(2 if second else 1)
    for b,pos,a in runs:
        if len(a)<=off: continue
        y=a[off:]+10; context=a[off-lag:-lag]+10
        if second: context=context*21+(a[:-off]+10)
        g=groups[GROUP(b)];g[0].append(context);g[1].append(y)
    return [(np.concatenate(c).astype(np.int64),np.concatenate(y).astype(np.int64)) if y else (np.array([],dtype=np.int64),np.array([],dtype=np.int64)) for c,y in groups]

def evaluate(groups, k):
    c,y=groups[0]; counts=np.bincount(c*21+y,minlength=k*21).reshape(k,21)
    cond=(counts+.5)/(counts.sum(1,keepdims=True)+10.5)
    marginal=(counts.sum(0)+.5)/(counts.sum()+10.5)
    result={}
    for label,(cc,yy) in zip(['train','near','late'],groups):
        assert len(yy)>0 and yy.min()>=0 and yy.max()<=20
        base=-np.log2(marginal[yy]);cost=-np.log2(cond[cc,yy])
        result[label]={'n':int(len(yy)),'baseline_bits':float(base.mean()),'model_bits':float(cost.mean()),'gain_bits':float((base-cost).mean())}
    return result

def correlation(groups):
    out={}
    for label,(c,y) in zip(['train','near','late'],groups):
        out[label]=float(np.corrcoef(c,y)[0,1]) if len(y)>2 else None
    return out

def chain_stats(runs):
    out=[]
    # One first qualifying segment per run: avoids repeatedly counting overlapping windows.
    for m in [2,3,4,6]:
      for step in range(1,7):
        sums=[[],[],[]]; spans=[[],[],[]]; norms=[[],[],[]]
        width=1+(m-1)*step
        for b,pos,a in runs:
          if len(a)<width: continue
          v=a[:width:step].astype(float);z=np.r_[0.,np.cumsum(v)]
          g=GROUP(b);sums[g].append(v.sum());spans[g].append(np.ptp(z));norms[g].append(np.square(v).sum())
        row={'step':step,'terms':m}
        for label,v,s,n in zip(['train','near','late'],sums,spans,norms):
          row[label]={'runs':len(v),'mean_span':float(np.mean(s)) if s else None,'mean_sum_square':float(np.mean(np.square(v))) if v else None,
                      'cancellation_ratio':float(np.sum(np.square(v))/np.sum(n)) if n and np.sum(n)>0 else None}
        out.append(row)
    return out

def analyze(candidate, controls):
    x=np.fromfile(CACHE/f'{candidate}.bin',np.uint8)
    origins=np.fromfile(CACHE/f'{candidate}.origins.i32','<i4')
    fresh=np.fromfile(CACHE/f'{candidate}.fresh.u8',np.uint8)
    mask=np.fromfile(CACHE/f'{candidate}.supported.u8',np.uint8)
    assert len(x)==len(origins)==len(fresh)==len(mask)
    blocks=json.loads((CACHE/f'{candidate}.blocks.json').read_text())
    block_profiles=[]
    for b in blocks:
        q=profile(x,mask,fresh,origins,b['start'],b['end'])
        q.update(block=b['block'],synthetic=b['synthetic'])
        q['expansion_per_compressed_byte']=float(len(x[b['start']:b['end']])*8/(b['endBit']-b['bit']))
        block_profiles.append(q)
    windows=[profile(x,mask,fresh,origins,lo,min(lo+65536,len(x))) for lo in range(0,len(x),65536)]
    dump(OUT/f'{candidate}_profiles.json',{'block_profiles':block_profiles,'windows':windows})
    runs=get_runs(candidate)
    lag_models=[]
    for lag in range(1,13):
        g=samples(runs,lag);row={'lag':lag,'score':evaluate(g,21),'correlation':correlation(g)};lag_models.append(row)
    second=evaluate(samples(runs,3,True),441)
    vals=[[],[],[]]; positions=[[],[],[]]; local=[[],[],[]]
    for b,pos,a in runs:
        k=GROUP(b);vals[k].append(a+10);p=np.arange(pos,pos+len(a));positions[k].append(p);local[k].append(p-blocks[b-1]['start'])
    ys=[np.concatenate(v).astype(np.int64) for v in vals]
    phase_models=[]
    for mode,ps in [('global',positions),('block_local',local)]:
        ps=[np.concatenate(p) for p in ps]
        for period in range(2,65):
            g=[(p%period,y) for p,y in zip(ps,ys)]
            phase_models.append({'mode':mode,'period':period,'score':evaluate(g,period)})
    chains=chain_stats(runs)
    control_results=[]
    for seed in range(controls):
        rng=np.random.default_rng(47000+seed)
        perm=[(b,p,rng.permutation(a)) for b,p,a in runs]
        ctrl={'seed':47000+seed,'lags':[], 'chains':chain_stats(perm)}
        for lag in range(1,13):
            g=samples(perm,lag)
            ctrl['lags'].append({'lag':lag,'score':evaluate(g,21),'correlation':correlation(g)})
        control_results.append(ctrl)
        print(candidate,'permutation',seed+1,flush=True)
    report={'candidate':candidate,'sha256':hashlib.sha256(x).hexdigest(),
            'train_blocks':sorted(TRAIN),'near_blocks':sorted(NEAR),'late_blocks':sorted(LATE),
            'selection_scope':'Comparison of models, not source edits or image authentication. Near holdout ranks models; later holdout is reported without refitting.',
            'lag_models':lag_models,'second_order_lag3':second,'phase_models':phase_models,'chains':chains,'controls':control_results}
    dump(OUT/f'{candidate}_models.json',report)
    best=sorted(lag_models,key=lambda a:a['score']['near']['gain_bits'],reverse=True)
    phase_best=sorted(phase_models,key=lambda a:a['score']['near']['gain_bits'],reverse=True)
    print(candidate, 'best lag',best[0], '\nbest phase',phase_best[0],flush=True)
    return {'candidate':candidate,'sha256':report['sha256'],'best_near_lag':best[0], 'best_near_phase':phase_best[0], 'second_order_lag3':second}

def main():
    p=argparse.ArgumentParser();p.add_argument('--controls',type=int,default=20);p.add_argument('--candidate',choices=['headerguided','combined','both'],default='both');a=p.parse_args()
    OUT.mkdir(parents=True,exist_ok=True)
    names=['headerguided','combined'] if a.candidate=='both' else [a.candidate]
    result=[analyze(n,a.controls) for n in names]
    dump(OUT/f'summary_{a.candidate}.json',{'python':platform.python_version(),'numpy':np.__version__,'results':result})

if __name__=='__main__': main()
