#!/usr/bin/env python3
"""Compact archival tables from the full deterministic format-neutral results."""
from pathlib import Path
import json, hashlib
import numpy as np
import analyze_format_neutral as a
ROOT=Path(__file__).resolve().parents[1]; P=ROOT/'research/2026-10-20/format-neutral-run'; C=ROOT/'cache/format-neutral'
x=json.loads((P/'headerguided_models.json').read_text()); y=json.loads((P/'combined_models.json').read_text())
rows=[]
for r in x['lag_models']:
    row={'lag':r['lag']}
    for s in ['near','late']:
        v=[z['lags'][r['lag']-1]['score'][s]['gain_bits'] for z in x['controls']]
        row[s]=[r['score'][s]['n'],round(r['score'][s]['gain_bits'],8),round(float(np.mean(v)),8),round(float(min(v)),8),round(float(max(v)),8),round(r['correlation'][s],8)]
    rows.append(row)
chains=[]
for i,r in enumerate(x['chains']):
    if r['terms'] not in (3,4) or r['step']!=3: continue
    row={'step':r['step'],'terms':r['terms']}
    for s in ['near','late']:
        v=[c['chains'][i][s]['cancellation_ratio'] for c in x['controls']]
        row[s]=[r[s]['runs'],round(r[s]['cancellation_ratio'],8),round(float(np.mean(v)),8),round(float(min(v)),8),round(float(max(v)),8)]
    chains.append(row)
phase={n:sorted(z['phase_models'],key=lambda r:r['score']['near']['gain_bits'],reverse=True)[0]for n,z in [('headerguided',x),('combined',y)]}
# Post-hoc descriptive decomposition: not an additional independently untouched holdout.
runs=a.get_runs('headerguided'); features=[]
for lag in [1,2,3]:
    g=a.samples(runs,lag)
    for name,k,f in [('signed_previous',21,lambda c:c),('magnitude_previous',11,lambda c:abs(c-10)),('sign_previous',3,lambda c:np.sign(c-10)+1)]:
        sc=a.evaluate([(f(c),v) for c,v in g],k)
        features.append({'lag':lag,'feature':name,'near_gain':round(sc['near']['gain_bits'],8),'late_gain':round(sc['late']['gain_bits'],8)})
b=json.loads((P/'headerguided_profiles.json').read_text())['block_profiles']
blocks=[]
for q in b:
    blocks.append([q['block'],q['bytes'],q['supported_count'],round(q['entropy'],6),round(q['supported_entropy'],6),round(q['all_mean'],6),round(q['supported_mean'],6),q['top_root'],round(q['top_root_fraction'],6),q['synthetic']])
s={'scope':'Actual candidate data; no raster. Counts/metrics conditional on retained source parse. Controls permute inside original literal runs, not recompress.',
   'export':json.loads((C/'export.json').read_text()),
   'literal_run_model_results_identical_between_candidates':all(x[k]==y[k] for k in ['lag_models','chains','controls','second_order_lag3']),
   'lag_columns':['heldout_samples','gain_bits','shuffle_mean_gain','shuffle_min_gain','shuffle_max_gain','correlation'],
   'lags':rows,'best_phase_models':phase,
   'chain_columns':['runs','sum_square_over_individual_squares','shuffle_mean','shuffle_min','shuffle_max'],'chains':chains,
   'posthoc_feature_decomposition':features,
   'block_columns':['block','bytes','supported_literals','entropy_all','entropy_supported','mean_all','mean_supported','dominant_root_token','dominant_root_fraction','synthetic_end'],
   'blocks':blocks,
   'full_results_sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in [P/n for n in ['combined_models.json','combined_profiles.json','headerguided_models.json','headerguided_profiles.json','summary_both.json']]}}
(P/'compact_results.json').write_text(json.dumps(s,separators=(',',':'),allow_nan=False)+'\n')
print(json.dumps(s,separators=(',',':')))
