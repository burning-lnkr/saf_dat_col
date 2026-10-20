#!/usr/bin/env python3
"""Make independent diagnostic plots, never an asserted recovered raster."""
from pathlib import Path
import json
import numpy as np
import matplotlib.pyplot as plt
import analyze_format_neutral as a
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'research/2026-10-20/format-neutral-run'
OUT=P/'figures';OUT.mkdir(parents=True,exist_ok=True)
plt.rcParams['svg.fonttype']='none'
s=json.loads((P/'compact_results.json').read_text())

def save(fig,name):
    fig.savefig(OUT/(name+'.png'),dpi=160,bbox_inches='tight')
    fig.savefig(OUT/(name+'.svg'),bbox_inches='tight')
    plt.close(fig)

b=np.asarray([r[:9] for r in s['blocks']],dtype=float)
fig,ax=plt.subplots(figsize=(12,4.8))
ax.plot(b[:,0],b[:,3],'-o',label='All expanded output bytes')
ax.plot(b[:,0],b[:,4],'-s',label='Locally supported fresh literals')
ax.set(xticks=b[:,0],xlabel='Retained DEFLATE block (not an image row)',ylabel='Byte-histogram entropy (bits)',title='The late low-diversity output is not a collapse of fresh-literal diversity')
ax.set_xticklabels([str(int(x))+('*' if int(x) in (12,13,20) else '') for x in b[:,0]])
ax.legend(loc='lower left');ax.grid(alpha=.2)
fig.text(.13,-.015,'* Blocks 12, 13 and 20 have synthetic endings. All values remain conditional on the source parse.',fontsize=9)
save(fig,'block_diversity')

fig,ax=plt.subplots(figsize=(12,4.8))
lag=np.asarray([r['lag'] for r in s['lags']])
for name,mark in [('near','o'),('late','s')]:
    vals=np.asarray([r[name] for r in s['lags']]);c=ax.plot(lag,vals[:,1],marker=mark,label=name+' holdout: actual ordering')
    ax.plot(lag,vals[:,2],linestyle='--',marker=mark,label=name+' holdout: shuffled mean')
ax.set(xlabel='Previous literal separation (bytes)',ylabel='Prediction gain over marginal (bits/value)',xticks=lag,title='Most apparent prediction gain also survives within-run shuffling')
ax.legend(ncol=2,loc='upper right');ax.grid(alpha=.2)
fig.text(.13,-.015,'Only consecutive locally supported literals. Sample counts fall at longer separations; see compact_results.json.',fontsize=9)
save(fig,'predictive_gain')

fig,ax=plt.subplots(figsize=(7.5,6))
g=a.samples(a.get_runs('headerguided'),1)[2];c,y=g
mat=np.bincount(c*21+y,minlength=441).reshape(21,21)
prob=mat/np.maximum(1,mat.sum(1,keepdims=True))
im=ax.imshow(prob,origin='lower',extent=[-10.5,10.5,-10.5,10.5],vmin=0,vmax=1)
fig.colorbar(im,ax=ax,label='Observed conditional proportion')
ax.set(xlabel='Next signed literal value',ylabel='Previous signed literal value',title='Late holdout: neighboring-value relationships\nNo raster width or channel labels used',xticks=range(-10,11,2),yticks=range(-10,11,2))
fig.text(.13,.005,'14,339 pairs; rows normalized separately. Rare previous values have greater sampling uncertainty.',fontsize=8)
save(fig,'literal_transition_map')

fig,ax=plt.subplots(figsize=(10,4.5))
for label,mark in [('near','o'),('late','s')]:
    rows=s['chains'];v=np.array([r[label] for r in rows]);n=np.array([r['terms'] for r in rows])
    ax.plot(n,v[:,1],marker=mark,label=label+': actual')
    ax.plot(n,v[:,2],marker=mark,linestyle='--',label=label+': permutation mean')
    for xx,yy,nn in zip(n,v[:,1],v[:,0]):ax.annotate('n='+str(int(nn)),(xx,yy),xytext=(6,5),textcoords='offset points',fontsize=9)
ax.set(xlabel='Terms summed at a three-byte separation',ylabel='Squared sum / sum of squared terms',xticks=[3,4],title='Short cancellation does not yet establish a stable integrated signal')
ax.legend();ax.grid(alpha=.2)
save(fig,'cancellation')
print('Saved four diagnostic PNGs and SVGs to',OUT)
