# Moving a previously inserted carriage return

This arm changes missing-byte placement, which was held fixed by the previous
distance-only investigation. It searches the actual supplied capture. The
experiment does not create synthetic source data or edit an already rendered
image.

## What was allowed

Starting from `data/original_headerguided.json`, move one existing inserted
byte 13 to a nearby insertion position in the first half of retained block 1.
The fixed displacement list is ±1…8, ±16 and ±32 prepared-source positions.
The original capture bytes, selected NUL substitutions, insertion count,
headers, and retained compressed endpoints stay fixed. A move is a rotation
of one byte across a short interval; global stream alignment need not be a
multiple of eight bits.

The full rules and shortlist selection criteria were written to
[`protocol.json`](protocol.json) before scoring. This is a bounded test of
single local moves. It is not an exhaustive reconstruction of missing CRs,
simultaneous moves, or all original damage.

## Results

There are **1,758 alternatives**, of which **1,752** parse to the unchanged
retained endpoint; six fail that gate. Identity is scored separately. The
complete table is [`all_candidates.csv`](all_candidates.csv). Exact full
candidate descriptions and scorer records are preserved as gzip files in
[`records/`](records/), with hashes of their uncompressed contents.

Five distinct alternatives enter the predetermined diagnostic shortlist:

| ID | CR move, prepared-source coordinates | Output-length change | Token-count change |
| --- | --- | ---: | ---: |
| 1244 | 22964 → 22957 | +2 | 0 |
| 1552 | 27499 → 27501 | +20 | −3 |
| 425 | 9624 → 9618 | −68 | −3 |
| 421 | 9624 → 9592 | −68 | −2 |
| 780 | 14253 → 14285 | −49 | +4 |

All five reproduce the direct wire patch when rebuilt through the original
recipe preparer. All retain every selected header and block endpoint. Native
zlib agrees with the repository decoder under both zero and cycling initial
dictionaries. The separate C++ scorer agrees on the first four blocks' bytes
and symbolic history tags. Exact checks, hashes, changed source coordinates,
and token resynchronization are in [`verification.json`](verification.json).

Local reductions do not select an authenticated original. For example,
candidate 1244 reduces the first-half cheaper-match-plus-literal diagnostic
from 157 to 139 and the second-half count from 445 to 415; the following three
blocks increase from 4,577 to 4,613. These are raw conditional counts: edits
also change which endpoints are known, so they cannot alone establish a
regression on matched evidence. The separate
[`../propagation/`](../propagation/) audit compares common-known source
tokens and removes output displacement before measuring propagated changes.

The endpoint and cost diagnostics assume particular encoder behavior. They
are not DEFLATE legality rules, and they do not establish PNG dimensions,
filter type, source authenticity, or recognizable content.

## Reproduce

Run commands from the repository root, using Node, a C++17 compiler and Python.
The native display step additionally needs Pillow.

```bash
node research/2026-10-20/baseline/export.mjs
node research/2026-10-20/source_search/prepare_problem.mjs
g++ -std=c++17 -O3 research/2026-10-20/source_search/score_candidates.cpp -o research/2026-10-20/cache/source_search/score_candidates
node research/2026-10-20/cr_search/prepare_candidates.mjs
research/2026-10-20/cache/source_search/score_candidates research/2026-10-20/cache/source_search research/2026-10-20/cr_search/candidates.tsv research/2026-10-20/cr_search/scores.jsonl 1
node research/2026-10-20/cr_search/select.mjs
research/2026-10-20/cache/source_search/score_candidates research/2026-10-20/cache/source_search research/2026-10-20/cr_search/shortlist.tsv research/2026-10-20/cr_search/continuation.jsonl 4 research/2026-10-20/cache/cr_search/continuation
node research/2026-10-20/cr_search/verify.mjs
python research/2026-10-20/cr_search/pack_records.py
```

To inspect the saved records without recomputing, decompress the two files
in `records/`. Their original basenames and hashes are in
[`records/manifest.json`](records/manifest.json). All indices and bit positions
are zero-based; bit ranges are end-exclusive and LSB-first.

An independent review found a general output-cap omission on literal
emissions in the scorer. After fixing that guard, the complete 1,759-record
screening output, including identity, remained byte-for-byte identical;
[`implementation_fix_validation.json`](implementation_fix_validation.json)
records the check. This fix does not change the frozen shortlist.
