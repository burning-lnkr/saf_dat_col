# Source interpretation investigation — 20 October 2026

Work branch: `codex/source-interpretation-2026-10-20`.
Recovered repository base: `cdb41453d0c2a61d09dcf341adb7e30762c7c2a6`.

Also on this branch: the later [format-neutral protocol](FORMAT_NEUTRAL_PROTOCOL.md)
and [executed format-neutral experiments](format-neutral-run/RESULTS.md). This
repair audit supplements that work; its raster visualizations remain hypotheses.

## Outcome

The repository restored the exact source capture and Header-guided baseline.
This pass tested **1,835 actual-source alternatives**: 77 NUL/space choices
affecting symbols or lengths, and 1,758 nearby placements of an already inserted
carriage return. Nine alternatives received complete independent replay and
downstream propagation checks.

Two new results matter:

1. **The old token interpretation is not unique.** One damage-compatible
   source-space interpretation changes 16 compressed instructions into 18,
   removes the previous earliest diagnostic witness, retains the captured
   endpoint, and reproduces the same inferred Huffman tables. The fixed-token
   proof cannot automatically be applied to this reparsed interval.
2. **Millions of apparent output changes can be displacement.** Accounting for
   the exact output-length change, all nine converge to the same symbolic
   decoded history during block 7. The final **9,585,906 aligned bytes are
   identical for any shared incoming dictionary**.

No alternative is authenticated as the original source. The new visual
comparisons do not reveal a recognizable image; the magnitude stripe persists.
These results do not establish that the original PNG contained noise, that its
colors are irrecoverable, or that the assumed raster layout is correct.

## Images to inspect

- [Full comparison sheet](visuals/source_interpretation_comparison.png).
- [Fixed native-pixel crops](visuals/fixed_native_crops.png).
- [Before: full native Sub/RGB view](visuals/baseline_sub_rgb.png).
- [After alternative: source-symbol reparse](visuals/symbol_1_sub_rgb.png).
- [After alternative: moved CR placement](visuals/cr_1244_sub_rgb.png).
- [Baseline magnitude classes](visuals/baseline_magnitude_classes.png).

![Actual-data comparison](visuals/source_interpretation_comparison.png)

Native frames are 5000 × 785 pixels under the shared RGB8, stride-15001,
prefix-one hypothesis. Unknown incoming history is zero-filled for display.
These are not recovered PNG dimensions or filter metadata. The overview averages
pixels and repeats preview rows vertically; native files retain the computed
pixels. [Visual documentation](visuals/README.md) records every setting.

## Restored evidence

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Supplied UTF-8 capture | 1,986,163 | `53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c` |
| Header-guided recipe | 52,928 | `5144b002d0fae178c33f265c76d76fce02addd4f6997678fbe15bcf5f2e4b83d` |
| Reconstructed compressed stream | 1,200,345 | `a10005bf746a70d9339b8069e83b677372d6d42530c6e221f8aec0b634604063` |
| Nominal decoded payload | 11,779,452 | `bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2` |

These match the identities recorded before the previous workspace was lost.
The application codec, independent ancestry replay and native zlib agree.
Native checks use zero and nonconstant dictionaries. The existing repository
test suite passes; its transcript is [`core-test.log`](core-test.log).

The baseline has 622,397 tokens across 20 selected blocks. The incoming
32,768-byte history, omitted prefix, damage choices and PNG/raster interpretation
remain unresolved. Blocks 12, 13 and 20 inherit synthetic endings.

The [baseline export](baseline/README.md) reproduces 102,472 nominal-distance,
dictionary-independent endpoint equalities, including the old token-644 example,
and 8,623 cheaper same-length-symbol match/literal replacements. Those are
conditional diagnostics and equivalent encodings, not recovered pixels. This
pass does **not** recreate the lost all-enumerated-distance-domain proof.

## Actual-source experiments

The NUL/space arm enumerates every eligible first-half block-1 ambiguity touching
an LL symbol, length extra or DD symbol in the baseline. All 77 reach the retained
endpoint. Frozen rankings select candidates 16, 60 and 73, each shortening one
match from 12 bytes to 11. The exact domain, every score, source mappings and
native verification are in [source_search/REPORT.md](source_search/REPORT.md).

The separately labeled exploratory candidate 1 restores an observed source space
to 0x20 where the baseline had substituted NUL. It changes assembled bit 10,062,
reparses bits 10,059–10,320 from 16 instructions into 18, and emits 21 more bytes.
Subsequent source instructions agree again. The old token-644 witness is absent
from that local parse; many later witnesses remain. Its 32,770 block tokens
depart from the baseline's 32,768 pattern, which had itself been used in repair
selection. Retained endpoints and compatible Huffman tables are not unique
identifiers of the original parse.

The CR arm moves one inserted byte 13 by ±1…8, ±16 or ±32 prepared-source positions
within the same first-half domain. It preserves captured bytes, selected NUL
choices, insertion count, headers and endpoints. Of 1,758 alternatives, 1,752
reach the endpoint and six fail. Five enter the frozen shortlist. See
[cr_search/README.md](cr_search/README.md) and its
[complete table](cr_search/all_candidates.csv).

Both shortlists were frozen using first-half diagnostics before later-block
evaluation. Later source is untouched, but its decoded history can change;
continuation is not statistically independent validation. No image score
selected a candidate. Candidate 1 remains exploratory, separate from the
rate-based shortlist.

## Why raw counts and difference images mislead

Changing copied history changes which endpoints are resolved from literals.
Raw witness totals mix changes in behavior and coverage. The follow-up audit
pairs identical source instructions and requires both endpoint bytes to be known
in both decodes:

| Alternative | Common-known tests in blocks 2–4 | Equal endpoints, baseline → alternative | Cheaper pairs, baseline → alternative |
| --- | ---: | ---: | ---: |
| CR 1244 | 49,928 | 13,829 → 13,739 | 4,380 → 4,349 |
| CR 425 | 52,921 | 14,572 → 14,572 | 4,534 → 4,536 |
| Source 16 | 52,784 | 14,511 → 14,513 | 4,524 → 4,525 |
| Exploratory source 1 | 53,793 | 14,787 → 14,787 | 4,577 → 4,577 |

Comparisons are meaningful within a row; populations differ between rows.
CR 1244 retains a modest diagnostic improvement. That does not calibrate its
probability of being the historical repair. Source 1 is neutral on the common
later set despite changing the earliest witness.

The exact shared compressed-token boundary also establishes output displacement
without optimizing an image alignment:

| Alternative | Displacement | Whole-overlap same-index differences | Registered nominal differences after resynchronization |
| --- | ---: | ---: | ---: |
| Exploratory source 1 | +21 bytes | 4,982,209 | 6,798 |
| CR 1244 | +2 bytes | 4,461,130 | 167,486 |
| CR 425 | −68 bytes | 5,322,164 | 72,281 |

The final column omits the locally reparsed interval and uses a nominal zero
dictionary. It is not a repaired-byte count or a whole-file edit distance.
Only 58 of source 1's registered differing positions have values known under
both interpretations.

All nine candidates' last symbolic disagreement is at baseline byte 2,193,545.
At byte 2,226,314, an entire 32,768-byte history window is equal. The remaining
instruction suffix is verified identical, proving continued aligned equality.
This byte-stream result does not recover filter state or image geometry.
The proof replay, 180 per-block rows and full common-known comparisons are in
the [propagation audit](propagation/README.md).

## What remains open

This pass establishes non-uniqueness of local repairs and limits how far these
particular alternatives change the payload. It supplies no verified original
colors or recovered PNG header. The stripe's persistence across these
alternatives does not identify the original content or its processing.

Further source-restoration work can investigate joint, source-compatible
reparsing across later blocks, with explicit damage costs and comparisons on
the same known instructions. It needs constraints capable of distinguishing
repairs beyond local score improvements. These bounded single-edit experiments
do not exhaust that space or justify declaring the RGB data permanently lost.

## Reproduce and continue

Node 24, a C++17 compiler, Python 3 and Pillow are sufficient:

```bash
bash research/2026-10-20/reproduce.sh
```

Programs, frozen protocols, exact selected repair changes, complete score tables,
proof records and review PNGs are preserved here. Large deterministic payloads,
ancestry arrays and intermediate renderings regenerate under ignored
`research/2026-10-20/cache/`. The two large CR records are saved losslessly as
gzip archives with uncompressed hashes. `deliverables.sha256` covers this pass's
committed artifacts. The original inputs and application remain unchanged.

## Format references

- [RFC 1951](https://www.rfc-editor.org/rfc/rfc1951): DEFLATE symbols,
  length/distance copies and block coding. Decoder legality does not identify
  the historical compressor or repair choices.
- [PNG filter specification](https://www.w3.org/TR/png-3/#9Filters): fixed
  inverse-filter views implement candidate byte predictions; their application
  to this capture has not been authenticated.
