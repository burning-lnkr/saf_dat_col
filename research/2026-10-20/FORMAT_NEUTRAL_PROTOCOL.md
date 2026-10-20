# Format-neutral interpretation — active protocol

**Working object:** a damaged text-transcoded DEFLATE-like byte stream, with twenty retained dynamic Huffman headers and an unauthenticated candidate decoded output. The decoded output is *not* assumed to be RGB, PNG residuals, or one contiguous raster.

## Evidence versus assumptions

- Evidence: source UTF-8 capture, surviving encoded characters, repeated block headers, a candidate literal alphabet dominated by signed -10..10, long LZ copy runs, and correlations in selected literal sequences.
- Unverified: 5000-pixel width, three components as RGB, one PNG filter byte per row, missing dictionary contents, block body repairs, exact decoded lengths, and historical encoder behavior.
- The previous 4800–5200 RGB8 PNG scanline phase search fails held-out filter-marker checks. It cannot by itself prove the original was non-PNG, because the candidate decode is not authenticated.

## Next tests, in order

1. **Format-agnostic window analysis:** `node tools/format_agnostic_windows.mjs > windows.json`. Use 64KiB output windows to identify changes in symbol frequencies, byte entropy, and one-/three-byte repetition, without raster coordinates. Preserve the JSON and hashes.
2. **Block-specific records:** compare directly emitted literal symbols with copied descendants and segment at actual DEFLATE block boundaries. A frequency shift in copied bytes alone may be an LZ ancestry artifact; a shift in fresh literals provides stronger evidence of source organization.
3. **Predictive rival models:** test interleaved difference sequences, planar numerical arrays, fixed-stride records, and blockwise synthetic carriers. Choose parameters on earlier independent literal runs; test later runs without refitting. Reject models that merely produce visually appealing images.
4. **Source-first repair:** revisit NUL/space symbol and length alternatives, CR placements, and Unicode erasure lengths with independently checked continuation, not PNG image coherence. Record exact source recipes and output hashes.
5. **Only then visualize:** display any statistically supported format candidate with explicit dimensions and transformation formula. No reconstructed picture should be labeled original.

## Stop conditions

- A model with no held-out predictive gain over shuffled or block-preserving controls is not a new lead.
- An edit that only changes output length or shifts alignment is not recovered content.
- The presence of magnitude bands in a chosen layout is not proof of PNG filtering.
- A syntactically valid DEFLATE stream is not proof of original compressed bytes.

This protocol supersedes image-first searches on the current Header-guided stream.
