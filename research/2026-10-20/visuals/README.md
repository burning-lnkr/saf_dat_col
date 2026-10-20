# Actual-data visual comparison

These images are calculated from the captured data and the documented repair
recipes. They contain no generated content or inferred objects. They are
provisional views of decoded bytes; the original PNG dimensions, filter
sequence, preceding compressed data and initial history remain unverified.

## Start here

- [Compact crop preview](fixed_crops_preview.jpg): baseline and four alternatives,
  shown as direct RGB, fixed Sub inverse and fixed Paeth inverse.

The committed JPEG is a lossy navigation preview, never an analysis input.
The full `source_interpretation_comparison.png` and `fixed_native_crops.png`
files accompany the chat response. Both regenerate from the commands below.
`previews.json` records the preview sources, encoding parameters and publication
status. The overview JPEG remains uncommitted: automatic approval review
requires explicit user approval to publish that particular image to this
public repository, even though its source bytes already exist in the repo.

The overview reduces each image to 640 pixels wide using area averaging,
then repeats those preview rows four times to make the broad stripe easier
to inspect. That display aspect is a viewing choice. The crops and the
following native PNGs retain the calculated pixel values.

## Full native PNGs

| File | Interpretation |
| --- | --- |
| `baseline_sub_rgb.png` | Before: original Header-guided recipe, fixed Sub inverse |
| `symbol_1_sub_rgb.png` | After alternative: ambiguous source bit 10062, changing local token framing |
| `cr_1244_sub_rgb.png` | After alternative: move one inserted CR seven source positions earlier |
| `baseline_magnitude_classes.png` | Baseline unsigned-byte magnitudes: 7 → 255, 4 → 60, other → 0; mean of three channels |

These full-size files are delivered with the chat response and regenerated
locally by the workflow below. They are excluded from Git after repeated large
binary-upload timeouts. The branch retains the exact source, recipes, hashes
and rendering programs, so the native pixels remain reproducible.

All full frames are **5000 × 785 pixels**, using RGB8, stride 15001, one prefix
byte, offset zero and a nominal zero-filled incoming dictionary. These are
shared hypotheses, not recovered PNG metadata. Filters are fixed by view;
they are not optimized per candidate.

The visible stripe persists. The selected RGB views still show noise and
periodic/filter-related patterns; inspection revealed no recognizable image
recovery. A different RGB rendering alone is not evidence of restoration,
because an output-length change shifts later byte positions. See the
[propagation audit](../propagation/) for comparisons registered at the exact
source-token resynchronization point.

`manifest.json` records the decoded-data hash, every render setting, and PNG
hashes. Its `published` fields identify the full-size delivered artifacts,
not files tracked in Git. These PNGs may use a different lossless compression than the
cached render output; their RGB values are checked to be identical.

## Reproduce

After running both source-search and CR-search verification:

```bash
node research/2026-10-20/visuals/render.mjs
python research/2026-10-20/visuals/contact_sheets.py
```

The scripts also recreate native versions of every panel under ignored
`research/2026-10-20/cache/visuals/`. The four native files above and both
comparison sheets are recreated alongside this README. They are already
available as the six exact PNG deliverables in the chat.
