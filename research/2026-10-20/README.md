# Source interpretation investigation — 20 October 2026

Work branch: `codex/source-interpretation-2026-10-20`.

## Restored evidence

The repository was recovered at commit
`cdb41453d0c2a61d09dcf341adb7e30762c7c2a6` after the prior transient
workspace was removed by automated maintenance. The two source identities
below match the hashes recorded in the earlier investigation:

| Input | SHA-256 |
| --- | --- |
| `data/saf_dat_col.utf8.bin` | `53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c` |
| `data/original_headerguided.json` | `5144b002d0fae178c33f265c76d76fce02addd4f6997678fbe15bcf5f2e4b83d` |

This recovers the supplied capture and the exact selected preparation. It does
not authenticate that preparation as the historical original. The incoming
DEFLATE dictionary, omitted prefix, some damage choices, and the PNG/raster
interpretation remain unresolved. Blocks 12, 13 and 20 have synthetic endings.

## Scope of this pass

1. Rebuild the Header-guided baseline and verify its output with native zlib.
2. Reproduce local dictionary-independent copy-endpoint and coding-cost
   diagnostics from the recovered data. Previous universal-over-enumerated-
   distance-domain proof files were lost; new nominal-distance measurements
   must not be mislabeled as that older proof.
3. Test source-compatible alternatives that can change retained literal,
   length, distance-symbol or local framing decisions, rather than another
   distance-extra-only optimization.
4. Require exact replay and independent continuation checks. A lower local
   score or more efficient equivalent encoding is not authentication.
5. Render distinct provisional candidates alongside the unchanged baseline,
   retaining their exact source changes and decoded hashes.

## Persistence and boundaries

Small programs, frozen experiment descriptions, complete score tables, and
selected review images are committed on this branch. Large deterministic
intermediates are regenerated under ignored `cache/` directories. The existing
application and original source inputs remain the reference for reproduction.

This checkpoint records the recovered inputs and intended tests. It makes no
claim that a new pixel reconstruction has already succeeded.
