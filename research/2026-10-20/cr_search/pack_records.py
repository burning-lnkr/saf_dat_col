"""Persist full screening records in deterministic gzip form."""
from pathlib import Path
import gzip,hashlib,json
HERE=Path(__file__).resolve().parent
out=HERE/'records';out.mkdir(exist_ok=True)
manifest=[]
for name in ['candidates.json','scores.jsonl']:
    raw=(HERE/name).read_bytes();target=out/(name+'.gz')
    with target.open('wb') as f:
        with gzip.GzipFile(filename='',mode='wb',fileobj=f,compresslevel=9,mtime=0) as z:z.write(raw)
    assert gzip.decompress(target.read_bytes())==raw
    manifest.append({'source':name,'archive':'records/'+target.name,'uncompressedBytes':len(raw),
        'sha256':hashlib.sha256(raw).hexdigest(),'archiveBytes':target.stat().st_size,
        'archiveSha256':hashlib.sha256(target.read_bytes()).hexdigest()})
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
