"""Hash tracked evidence and document regenerated payload-cache interfaces."""
from pathlib import Path
import hashlib,json

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    inputs=['js/codec.js','data/index.json','data/original_headerguided.json','data/saf_dat_col.utf8.bin','data/community.bin']
    own=sorted(str(p.relative_to(ROOT)) for p in HERE.iterdir() if p.is_file() and p.name not in ['manifest.json','tracked_files.txt'])
    optional=['research/2026-10-20/propagation/results.json','research/2026-10-20/propagation/common_known_endpoints.csv']
    (HERE/'tracked_files.txt').write_text('\n'.join(own+[str((HERE/'manifest.json').relative_to(ROOT)),str((HERE/'tracked_files.txt').relative_to(ROOT))])+'\n')
    files=[]
    for rel in own+[str((HERE/'tracked_files.txt').relative_to(ROOT))]+inputs+optional:
        p=ROOT/rel
        if not p.exists():continue
        files.append(dict(path=rel,bytes=p.stat().st_size,sha256=digest(p),role='input' if rel in inputs else 'independent_audit_reference' if rel in optional else 'owned_artifact'))
    caches=[]
    for i in [1,16,60,73]:
        for name in ['bytes.bin','origins.bin','stream.bin','blocks.json']:
            p=ROOT/f'research/2026-10-20/cache/source_search/candidate_{i}'/name
            caches.append(dict(path=str(p.relative_to(ROOT)),bytes=p.stat().st_size,sha256=digest(p),regenerated_by='verify_selected.mjs'))
    report=dict(scope='Frozen actual-source single-bit symbol/length reparse experiment. No source/app edits, image optimization, recovered-image claim, commit, or push.',
        repository_relative=True,files=files,ignored_regenerable_cache_files=caches,
        tracked_artifact_bytes_excluding_self=sum(r['bytes'] for r in files if r['role']=='owned_artifact'),
        replay_instructions='research/2026-10-20/source_search/README.md',
        independent_reference_qualification='Propagation references are produced by a sibling audit and are not runtime dependencies of the source-search replay.',
        self_hash_omitted=True)
    (HERE/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['files','ignored_regenerable_cache_files']}))
if __name__=='__main__':main()
