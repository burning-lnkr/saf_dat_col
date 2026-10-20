# Completed format-neutral analysis of the actual SAF capture

## Result

The experiments were executed, not just proposed. No new source repair was accepted and no recognizable image was recovered. The new useful result is a separation of **local literal relationships**, **copy amplification**, and **fixed-position hypotheses**. They behave differently and cannot serve as interchangeable evidence for a file format.

No image width, PNG filter, RGB channel label, or raster coordinate is used below. The labels near and late identify fixed block groups, not untouched evidence relative to the entire historical investigation.

## Inputs and validation

- Original capture SHA-256: `53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c`.
- Header-guided output: 11,779,452 bytes; SHA-256 `bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2`.
- Combined output: 11,779,416 bytes; SHA-256 `14bbfcec0f7d5a343c0fbd26b548e63ecc93d60db8a730573ca93231249c5b0a`.
- Both were reproduced exactly by native zlib. This validates implementation agreement, not historical authenticity.
- `node tests/core.test.mjs` completed with ALL TESTS PASSED, including all 17 recorded candidates.
- Basic independent scoring checks passed: uniform tables have zero predictive gain; a fixed deterministic relation has more than four bits/value gain; a known three-step telescoping sequence sums to zero.
- Each candidate contains 153,749 literals. The conservative mask implemented in this pass retains 152,240. It excludes fields overlapping source spaces, inserted bytes, unmappable characters, synthetic bits and listed XOR edits. This is a defined local-field mask, not the same definition as every earlier report's "strict" mask, and it does not certify the preceding parse.

## Executed tests

The already committed `format_agnostic_windows.mjs` was actually run, producing 180 windows. The new profile code also measures each original compressed block, fresh literals, locally supported literals, known/unknown history ancestry and dominant literal roots.

Categorical models were fitted to blocks 1-8, compared on blocks 9-11, and evaluated without refitting on blocks 14-19. Synthetic-ended blocks 12, 13 and 20 were excluded from fitting/testing, but retained in descriptive profiles. Models include separations 1-12, a two-context separation-3 model, and phase-only models with periods 2-64, using both whole-stream and block-local coordinates. Additive smoothing is fixed at 0.5.

Twenty fixed-seed controls shuffle values inside each supported literal run. They retain all run histograms, lengths and locations; they are conditional controls, not an end-to-end damage or recompression null. Full tables include counts, not only winners. A total of 126 phase models were evaluated for each candidate.

### 1. Neighbor information survives both holdouts, but the control explains most of its apparent strength

Gain means the reduction in held-out negative log2 probability versus a marginal fitted on the same training targets. It is not a percentage of restored bytes or actual archive compression.

| Test on consecutive supported literals | Near gain, bits/value | Late gain, bits/value |
|---|---:|---:|
| Previous literal at separation 1 | 1.156942 | 1.217530 |
| Same method, mean of 20 within-run shuffles | 0.906281 | 0.989024 |
| Increment above that control mean | 0.250661 | 0.228507 |
| Previous literal at separation 2 | 0.863319 | 0.922309 |
| Same method, mean shuffled separation 2 | 0.729722 | 0.791007 |

All 20 shuffled gains are below the original gains at separations 1 and 2 in both holdouts. This establishes ordering beyond these particular histogram-preserving controls, conditional on selected literal runs. It is not a calibrated probability of a particular original format.

A post-hoc decomposition gives 0.976518/1.040138 bits of gain using only the preceding magnitude, versus 1.156942/1.217530 using its full signed value. Much of the predictive information concerns local value populations. The decomposition reuses the viewed holdouts and is descriptive rather than a new independent selection test.

### 2. Three-byte cancellation is locally supported, but cannot justify long integration

At separation three, literal correlation is -0.263320 in the near set and -0.216562 in the late set. For each qualifying run, take its first three values separated by three bytes. Define cancellation ratio as sum over runs of the squared total, divided by sum of the individual squared terms.

| Three-term test | Near | Late |
|---|---:|---:|
| Independent qualifying runs | 96 | 242 |
| Observed cancellation ratio | 0.574468 | 0.678413 |
| Mean shuffled ratio | 0.943619 | 0.922244 |
| Range across 20 shuffles | 0.737741-1.199779 | 0.779146-1.087026 |

This fits a local difference-like or anti-correlated mechanism. It does not identify three RGB components. Differences of random sequences can also cancel, and the way a compressor selects literal runs can affect this sample.

For four terms, only 16/51 runs qualify; ratios 1.072693/0.918135 fall within the control ranges. Those sparse results do not establish a stable cumulative reconstruction. No whole-stream integration was promoted on this evidence.

### 3. Fixed position labels have no useful predictive support here

For Header-guided the best near-set phase-only model is block-local period 11. Its near gain is only 0.000139 bits/value and its late gain is -0.001108. For Combined the selected model is global period 4, with 0.000100 near gain and -0.000549 late gain.

This fails to identify a useful fixed slot-dependent value distribution among periods 2-64. It does **not** rule out records with exchangeable slots, larger strides, or format changes. In particular, no preferred RGB channel identity follows from these phase tests.

### 4. Late low-diversity output is dominated by copying, not by disappearing fresh data

| Block | Output bytes | Histogram entropy, all bytes | Entropy, supported literals | Fraction descending from dominant root |
|---|---:|---:|---:|---:|
| 16 | 839,967 | 1.703213 | 3.177994 | 71.6244% |
| 19 | 2,746,557 | 1.277593 | 3.222831 | 75.9808% |
| 20, synthetic ending | 1,747,898 | 0.371073 | 3.548105 | 94.7816% |

Histogram entropy measures diversity of byte values, not meaning or the entropy rate of a dependent sequence. In B19 the supported-literal mean is -0.002358, but the all-byte mean is -3.099610. The dramatic output skew is produced by current copy ancestry. That ancestry still requires validation. This confirms and quantifies the previously observed copy floods; it is not a new recovered image.

### 5. These pure-literal tests cannot choose between the existing repairs

Header-guided and Combined have exactly identical supported literal-run contents. Consequently their lag tests, cancellation tests and all 20 permutation results are exactly identical even though their expanded data differ. The phase tests change because output positions differ.

This is a useful limit on any future repair objective: a test looking only at those unchanged runs cannot select the correct copy program.

## Follow-up actually executed: test where copies meet new literals

For 99,675 shared literal-token targets, align candidates by the target token ID, not by uncertain output coordinate. Both candidates must have a supported literal following a copied byte with a known nominal origin. Block-start crossings are excluded.

The predictor is trained on earlier pure literals. Compared on these matched targets, Combined improves the near-set score by 0.109873 bits/target, but worsens the late score by 0.006503 bits/target. The late contexts differ at only 380 of 32,715 targets. Thus the late failure is mostly shared, not a large new disagreement between the two recipes.

This is a retrospective comparison: Combined was historically selected using related local statistics. It is not a new untouched confirmation of it.

More importantly, the predictor loses rather than gains at these boundaries:

| Original Header-guided selection | Near gain | Late gain |
|---|---:|---:|
| Pure literal pairs | +1.156942 | +1.217530 |
| Copy-to-literal pairs | -0.328731 | -1.065530 |

It would be tempting to call every bad boundary a repair target. A further actual-byte control shows why that would be unsound.

## Boundary-selection calibration, also executed

Recompress the same 11,779,452 Header-guided bytes with native zlib Z_FILTERED at levels 6 and 9. Parse those native streams and verify exact replay. Refit the same predictor using each compressor's own early pure literal pairs. Evaluate its later copy-to-literal boundaries. The original zero-history descendants are excluded from these tests using the nominal original ancestry.

| Encoding/selection | Near boundary gain | Late boundary gain |
|---|---:|---:|
| Captured candidate | -0.328731 | -1.065530 |
| Native level 6 | +0.230331 | -0.230916 |
| Native level 9 | +0.268708 | -0.324760 |

Both ordinary native controls can also have negative late boundary gain. Therefore mismatch of this learned literal predictor is **not** a universal corruption rule. The original mismatch is more severe in this diagnostic, but the selected sample populations differ. This calibration does not authenticate a new edit or identify the historical encoder.

Native compressed sizes were 1,193,256 and 1,138,150 bytes respectively, both with exact output equality. Original dataset and numerical bytes were unchanged; no synthetic picture is involved.

## Practical conclusion

There is measurable local structure, and copy amplification creates much of the misleading large-scale distribution. Neither fixed slot histograms nor short integration identifies an original format. Literal-only statistics cannot discriminate the two existing repairs, and a naive extension to copy boundaries produces false corruption flags under normal recompression.

No new repaired byte stream or visual image candidate was accepted. Four plots show these actual numerical results; none is labeled restored RGB. The useful remaining target is a source-level explanation of copy/parse choices with evidence independent of this statistical score, rather than another image filter or a smoother output.

## Reproduce from this branch

```sh
python -m venv .venv
. .venv/bin/activate
python -m pip install numpy==2.3.5 matplotlib==3.10.8
node tools/export_format_neutral.mjs
node tools/format_agnostic_windows.mjs > cache/format-neutral/windows_original.json
python tools/analyze_format_neutral.py --candidate both --controls 20
python tools/format_neutral_summary.py
node tools/native_boundary_control.mjs
python tools/test_copy_boundaries.py
python tools/score_boundary_control.py
python tools/plot_format_neutral.py
node tests/core.test.mjs
```

Measured environment: Node 22.16.0, zlib 1.3.0.1-motley-780819f, Python 3.13.5, NumPy 2.3.5. Native re-encoding sizes may differ with zlib version; the independent decoding equality remains the required check. Full measured JSON hashes are recorded in compact_results.json. Boundary-result hashes:

- copy_boundary_results.json: `d0bb95e8788c67d707f2110d4543a38639dcf992970b3eaa85352bbbb60631fe`
- boundary_calibration.json: `b519c82e2015a1a92e74783fe601bd3959a4b7db13cb82dced234e403884e8f7`

Git contains the scripts, frozen protocol, compact measured tables and this report. Full deterministic JSON tables and PNG/SVG plots are also supplied in the downloadable result bundle. Cache arrays are regenerable from the source data already present in the repository. Do not interpret the masks as proofs over every source-compatible parse.
