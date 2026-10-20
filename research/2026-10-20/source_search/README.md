# Bounded actual-source symbol/length reparsing

This arm changes only one source-supported NUL/space ambiguity at a time. It examines LL Huffman symbols, length extras, and DD Huffman symbols, **not** the already explored distance-extra-only domain. No image score, guessed pixel, header edit, or CR movement is used.

Read [REPORT.md](REPORT.md) for results and qualifications. `protocol.json` was frozen before scoring. All 77 cases plus identity are retained in `candidates.json`, `candidates.tsv`, `scores.jsonl`, and `all_candidates.csv`. `shortlist.json` and `freeze_ledger.json` record training-only selection. The separately labeled `frontier_audit.json` preserves an exploratory structural alternative without changing that shortlist.

## Replay

From the repository root, with Node 20+ (the run used Node 24), Python 3, and a C++17 compiler:

```sh
node research/2026-10-20/source_search/prepare_problem.mjs
g++ -O3 -std=c++17 research/2026-10-20/source_search/score_candidates.cpp -o research/2026-10-20/cache/source_search/score_candidates
research/2026-10-20/cache/source_search/score_candidates research/2026-10-20/cache/source_search research/2026-10-20/source_search/candidates.tsv research/2026-10-20/source_search/scores.jsonl 1
python research/2026-10-20/source_search/select.py
python research/2026-10-20/source_search/make_frontier_audit.py
research/2026-10-20/cache/source_search/score_candidates research/2026-10-20/cache/source_search research/2026-10-20/source_search/shortlist.tsv research/2026-10-20/source_search/continuation_scores.jsonl 4 research/2026-10-20/cache/source_search/cpp_selected
research/2026-10-20/cache/source_search/score_candidates research/2026-10-20/cache/source_search research/2026-10-20/source_search/frontier_audit.tsv research/2026-10-20/source_search/frontier_continuation.jsonl 4 research/2026-10-20/cache/source_search/cpp_selected
node research/2026-10-20/source_search/verify_selected.mjs
python research/2026-10-20/source_search/summarize.py
python research/2026-10-20/source_search/package_manifest.py
```

The source inputs and application codec remain unchanged. Caches are regenerable and ignored. Native full payloads live at `research/2026-10-20/cache/source_search/candidate_ID/bytes.bin`; each also has `origins.bin`, `stream.bin`, and `blocks.json`. The tracked `candidate_ID.recipe.json` and `.delta.json` give exact replay decisions. No commit, push, or source-file modification is performed by this arm.

## Reusable scorer interface

```text
score_candidates PROBLEM_DIR candidates.tsv scores.jsonl [max_blocks=1] [dump_dir]
```

`PROBLEM_DIR` contains `stream.bin` and `meta.txt` emitted by `prepare_problem.mjs`. Candidate lines are whitespace-delimited:

```text
0 N
1 X 10062
2 P START_BIT NUMBER_OF_BITS HEX_PACKED_LSB_FIRST
```

An `X` operation flips one bit. A `P` operation replaces a specified bit interval, reading bit0 first from each hex byte. Multiple operations may follow an ID. The CR-search arm uses `P` for byte rotations. **The generic scorer does not establish source faithfulness and trusts frozen header tables**: callers must preserve header bits and prove their edit mapping separately. It enforces the retained EOB bit endpoint and an output cap of 16 MiB for both literal and match emissions. Independent repository-codec re-preparation and native inflate validate the selected cases.

Scores distinguish known constants, equal unknown dictionary identities, and unresolved comparisons. A different unknown tag is never treated as a proved unequal byte. Endpoint and literal-absorption diagnostics remain conditional encoder evidence, not general format validity or image authentication.
