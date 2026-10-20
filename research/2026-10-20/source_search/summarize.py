from pathlib import Path
from collections import Counter
import csv,json

HERE=Path(__file__).resolve().parent
def main():
    meta=json.loads((HERE/'candidates.json').read_text());cases={c['id']:c for c in meta['cases']}
    rows=[json.loads(r) for r in (HERE/'scores.jsonl').read_text().splitlines()];base=rows[0]
    keys=['endpoint_equalities','cheaper_absorptions','same_symbol_absorptions','tested','known_endpoint_comparisons','unresolved_endpoint_comparisons','known_output_bytes','output_bytes']
    full=[]
    for r in rows:
        i=int(r['id']);c=cases.get(i,{})
        x=dict(id=i,field=c.get('field','identity'),stream_bit=c.get('bit',''),valid=r['valid'],error=r['error'],
            output_delta=r['output_bytes']-base['output_bytes'],token_delta=r['tokens_including_eob']-base['tokens_including_eob'])
        if r['valid']:
            for region in ['train','heldout_b1']:
                for k in keys:x[region+'_'+k]=r[region][k]
        full.append(x)
    with (HERE/'all_candidates.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=full[0].keys());w.writeheader();w.writerows(full)
    verification=json.loads((HERE/'verification_summary.json').read_text())
    continued=[]
    for r in verification['results']:
        m=r['metrics'];later={k:sum(b['stats'][k] for b in m['blocks'][1:]) for k in keys}
        continued.append(dict(id=r['id'],selection=r['selection'],train={k:m['train'][k] for k in keys},
            untouched_second_half={k:m['heldout_b1'][k] for k in keys},untouched_blocks2to4=later,
            output_delta=r['block1_output_delta'],token_delta=r['block1_token_delta'],
            all_ll_dd_trees_compatible=all(not b['ll_differing_symbols'] and not b['dd_differing_symbols'] for b in r['tree_compatibility'])))
    report=dict(scope='Fixed chosen parses with arbitrary initial dictionary tags. Later source is untouched but history-dependent; counts are not statistically independent validation. No pixel/image optimization.',
        eligible=meta['eligible'],valid=sum(r['valid'] for r in rows)-1,excluded_distance_extra_bits=meta['inventory']['distance_extra_bits_only'],
        candidate_field_counts=dict(Counter(c['field'] for c in cases.values())),
        token_delta_histogram=dict(sorted(Counter(r['token_delta'] for r in full[1:]).items())),
        source_shortlist_and_exploratory=continued)
    (HERE/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
