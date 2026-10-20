#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.."
SAF_RUN=research/2026-10-20
SAF_SCORER="$SAF_RUN/cache/source_search/score_candidates"
SAF_PROBLEM="$SAF_RUN/cache/source_search"

node "$SAF_RUN/baseline/export.mjs"
node "$SAF_RUN/source_search/prepare_problem.mjs"
g++ -O3 -std=c++17 "$SAF_RUN/source_search/score_candidates.cpp" -o "$SAF_SCORER"
"$SAF_SCORER" "$SAF_PROBLEM" "$SAF_RUN/source_search/candidates.tsv" "$SAF_RUN/source_search/scores.jsonl" 1
python "$SAF_RUN/source_search/select.py"
python "$SAF_RUN/source_search/make_frontier_audit.py"
"$SAF_SCORER" "$SAF_PROBLEM" "$SAF_RUN/source_search/shortlist.tsv" "$SAF_RUN/source_search/continuation_scores.jsonl" 4 "$SAF_RUN/cache/source_search/cpp_selected"
"$SAF_SCORER" "$SAF_PROBLEM" "$SAF_RUN/source_search/frontier_audit.tsv" "$SAF_RUN/source_search/frontier_continuation.jsonl" 4 "$SAF_RUN/cache/source_search/cpp_selected"
node "$SAF_RUN/source_search/verify_selected.mjs"
python "$SAF_RUN/source_search/summarize.py"
python "$SAF_RUN/source_search/package_manifest.py"

node "$SAF_RUN/cr_search/prepare_candidates.mjs"
"$SAF_SCORER" "$SAF_PROBLEM" "$SAF_RUN/cr_search/candidates.tsv" "$SAF_RUN/cr_search/scores.jsonl" 1
node "$SAF_RUN/cr_search/select.mjs"
"$SAF_SCORER" "$SAF_PROBLEM" "$SAF_RUN/cr_search/shortlist.tsv" "$SAF_RUN/cr_search/continuation.jsonl" 4 "$SAF_RUN/cache/cr_search/continuation"
node "$SAF_RUN/cr_search/verify.mjs"
python "$SAF_RUN/cr_search/pack_records.py"

node "$SAF_RUN/propagation/audit.mjs"
node "$SAF_RUN/visuals/render.mjs"
python "$SAF_RUN/visuals/contact_sheets.py"
