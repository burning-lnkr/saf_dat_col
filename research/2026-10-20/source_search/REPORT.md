# Actual-source reparsing beyond distance operands

## Outcome

The recovered repository permits a concrete source-supported alternative that the old fixed-token distance search could not represent. Reinterpreting one captured space at block 1 prepared byte 1,256 as space instead of NUL changes the **DD Huffman symbol**, reparses a 261-bit interval from 16 instructions into 18, and removes the old earliest endpoint/cheaper-literal witness at bit10,110. It reaches the **same captured block endpoint**, preserves every header, and still regenerates the same historical zlib LL/DD code lengths from its changed token frequencies.

This is candidate **1**, an explicitly exploratory structural example. It is not selected by the preregistered average-rate metrics and its overall counts worsen. It demonstrates non-uniqueness of the source interpretation, not recovery of the original payload.

The frozen rate-based shortlist consists of three single length-extra flips, candidates 16,60,73. They improve some first-half diagnostics; their untouched-source continuation is mixed and their amount of known history changes. No candidate is authenticated as a repair, and no pixel or visual score was used.

## 1. Frozen domain and provenance

Baseline: `data/original_headerguided.json`, freshly reconstructed from the repository's exact `data/saf_dat_col.utf8.bin`. The source SHA-256 is `53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c`; the baseline decoded payload SHA-256 is `bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2`.

The retained block 1 body is stream bits 337..497,370, end-exclusive. The fixed training cut is bit 248,853, the floored midpoint. The candidate domain enumerates every ambiguous source-space bit in the first half that touches an LL Huffman symbol, length extra, or DD Huffman symbol in the baseline parse. It excludes distance-extra-only bits, headers, inserted bytes, synthetic endings, and non-space source bytes.

| Baseline field | Enumerated single flips |
|---|---:|
| LL Huffman symbol | 16 |
| Length extra bits | 16 |
| DD Huffman symbol | 45 |
| **Total tested alternatives** | **77** |
| Distance-extra-only ambiguities, deliberately excluded | 147 |

Every eligible source coordinate is checked against an actual uploaded byte 0x20 and against `sourceAtBit`. All 77 alternatives plus identity parse to the unchanged EOB endpoint. Their data instruction counts need not match the baseline: token-count changes across the complete sweep range from−7 to+6. Every result is retained, including candidates that score worse.

`protocol.json` fixes the domain and ranking before scores. The selected set is the union of best 2 cheaper-absorption rates, best 2 endpoint-equality rates, and best 1 same-length-symbol absorption rate, using only first-half data. Ties prefer the smaller absolute output-length change, then the smaller source bit. Frozen selectors choose IDs 60/73,16/73, and73, respectively. Identity is retained separately.

The first block's second source half and blocks 2–4 are untouched-source continuation checks. They are **not statistically independent validation data**, because changed earlier history can alter their decoded output. No continuation result was used to replace the frozen shortlist. Candidate 1 was separately frozen for frontier inspection after the initial sweep and before its later-block/native verification; that exploratory choice is labeled throughout.

## 2. What was scored

The independent C++ decoder starts with 32,768 distinct unknown initial-dictionary tags. Literals are known values 0..255. Copies preserve exact tags. Matching tags prove equality without choosing dictionary values; different unknown tags remain unresolved.

The endpoint diagnostic counts a nonfirst, nonterminal match shorter than 258 when its next output byte equals the next byte at its selected source. This is an ordinary-zlib hypothesis, not a DEFLATE requirement. The more selective cost diagnostic counts a match followed by a literal that could be replaced by an L+1 match at the same distance for fewer bits under the retained header. A subset keeps the same length symbol. These diagnostics do not establish the encoder or the image format.

Every candidate must reach EOB at the original retained endpoint, remain within available history, and remain below the bounded output ceiling. The scorer records counts, known-byte coverage, unresolved comparisons, token/output changes, first witnesses, and LL/DD frequency arrays. The generic `P` patch interface additionally serves the separate CR arm, whose source mapping is its caller's responsibility.

The output-cap check initially covered match emission only. Independent review identified the literal-path omission; it was fixed and the binary rebuilt. Rerunning all 78 cases gave byte-identical score output. `implementation_fix_validation.json` records that check. The C++ scorer deliberately trusts header metadata; candidate generation and full independent replay enforce the unchanged-header condition.

## 3. Frozen shortlist and exploratory alternative

| ID | Selection role | Stream bit | Prepared-byte change in block 1 | Decoding change | Block1 token delta | Output-byte delta |
|---|---|---:|---|---|---:|---:|
| 16 | Best endpoint rate | 82,998 | Add 10,351 to `nul` | Token 5,459:L12→11; same symbol/distance | 0 | −1 |
| 60 | Best cheaper-pair rate | 192,734 | Add 24,025 to `nul` | Token 12,687:L12→11; same symbol/distance | 0 | −1 |
| 73 | Best same-symbol rate; other shortlists | 219,246 | Add 27,329 to `nul` | Token 14,442:L12→11; same symbol/distance | 0 | −1 |
| 1 | Exploratory earliest-witness alternative | 10,062 | Remove 1,256 from `nul` | DD-symbol change and local reparse | +2 | +21 |

For candidate 1 the uploaded source coordinate is byte 96,107, observed value 0x20. The baseline had interpreted this space as NUL. The alternate returns it to space, equivalent to flipping assembled stream bit 10,062. It changes the first affected match's distance 13405→2607 and its encoded end 10,077→10,076, shifting the following Huffman parse. The streams resynchronize at source bit 10,320:

- Original tokens 641..656 consume those source bits and emit 149 bytes, positions5,479..5,627.
- Alternate tokens 641..658 emit 170 bytes, positions5,479..5,648.
- All subsequent source instructions agree again, with a 21-byte output-position offset.

The original token 644 `(L12,D2273)` and following literal 7 are no longer the instructions represented by that interval. The first endpoint witness moves 10,110→12,488; the first cheaper-literal witness moves 10,110→39,237. The candidate still has many later witnesses. Its 32,770 total block tokens also depart from the baseline's32,768-token pattern, even though regenerated LL/DD trees remain exactly compatible. Captured endpoint and tree compatibility do not uniquely determine the token parse.

## 4. Continuation results

The following are counts on the specified fixed regions, not an image-quality metric. Tested-match denominators are 12,279 in training (12,278 for candidate 1),12,102 in the second half, and72,348 across blocks 2–4.

### Strictly cheaper match-plus-literal pairs

| Candidate | Training first half | Untouched second half | Untouched blocks 2–4 |
|---|---:|---:|---:|
| Baseline | 157 | 445 | 4,577 |
| 16 | 155 | 447 | 4,605 |
| 60 | 140 | 429 | 4,668 |
| 73 | 140 | 427 | 4,656 |
| Exploratory 1 | 168 | 449 | 4,585 |

### Dictionary-independent equal endpoints

| Candidate | Training first half | Untouched second half | Untouched blocks 2–4 |
|---|---:|---:|---:|
| Baseline | 394 | 994 | 14,907 |
| 16 | 381 | 999 | 14,984 |
| 60 | 384 | 1,002 | 15,030 |
| 73 | 382 | 992 | 14,993 |
| Exploratory 1 | 413 | 1,004 | 14,945 |

Known output is also different. Across blocks 2–4, baseline has 944,904 known bytes out of 1,104,175, versus 949,838 for 16, 970,469 for 60, 968,185 for 73, and 947,162 for 1. Training known bytes increase for every selected candidate. Therefore a raw equality-count increase can partly reflect more resolved history; it must not be presented as a controlled comparison over identical observable constraints. Full known-endpoint and unresolved-comparison denominators appear in `summary.json` and `verification_summary.json`. The separate propagation audit can compare common-observable source instructions without changing this selection.

The independent propagation audit subsequently compared the same source instructions only where both endpoint bytes were known under both candidates. On this common-observable subset of blocks 2–4:

| Candidate | Comparable endpoints | Baseline → candidate equal endpoints | Baseline → candidate cheaper pairs |
|---|---:|---:|---:|
| 16 | 52,784 | 14,511 → 14,513 | 4,524 → 4,525 |
| 60 | 51,066 | 14,058 → 14,060 | 4,436 → 4,464 |
| 73 | 50,709 | 13,986 → 13,975 | 4,417 → 4,442 |
| Exploratory 1 | 53,793 | 14,787 → 14,787 | 4,577 → 4,577 |

The comparison sets differ between rows. These results confirm that much of the raw endpoint-count growth comes from changed observability. They also show modest common-observable cheaper-pair regressions for 60 and 73; the structural alternative is neutral on its observable later subset. This is a separate check from the frozen selection, recorded in `../propagation/results.json` and `../propagation/common_known_endpoints.csv`.

The same audit reports that these candidate histories become symbolically identical to the baseline after output position 2,193,545 when aligned at the shared source-token boundaries. The final 9,585,906 aligned bytes are identical for any shared initial dictionary. For candidate 1, the +21-byte displacement creates 4,982,209 same-index differences, but only 6,798 nominal byte differences remain after source-token registration; only 58 of those differing registered positions are known under both interpretations. Raw same-index difference images would therefore greatly exaggerate its actual payload change.

The current results do not supply a clear source-authentication or recovery success. In particular candidate 1's earlier frontier improvement does not persist as an improved aggregate score. This is why the alternative is preserved as a structural example rather than promoted as the best restoration.

## 5. Independent verification and source faithfulness

Every shortlisted candidate and candidate 1 was fully rebuilt using `js/codec.js` from the exact repository source and a one-entry `recipe.blocks[0].nul` toggle. The resulting wire is exactly the baseline wire with the single declared bit flipped. Headers, prepared source ranges, retained endpoints, CR placements, all other NUL choices, and all other physical bits agree.

The repository decoder and native zlib agree on the full output under both zero 32 KiB and a nonconstant 0..255 cyclic dictionary. Independent C++ first-four-block bytes, all initial-dictionary tags, and every reported score field agree with the repository decode. Blocks2–20 retain identical source token fields and bit boundaries; their output starts differ only by the candidate's block 1 length delta. Their bytes may differ through changed LZ history, which is explicitly retained in the provenance.

Historical zlib LL/DD trees were actually regenerated from each verified candidate's emitted frequency arrays. All selected candidates, candidate 1, and baseline match the retained tables in blocks 1–4. This is conditional encoder compatibility, not a validity requirement or proof of originality; it was not a shortlist gate.

The complete hashes, exact old/new local token spans, metrics, and checks are in `verification_summary.json`. Each tracked recipe has a computed expected payload hash for reproducible replay, not an authentication claim.

## 6. Deliverables and limits

This bounded arm demonstrates a source-compatible parse change beyond distance-extra operands and records a small, reproducible set of competing actual payloads. The old fixed-token proof does not apply automatically to the reparsed interval. Conversely, merely removing its witness does not validate the alternative.

No header search, arbitrary operand remapping, pixel editing, predictor optimization, or visual selection was performed. Initial history remains unknown. Nonselected distance ambiguities remain at baseline choices; no new all-distance invariant proof is claimed. The source damage model still assumes the relevant captured spaces can represent original NUL or space. Full payloads include the inherited synthetic endings in blocks 12, 13, 20.

Recipes/deltas and reports are tracked under this directory. Regenerable full payloads and origins are ignored under `research/2026-10-20/cache/source_search/candidate_ID/`. Root owns any visualization, commit, or push. The application and original data are unchanged.
