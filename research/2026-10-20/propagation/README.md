# Registered propagation of frozen source candidates

## Main result

All five CR-relocation candidates and all four source-bit candidates eventually
produce **exactly the same aligned suffix as the baseline**. The last possible
dictionary-dependent difference is at baseline byte **2,193,545**, in block 7.
Every one of the final **9,585,906 bytes** is equal after accounting for the exact
output displacement. At baseline output position **2,226,314**, the complete
32,768-byte LZ history windows are equal as literal values or identical incoming
dictionary expressions. The verified identical instruction suffix then preserves
that equality.

This substantially changes the interpretation of millions of previously reported
same-index differences: most are displacement rather than altered later data.
The candidates still differ in their early output and remain unverified source
interpretations. No image alignment, filter state, geometry, or authenticity is
inferred here.

## Method and reproduction

From the repository root:

```bash
node research/2026-10-20/propagation/audit.mjs
```

Prerequisites are the baseline exporter and the frozen CR/source-search
verification caches. Their original reproduction commands are documented in
their respective directories. The script only reads those artifacts and writes
inside this directory and `cache/propagation/`; it performs no search or selection.

For each candidate, the recorded shared source-token boundary is independently
located in the codec replay. Every remaining instruction is checked against the
baseline by stream-bit start/end, LL symbol, length, distance, distance symbol,
block, and constant output displacement. Cached bytes and origins must exactly
match that replay. All headers and retained block endpoints must match too.

If the boundary emits at baseline position `p` and candidate position `p+d`,
subsequent comparisons use `baseline[i]` against `candidate[i+d]`. These are
compressed-source token coordinates, not an optimized visual registration.

The shared incoming dictionary consists of 32,768 arbitrary byte variables.
A decoded output expression is either a known literal value or one negative
dictionary-slot identity. Two known values or two identical dictionary identities
are equal for every shared dictionary. Different dictionary identities are
unresolved, not necessarily unequal.

## Displacement versus changed values

The same-index column covers the whole overlapping payload, reproducing the
earlier reporting convention. Registered counts cover only the suffix beginning
at the shared token boundary and omit the locally reparsed span. They are not
whole-file edit distances, repaired-byte counts, or pixel counts.

| Candidate | Exact displacement | Shared boundary, baseline byte | Same-index unequal | Registered nominal unequal | Registered unequal, both known |
|---|---:|---:|---:|---:|---:|
| CR1244 | +2 | 116,564 | 4,461,130 | 167,486 | 23,340 |
| CR1552 | +20 | 138,405 | 4,943,684 | 139,017 | 30,432 |
| CR425 | −68 | 49,228 | 5,322,164 | 72,281 | 2,500 |
| CR421 | −68 | 49,228 | 5,322,244 | 72,281 | 2,494 |
| CR780 | −49 | 75,625 | 5,194,568 | 79,284 | 9,140 |
| Source16 | −1 | 52,684 | 4,289,695 | 53,040 | 11,264 |
| Source60 | −1 | 121,732 | 4,255,449 | 148,462 | 41,351 |
| Source73 | −1 | 137,396 | 4,247,085 | 150,429 | 40,495 |
| Source1 | +21 | 5,628 | 4,982,209 | 6,798 | 58 |

“Nominal” uses the baseline zero dictionary. “Both known” means both selected
decodes derive the value from a literal rather than the missing incoming history;
it does not authenticate that literal or the selected token framing.

The last nominal unequal position can precede the last symbolic disagreement.
For example, Source1 has no nominal differences beyond byte 760,767, but different
unknown dictionary-slot identities persist through byte 2,193,545. Equal zero
placeholders alone would miss those unresolved differences.

## B2–4 diagnostics on the same observable instructions

Changing copied history can change which endpoint tests have two known values.
Raw witness totals therefore mix changed behavior with changed coverage. The table
below pairs unchanged instructions by source-bit position and restricts each pair
to tokens for which both endpoint bytes are known in **both** decodes.

The common population is candidate-specific. Baseline counts consequently differ
between rows. Comparisons are meaningful within a row, not across denominators.

| Candidate | Common-known endpoint tests | Endpoint equalities, baseline → candidate | Cheaper absorptions, baseline → candidate |
|---|---:|---:|---:|
| CR1244 | 49,928 | 13,829 → 13,739 | 4,380 → 4,349 |
| CR1552 | 49,956 | 13,741 → 13,700 | 4,355 → 4,366 |
| CR425 | 52,921 | 14,572 → 14,572 | 4,534 → 4,536 |
| CR421 | 52,921 | 14,572 → 14,572 | 4,534 → 4,536 |
| CR780 | 51,380 | 14,250 → 14,237 | 4,473 → 4,480 |
| Source16 | 52,784 | 14,511 → 14,513 | 4,524 → 4,525 |
| Source60 | 51,066 | 14,058 → 14,060 | 4,436 → 4,464 |
| Source73 | 50,709 | 13,986 → 13,975 | 4,417 → 4,442 |
| Source1 | 53,793 | 14,787 → 14,787 | 4,577 → 4,577 |

Thus the raw endpoint increases for Source60/73 largely reflect coverage; their
cheaper-absorption counts nevertheless increase modestly on the common set.
CR1244 decreases both counts on its common set. Source1 is exactly unchanged on
its common set. None of these comparisons authenticates a repair or calibrates
the probability that the original bytes have been recovered.

Eligibility matches the frozen scorer: exclude the first/final data token per
block and matches of length 258. A cheaper absorption requires the next token to
be a literal and the retained codebook to encode a one-byte-longer match at a
positive bit saving; the LL symbol may change. The unchanged distance cost
cancels. The script checks eligibility and all marginal known/equality counts
against the frozen independent C++ scores; it does not rerun that scorer.

Endpoint extension is a diagnostic of the inferred ordinary-zlib behavior, not
a universal DEFLATE validity rule. Cheaper absorptions establish a local shorter
equivalent instruction sequence under the retained codebook, not the original
encoder or original data. The continuation uses altered history and is not
statistically independent validation.

## Outputs and limits

- `results.json`: complete registrations, hashes, per-block comparison counts,
  symbolic convergence evidence, and common-known endpoint diagnostics.
- `summary.json`: compact nine-candidate propagation table.
- `per_block.csv`: 180 candidate/block rows, with denominators and last differing
  zero-based baseline coordinates. Blocks 8–20 have zero registered differences.
- `common_known_endpoints.csv`: individual blocks 2–4 plus aggregate counts.
- `manifest.json`: exact input/output hashes and runtime. Paths are repository
  relative; large inputs remain in the ignored cache.

All results are conditional on the exact frozen baseline/candidate programs and
a shared incoming dictionary. The baseline retains synthetic endings in blocks
12, 13, and 20. There is no authenticated PNG framing or image state in this audit.
