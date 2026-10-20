# Executed-analysis protocol, fixed before fitting

Input: original_headerguided and original_combined, decoded with the repository codec and independently verified with native zlib. Export code: tools/export_format_neutral.mjs. No raster dimensions, PNG markers, or RGB labels are used.

1. Execute the previously committed 65536-byte window analysis. Extend it with actual block ranges, fresh literals, locally supported literals, original literal ancestry, and history-dependent fractions.
2. Train categorical prediction models on blocks 1-8. Evaluate unchanged models on blocks 9-11 (near holdout) and 14-19 (later holdout). Exclude synthetic-ended blocks 12,13,20 from model fitting and testing. Later output may inherit copies, so the predictive test uses only consecutive runs of locally supported literal fields. Local support does not authenticate upstream framing.
3. Compare an unconditional 21-value model against previous-value models at separations 1..12, a two-context model at separation 3 (positions t-3,t-6), and a phase-only model with periods 2..64. All use a fixed additive count of 0.5; candidate ranking uses near holdout, later holdout is reported without further fitting. Score is improvement in negative log2 likelihood per held-out value relative to the marginal trained on the same targets. Report sample counts; no calibrated original-format probabilities.
4. For relationship models use 20 fixed-seed within-run permutations. This preserves every run's exact histogram and all positions/run lengths, but breaks local ordering. It is a conditional control, not a complete recompression-selection control.
5. Test cumulative sums along each of 1..6 possible interleaved subsequences within complete literal runs. Compare span and endpoint variance with the same permutations for short, fixed-length windows. No modulo-256 wrap or inferred image boundaries. This tests first-difference-like local cancellation, not object recognition.
6. Report model and profile sensitivity across the two retained candidates. They share literal values; agreement is not independent corroboration.
7. Save JSON/CSV outputs, exact methods, hashes, and diagnostics. Prefer profiles on linear output offsets or block-relative positions; any exploratory fold is expressly not a recovered image.

Stop rule: do not declare a format or a corrected source from lower statistical loss alone. A model must make a distinct withheld prediction, and its scope and remaining parsing dependence must be explicit. No new source edits are selected by visual smoothness in this experiment.
