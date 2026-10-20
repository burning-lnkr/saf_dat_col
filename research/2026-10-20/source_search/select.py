"""Freeze diagnostics-only shortlists from the preregistered source training half."""
from pathlib import Path
from fractions import Fraction
import hashlib,json

HERE=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    meta=json.loads((HERE/'candidates.json').read_text())
    assert meta['protocol_sha256']==sha(HERE/'protocol.json')
    rows=[json.loads(s) for s in (HERE/'scores.jsonl').read_text().splitlines()]
    byid={int(r['id']):r for r in rows};base=byid[0]
    assert set(byid)==set(range(meta['eligible']+1))
    cases={c['id']:c for c in meta['cases']}
    valid=[r for r in rows if int(r['id']) and r['valid']]
    metrics=[('cheaper_absorptions',2),('endpoint_equalities',2),('same_symbol_absorptions',1)]
    rankings={};selected=set()
    for metric,n in metrics:
        def key(r):
            return (Fraction(r['train'][metric],r['train']['tested']),
                abs(r['output_bytes']-base['output_bytes']),cases[int(r['id'])]['bit'])
        ranked=sorted(valid,key=key)
        rankings[metric]=[int(r['id']) for r in ranked]
        selected.update(int(r['id']) for r in ranked[:n])
    summary=dict(protocol_sha256=sha(HERE/'protocol.json'),scores_sha256=sha(HERE/'scores.jsonl'),
        valid_candidates=len(valid),invalid_candidates=len(rows)-1-len(valid),rankings=rankings,
        selector_shortlists={metric:rankings[metric][:n] for metric,n in metrics},selected=sorted(selected),
        selection_uses_only='train metrics, absolute total output-byte delta tie-break, and source-bit tie-break; no second-half or later-block metric',
        selected_details=[dict(**cases[i],train=byid[i]['train'],output_delta=byid[i]['output_bytes']-base['output_bytes'],
            token_delta=byid[i]['tokens_including_eob']-base['tokens_including_eob']) for i in sorted(selected)],baseline_train=base['train'])
    (HERE/'shortlist.json').write_text(json.dumps(summary,indent=2)+'\n')
    (HERE/'shortlist.tsv').write_text('0 N\n'+''.join(f'{i} X {cases[i]["bit"]}\n' for i in sorted(selected)))
    freeze=dict(scope='Frozen before decoding blocks2–4; later source is untouched but decoded history may change, so continuation is not statistically independent.',
        hashes={p.name:sha(p) for p in [HERE/'protocol.json',HERE/'candidates.json',HERE/'candidates.tsv',HERE/'scores.jsonl',HERE/'shortlist.json',HERE/'shortlist.tsv']})
    (HERE/'freeze_ledger.json').write_text(json.dumps(freeze,indent=2)+'\n')
    print(json.dumps({k:summary[k] for k in ['valid_candidates','invalid_candidates','selector_shortlists','selected','selected_details']},indent=2))

if __name__=='__main__':main()
