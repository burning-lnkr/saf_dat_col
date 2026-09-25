# SAF byte workbench

Static, in-browser reconstruction and rendering of the supplied SAF data. Open `index.html` through a static server, or use the companion standalone HTML. Source bytes, repair recipes, and the small literal-transition model are bundled locally.

## Publish on GitHub Pages

Put this folder's **contents** in a repository so `index.html` is at its root. Keep `.nojekyll`. In **Settings → Pages**, choose **Deploy from a branch**, select your branch and **/(root)**, and save. All application paths are relative, including the worker and offline cache, so repository subpaths work.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

The runtime needs no package installation, server-side code, API keys, CDN, or build service. Publishing also makes the two bundled source inputs public.

For a local multi-file preview:

```sh
python -m http.server 8000
# Open http://localhost:8000
```

For a single file, run:

```sh
python tools/build_standalone.py ../saf-byte-workbench.html
```

The generated HTML embeds source binaries, recipes and code. Open it directly in a browser or rename it to `index.html` for one-file hosting. The multi-file version caches its runtime and datasets after the first successful load. Increment the cache version in `sw.js` when publishing changed runtime files.

## Default view

| Parameter | Default |
|---|---|
| Input / repair | Original / Combined · v5 |
| Decoded payload | 11,779,416 bytes |
| Width / row stride | 5,000 pixels / 15,001 bytes |
| Row prefix / components | 1 byte / 3 interleaved components |
| Samples | Unsigned 8-bit, interpreted as signed residuals for magnitude |
| Classifier | Magnitude 7 → 255; magnitude 4 → 60; other → 0 |
| Component reduction | Arithmetic mean, floored to an 8-bit result |
| Inverse filter / spatial average | Off / 1 × 1 |
| Row repetition | 10, nearest-neighbor |
| Native / exported repeated image | 5,000 × 785 / 5,000 × 7,850 |

The native RGBA pixels match the earlier `original_combined/residual_7_vs_4_native.png`. PNG export repeats each source row exactly ten times. Fit width changes only the canvas's display size. No PNGs, rendered image arrays, or decompressed candidate payloads are included as runtime assets.

## Controls

**Input.** Original and community source selectors; 17 recorded candidates spanning v3–v5. Original offers Combined, Copy context, Length anchors, Header-guided, Run-averse, Distance-zero, Length-zero, Islands excision, Conservative and More-CR. Community offers the first seven. `Edit recipe` exposes the full recipe or one block at a time.

**Layout.** Width, components, byte stride, row-prefix size, output offset, crop rows, partial-row policy, interleaved or per-row planar packing, 8-bit, 16-bit LE/BE, and packed 1/2/4-bit samples. `Scan row phase` tests all offsets in a stride against the 0–4 row-marker rule, and lists the twelve smallest violation counts.

**Mapping.** Editable two-value classifier; signed magnitude; signed centered values; raw grayscale/RGB; separate-channel residuals; zero fraction; common remainders and modulus families; literal/copy/history selection; block, length, distance and origin views. Component indices and reduction are editable. Shared-remainder pixels use nonidentical component tuples whose origins are independent of the substituted DEFLATE seed. Transparent locations represent absent observations.

**Decode & repair.** Browse raw sources, single-byte inverse, a raw DEFLATE prefix, local byte files, or LZW. Set source offset/bit, dictionary size and repeating seed, load a dictionary, reset history at named blocks, change ambiguous length/distance extra bits, sample seeded alternatives, and apply explicit stream-bit/byte patches. Output has a configurable memory ceiling.

**Live copy-context search.** Enumerates source-compatible distance-extra-bit alternatives while inflating. Context size, edit cost, affected block range, training block range and three prior strengths are editable. Choose the bundled v5 model or train a fresh model from the current candidate's field-unambiguous literals. The frozen-model defaults reproduce v5 Copy context when starting from Header-guided. Recorded presets replay selected historical repair paths; the live search explores distance alternatives within the current token structure.

**Filters.** None, Sub, Up, Average, Paeth, or actual row-marker selection. Set marker location, bytes-per-pixel predictor step, invalid-marker fallback, previous-row seed pattern, reset period and per-row overrides. Rows preceding a crop are reconstructed first. Filtering is bytewise, including 16-bit sample layouts.

**Display.** Contrast, brightness, gamma, inversion, flips, transpose, optional spatial averaging, integer row repetition, row drift, editable piecewise shifts and a brightness-path tracer. Shifting can expand the canvas or wrap. All are separate from the compressed-stream repair settings.

**LZW probe.** Edit the conditional hex prefix, or select a source region with single-byte/UTF-8 interpretation. Change minimum/maximum code size, bit order, early-change convention and initial-clear requirement. `Open index view` displays the resulting indices with editable row dimensions.

## Inspection and sharing

Point at a pixel to see decoded bytes, signed values, remainders, its emitting token and the compressed-source coordinates. Click to pin the inspector. The literal-origin record traces LZ77 copies backwards. Eligible extra-bit buttons toggle one ambiguity bit and decode again. For 16-bit and packed layouts the inspector reports underlying byte locations.

`Pin A` stores the current browser-rendered reference. A/B has synchronized scrolling; Δ compares corresponding displayed coordinates. Ctrl/Command + wheel zooms; drag pans. The block table links to output regions. The histogram reports underlying decoded-byte values in the selected raster window.

`Export` writes PNG at native or repeated-row resolution, decoded bytes, the current compressed stream, exact input bytes, token CSV or the repair ledger. PNG metadata contains settings and the current payload SHA-256. `Save setup` also includes uploaded dictionary and local input bytes. `Copy link` encodes compact settings in the URL fragment; large or local-data setups are shared as JSON instead.

Stream files reflect compressed-bit changes. History-reset and literal-lineage replacement experiments are additional decoder/output settings, so preserve their setup JSON with an export. The recipe hash badge compares the decoded bytes against the recorded candidate; it does not assert recovered-source authenticity.

## Repair recipe coordinates

Indices are zero-based; ranges are end-exclusive; bit positions are LSB-first.

- `source`: original or community preparation.
- `removals`: removed original-inverse byte spans.
- `headers`: original-inverse block starts (`byte`, `bit`), local `[position, old, new]` header-byte patches and optional missing-CR insertion position.
- `blocks[n].nul`: prepared-byte locations interpreted as NUL rather than space.
- `blocks[n].cr`: insert CR before these prepared-byte positions.
- `blocks[n].end`: retained bit endpoint before body-CR insertions; `eob` indicates a retained source end symbol.
- `lastEnd`: end of the last source capture in original-inverse coordinates.
- `xor`: extra-bit toggles applied after the reconstructed block stream is assembled.

The Stream patches field acts on the assembled compressed stream:

```json
{"xorBits": [123456], "setBytes": [[17000, 13]]}
```

The indices above are illustrative. The pixel inspector supplies actual token/bit coordinates. Edit block header positions or retained endpoints through the recipe editor to investigate different boundaries.

## Data and reproducibility

`data/saf_dat_col.utf8.bin` is the exact original upload (1,986,163 bytes):

```
53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c
```

`data/community.bin` is the exact extracted `2 gibberish fixed.txt` member (1,249,229 bytes):

```
f405ba37a341437635a94e91c5bc29fdcd7d0d5265c4ce30a9bbfa829ceb9746
```

`data/index.json` records every candidate's expected payload hash and the source-coordinate map. The browser verifies input hashes, reconstructs compressed bits from the source and JSON decisions, and inflates the result in a worker. `data/trigram.f32` is a 21³ float32 log-probability model for signed literal values −10…10, not an image or candidate payload.

The interpretation retains the recovery project's uncertainties: original history is unknown; the default substitutes a zero dictionary; blocks 12, 13 and 20 have synthetic endings; the raster framing is a hypothesis. The common-remainder representation and 18-byte LZW prefix are conditional measurements of these candidates.

Run the dependency-free decoder/rendering tests with **Node.js 20 or later**:

```sh
npm test
# Or: node tests/core.test.mjs
```

The suite reconstructs all 17 recorded payloads and compares them to independent standard-zlib inflation. It checks six v5 native RGBA reference hashes, synthetic stored/fixed/dynamic DEFLATE streams, dictionaries, five PNG filters, crop continuity, repeated-row PNG export, the conditional 68-index LZW prefix, and live copy-context replay. Recorded results are in `tests/validation.json`; browser test results are in `tests/browser_validation.json`.

`tests/browser.test.py` provides optional Playwright/Pillow/NumPy UI tests for the generated standalone page. Build the standalone file, then run `python tests/browser.test.py ../saf-byte-workbench.html` (optionally `--chromium /path/to/chromium`). The delivered app itself has no Python or Node runtime dependency.

`examples/` contains compact setups for the default, More-CR alternative, shared remainders, fresh-literal magnitudes, row-marker filters, extra-bit probes, live copy-context search and the prior 65–245-row piecewise fit. Load them with **Open setup**.

## Files

`js/codec.js` handles source reversal, repair replay, DEFLATE, provenance and LZW. `js/render.js` maps decoded bytes to RGBA. `js/png.js` writes PNG through the browser's `CompressionStream`. `js/worker.js` owns decoding/cache/export state. `js/app.js` owns controls, inspection and comparison. `sw.js` supplies static offline caching. `tools/build_standalone.py` bundles these into one HTML file.

Code is MIT licensed; source data and inherited research artifacts retain their existing rights. See `LICENSE`.
