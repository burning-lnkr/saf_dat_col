# Durable research checkpoint protocol

## Why work disappeared

Chat execution environments and intermediate tool outputs are ephemeral. A local file or a narrated experiment is not a Git commit. Only work explicitly pushed to the repository and verified by reading the remote branch is durable across sessions.

## Rules for subsequent work

1. Start by fetching this branch and verifying source hashes recorded in README.md.
2. Before an experiment, commit a small runnable script, exact parameters, expected inputs, and a manifest of outputs. Never rely on an uncommitted local script.
3. After each bounded experiment, commit the script updates, metrics in JSON/CSV, a concise report with positive and negative results, and selected small diagnostic PNGs. Large regenerated arrays stay out of Git, with hashes and commands in the manifest.
4. Checkpoint after each meaningful result and before any lengthy search. Do not defer all commits to the end of a session.
5. After each push, read the branch from GitHub, record the commit SHA, and compare with the parent. A local git commit or an API write response alone is insufficient.
6. In user updates distinguish **committed and remotely verified**, **generated locally but not committed**, and **planned**. Never claim a saved result until remote verification.
7. Never overwrite source evidence or rewrite the research branch history. Create new numbered experiment directories or append-only reports.
8. A recovered image candidate must carry its input SHA-256, exact repair recipe, decoded SHA-256, dimensions/layout/filter assumptions, validation metrics, and a clear provisional label.
9. If a run ends unexpectedly, restart from the latest verified remote commit, not conversational summaries. Re-run scripts to reproduce any uncommitted claims.

## Current state

The README checkpoint is committed. The previous exploratory source-edit scripts and visual comparisons were described in conversation but their final upload was not verified and are not asserted to exist on this branch. They must be regenerated and committed before being used as a durable baseline.
