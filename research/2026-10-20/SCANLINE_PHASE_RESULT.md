# Actual-capture held-out PNG row-marker probe

Ran `node tools/scanline_phase_probe.mjs` on the recovered Header-guided nominal 11,779,452-byte decode.

## Protocol
For widths 4800 through 5200, assumed RGB8 scanline stride = 3*width+1. Search phase positions in steps of three, choosing the phase with the most byte values in [0,4] among the first half of the nominal rows. Freeze that phase and score the second half. This is a **test of a specific framing model**, not a recovered PNG header. The source repair and initial dictionary remain provisional.

## Results
- Width 5000, stride 15001, selected phase 12009: first-half legal-marker fraction **0.635204**, second-half **0.132316**.
- Best held-out width in the tested grid: **4937**, stride 14812, phase 12123: train **0.602015**, test **0.208543**.
- Second: width **5042**, stride 15127, phase 4128: train **0.598972**, test **0.200514**.
- Entire decoded stream legal-byte fraction **0.336466**; first half **0.514023**, second half **0.158910**.

**Crucial correction:** The uniform-random 5/256 benchmark is inappropriate here: the nominal decoded bytes are extremely nonuniform and copied. The global and half-specific empirical rates above are the relevant basic controls. Even the highest held-out fraction is nowhere near the 100% expected for true, correctly framed PNG filter markers. The apparent 60% training success collapses out of sample, which is consistent with overfitting to repetitive data and/or source/layout changes. This does not exclude widths outside the tested range or another raster format, nor prove the original image was noise.

## Reproduction
Run `node tools/scanline_phase_probe.mjs` from repository root. No synthetic end-marker or placeholder bytes are authenticated by this test. Results must not be interpreted as recovered pixels.
