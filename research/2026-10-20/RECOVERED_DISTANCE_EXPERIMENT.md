# Recovered experiment: global distance-operand transformations

This is a durable summary of the *actual-data* experiment recovered from the previously generated `actual-capture-audit-results.zip` in the conversation workspace. It is not a newly authenticated RGB restoration.

## Frozen test
70 transformations of DEFLATE distance extra bits, including identity, complement, reversal, rotations, Gray-code operations, modular offsets, negation and four predetermined affine controls. Original literal symbols, length symbols, token endpoints and output length were held fixed. Fit: blocks 1–11; continuation check: blocks 14–19. Synthetic-ended blocks 12, 13, 20 excluded from main selection/holdout.

## Selected results
| Transform | Early native exact | Held native exact | Held nearer-word contradictions |
| --- | ---: | ---: | ---: |
| Identity | 43.67% | 54.51% | 19,730 |
| Complement | 56.70% | 58.31% | 27,134 |
| Modular negation | 55.68% | 59.43% | 27,302 |
| Predetermined affine control 2718 | 55.67% | 55.02% | 26,767 |

The unrelated affine control gains almost as much as the proposed transformations. Complement/negation also *increase* nearer-match contradictions and window-limit violations. No global distance transform was accepted as a source repair.

## Scope
The tests preserve the chosen Huffman symbols, lengths, and token boundaries, so they do not test the source-compatible reparsing alternatives discussed later. The incoming history and PNG interpretation remain unresolved. Recompression scores are diagnostic, not ground truth.

## Recovery provenance
Original generated report: `analysis_distance_transform/REPORT.md` in `actual-capture-audit-results.zip`. Source repository data and hash identities are recorded in this branch's `README.md`. This commit preserves the key results so they survive expiration of the conversation workspace.
