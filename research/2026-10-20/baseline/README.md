# Reproducible Header-guided baseline

This directory exports the existing `data/original_headerguided.json` candidate
using the repository's **unchanged** `js/codec.js`. It does not repair the source,
assume an image geometry, or reproduce the lost all-distance symbolic proof.

Run with Node.js 20 or later from any working directory:

```sh
node /path/to/saf_dat_col/research/2026-10-20/baseline/export.mjs
```

No package installation is required. The repository's `package.json` supplies
ES module context. Input files are read relative to the script's repository,
not the shell's current directory. Large output arrays and complete witness
tables go to the ignored `research/2026-10-20/cache/baseline/` directory.

## Exact reproduction

| Item | Bytes | SHA-256 |
|---|---:|---|
| Original UTF-8 capture | 1,986,163 | `53cd286fce00071b7a9b75ddbcec2f285d2e893718fc1226d5cea35fa4a6cd6c` |
| Assembled raw DEFLATE | 1,200,345 | `a10005bf746a70d9339b8069e83b677372d6d42530c6e221f8aec0b634604063` |
| Nominal zero-dictionary output | 11,779,452 | `bbfb1999beabf5fada3746107f157a791d57f536876553dd8285907e1f9b60c2` |

The exporter checks these hashes and the recipe hash, independently inflates the
assembled stream through Node's native zlib, and independently replays the
exported LZ instructions to verify every literal-ancestor identity. A second
native inflate with a dictionary cycling through byte values 0–255 agrees with
the output predicted from those identities. It also independently materializes
the source-preparation stages and verifies their maps and reconstructed bits
against the existing codec.

`summary.json` records exact input, method and cache artifact hashes, runtime
versions, per-block counts and verification results. The native zlib check is a
decompression check; no claim about the original compressor or source
authenticity follows from a successful inflate.

## Cache interface

Every binary integer array is **little-endian**. Array definitions, flags and
coordinate conventions are also available in `schema.json`.

| File | Type / meaning |
|---|---|
| `stream.bin` | Reassembled raw DEFLATE, 9,602,757 meaningful LSB-first bits; final byte is padded |
| `bytes.bin` | Nominal decoded bytes with 32,768 zero bytes as incoming history |
| `origins.bin` | int32 per output byte: nonnegative literal token ID, or negative initial-history coordinate |
| `tags.bin`, `tags.i32` | Identical int32 arrays: known byte values 0–255, or distinct negative initial-history coordinates |
| `fresh.bin` | uint8 per output byte: 1 for a literal emitted directly, 0 for a copy |
| `token_start.bin`, `token_bit.bin`, `token_end.bin` | uint32 per token: output start and compressed half-open bit interval |
| `token_lbit.bin`, `token_dbit.bin` | uint32: first bit of the length or distance **extra field**, after its Huffman symbol |
| `token_symbol.bin`, `token_length.bin`, `token_distance.bin`, `token_block.bin` | uint16 per token |
| `token_lmask.bin`, `token_dmask.bin` | uint16 masks of recorded ambiguity positions inside the corresponding extra fields |
| `token_dsym.bin` | uint8 distance Huffman symbol; zero for nonmatches |
| `blocks.json` | Block boundaries, LL/DD code lengths, counts and inherited synthetic-end flags |
| `ambiguities.u32` | Sorted global stream bit coordinates of recorded observed-space bit-5 choices in retained block bodies |
| `inverse.bin` | The codec's CP1252-style single-byte inverse of the original UTF-8 capture |
| `inverse_offsets.u32` | For each inverse byte, the original UTF-8 codepoint's starting byte offset |
| `inverse_unmapped.u8` | 1 where inverse conversion substituted `?` for an unsupported codepoint, 0 otherwise |
| `parts.json` | Per-block assembly coordinates and paths to the detailed maps below |
| `manifest.json` | Cache inventory, hashes and the same core diagnostic metadata as the tracked summary |

There are **622,397 tokens**, including 20 EOB tokens; 153,749 direct literals
and 468,628 matches. A zero-length token is an EOB, not an emitted byte.
All token indices are zero-based and block numbers are one-based.

An origin/tag of `-k` means the byte at dictionary array position `32768-k`.
Equal negative tags denote the same unknown byte. Different negative tags need
not have different values. A negative tag is never equated to a known byte just
because the nominal dictionary currently supplies zero. This is why the
dictionary-independent witness count is smaller than the zero-seeded count.

### Prepared source coordinates

For each block, `source_parts/block_XX.*` contains:

- `.raw_prepared.u8`: after the header's recorded patch/insertion and source-span
  removals, **before** the block body's `nul` and `cr` recipe choices. Indices
  here are the recipe's prepared-byte coordinates.
- `.raw_map.i32`: the corresponding original-inverse coordinate; negative
  `-anchor-1` denotes a recorded header insertion with that anchor.
- `.prepared.u8`: after body CR insertions and NUL choices, before global BFINAL
  replacement and any assembled-stream XOR choices.
- `.map.i32`: original-inverse coordinate for every byte of `.prepared.u8`,
  with negative `-anchor-1` for an inserted byte.
- `.prep.u32`: mapping from `.prepared.u8` index back to the recipe coordinate
  in `.raw_prepared.u8`. A body CR and the following retained byte share this
  coordinate.
- `.flags.u8`: byte flags: 1 = body CR insertion; 2 = header CR insertion;
  4 = header byte patch; 8 = selected NUL substitution; 16 = unsupported Unicode
  codepoint in the inverse. Flag 4 labels the patched byte, not only its changed
  bits. These flags are provenance, not an authenticated-source confidence mask.

For a non-synthetic stream bit `b` in a part, the pre-assembly bit coordinate is
`q = b - part.start + part.headerBit`. Index the part's byte maps at `q >> 3`;
`q & 7` is the bit within the inverse/prepared byte. `part.sourceEnd` distinguishes
retained source bits from an appended EOB. The maps may include trailing
prepared bytes beyond that retained end.

`uploadedByte` is a **UTF-8 codepoint start**, not a promise that the inverse byte
occupies one source byte. An inverse-byte bit coordinate generally cannot be
treated as a raw UTF-8 bit coordinate. Inserted bytes have an anchor, not a
physically observed source byte. All ranges are end-exclusive.

`prepareStream()` currently represents each block's `cr` array as a `Set`.
Consequently the inherited codec does not represent repeated inserted CRs at
the same coordinate. This exporter reproduces that behavior exactly. A future
experiment that needs multiple consecutive deleted CRs must represent that
additional hypothesis explicitly; silently duplicating an entry in the existing
recipe has no effect.

### JavaScript consumer

```js
import {loadBaseline, sourceAtStreamBit} from './io.mjs';
const b = loadBaseline();
console.log(b.tokens.n, b.bits, sourceAtStreamBit(b, b.tokens.bit[644]));
// For token-only work: loadBaseline({sourceMaps:false, payload:false}).
```

Use an import path relative to the consumer's location. `io.mjs` resolves the
cache and repository internally and reads little-endian arrays on either host
byte order. `b.parts`, `b.inverse` and `b.index` are available when source maps
are requested.

## Nominal-distance diagnostics

The endpoint diagnostic excludes the first and final positive-length token of
each block, matches of length 258 and endpoints beyond that block. It counts an
equality only when both endpoints are the same known byte, or the same unknown
dictionary identity. For the reproduced baseline:

- 452,999 eligible matches;
- 102,311 known-byte equalities plus 161 same-history equalities = **102,472**;
- 118,070 endpoint equalities if all history is instead assigned zero;
- 38,100 additional endpoint comparisons unresolved by these identities;
- first invariant-to-dictionary witness: token 644, output 5513, length 12,
  distance 2273, with both endpoints known byte 7.

These are **nominal-distance** counts, conditional on the selected literals,
lengths, framing and CR choices. They are not the old 74,287 all-selector proof,
which cannot be reconstructed from missing proof files by relabeling this audit.
Endpoint extension is a conditional ordinary-zlib diagnostic, not a universal
DEFLATE rule; an optimized parser may deliberately choose a shorter match.
The separate `D > 32506` count is likewise specific to ordinary zlib's window
and lookahead implementation, not the format's 32,768-byte maximum.

The stricter match-plus-literal diagnostic additionally requires that the next
token is a contiguous literal and that extending the copy by one stays within
the canonical range of the **same length symbol and extra-bit width**. Removing
the literal then saves its exact positive Huffman-code cost. The alternate
symbol-284/extra-31 spelling of length 258 is excluded.

There are **8,623 such pairs**, saving **37,243 bits** under nominal distances.
The first is token 2881: length 20 becomes 21 at distance 10936, keeping symbol
269 and its two extra bits while absorbing literal 4. The pair costs 27 bits;
the replacement costs 23.

As a direct check, the exporter applies all disjoint replacements to an
equivalent diagnostic bitstream and independently native-inflates it with zero
and cyclic dictionaries. Both output buffers remain exactly unchanged. This
equivalent encoding is **not source-compatible repair or image recovery**. It
validates the claimed cost comparison. The smaller historical 6,900 count
quantified retained distance-selector alternatives; the new 8,623 count does not.

Complete witness CSVs are cached. The first 250 of each are tracked here so a
reviewer can inspect concrete examples without committing the large arrays.
`block_diagnostics.csv` retains all per-block counts.

## Limits

The authentic incoming dictionary is missing, 356,185 nominal output positions
descend from that unknown history, and 1,987 inverse codepoints were unmapped.
Blocks 12, 13 and 20 retain synthetic EOBs. CR placement, source exclusions and
NUL choices remain hypotheses. Source positions and direct literal values are
conditional on this selected parse. No PNG wrapper, predictor state, dimensions
or RGB pixels are authenticated by this export.
