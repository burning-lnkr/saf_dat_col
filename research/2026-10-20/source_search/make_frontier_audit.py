"""Explicitly exploratory frontier selection, separate from frozen rate shortlists."""
from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent
def main():
    cases=json.loads((HERE/'candidates.json').read_text())['cases']
    rows={int(r['id']):r for r in map(json.loads,(HERE/'scores.jsonl').read_text().splitlines())}
    valid=[c for c in cases if rows[c['id']]['valid']]
    best=max(rows[c['id']]['train']['first_endpoint_bit'] for c in valid)
    finalists=[c for c in valid if rows[c['id']]['train']['first_endpoint_bit']==best]
    assert len(finalists)==1
    c=finalists[0]
    x={'scope':'Exploratory frontier audit chosen after the complete single-flip sweep; not part of the preregistered average-rate shortlist. Frozen before blocks2–4 evaluation and full native replay.',
       'reason':'Unique eligible first-half candidate advancing the earliest endpoint from bit10110 to12488; structural DD-symbol reparse.',
       'candidate':c,'original_shortlist_sha256':hashlib.sha256((HERE/'shortlist.json').read_bytes()).hexdigest()}
    (HERE/'frontier_audit.json').write_text(json.dumps(x,indent=2)+'\n')
    (HERE/'frontier_audit.tsv').write_text(f'{c["id"]} X {c["bit"]}\n')
if __name__=='__main__':main()
