# PR Fix (Implementation) — PR #17 — initial refactor multi users

You are implementing fixes for a pull request **in this repository**.

**Implementation mode:** make code changes in the workspace, keep edits minimal/surgical, and verify with tests/build. (This is designed to be used in the same chat window after the review.)

## Authority docs (follow in priority order; use the first that exists)
1) .github/copilot-instructions.md
2) WORKSPACE_LIVING_DOC.md
3) CONTRIBUTING.md
4) docs/ARCHITECTURE.md
5) docs/DEV_RUNBOOK.md
6) README.md (fallback)

## Inputs
- PR number: 17
- Topic: initial refactor multi users
- Prompt artifact: docs/reviews/PR_FIX_PROMPT_20260106-0955_pr-17_initial-refactor-multi-users.md
- Review artifact (most recent if present): docs/reviews/PR_REVIEW_20260106-0717_pr-17_initial-refactor-multi-users.md
- Reply scratchpad (optional): docs/reviews/PR_REPLY_20260106-0955_pr-17_initial-refactor-multi-users.md

## Non‑negotiables for implementation
- **Implement changes** (unlike the review prompt).
- Follow the authority docs above.
- Keep changes minimal: no drive‑by refactors, no unrelated formatting, no “while I’m here” rewrites.
- Prefer small, testable commits/steps.
- Verify: run the repo’s test suite and/or build steps that are appropriate for this project.
- If anything is unclear or blocked (missing context, failing tests unrelated to your changes), state it explicitly and propose the smallest viable next step.

## What to do
1) Read `docs/reviews/PR_REVIEW_20260106-0717_pr-17_initial-refactor-multi-users.md` if it exists (or the review content I paste in chat) and extract:
  - Required changes (blocking)
  - Suggested improvements (non‑blocking)
  - Must‑verify steps
2) Implement the required changes.
3) Run verification (tests/build) and report exactly what ran and results.
4) Produce a PR‑ready reply summarizing what was fixed.

## Required output (use these headings)

### 1) Implementation plan
A short checklist of steps you will take.

### 2) Changes made
- Bullet list of changes.
- Include evidence anchors for key changes: `Anchors: <file path>:<symbol>(...) (~Lx–Ly)`.

### 3) Verification
- What you ran (tests/build)
- Result (pass/fail)
- If you could not run anything, list explicit manual verification steps instead.

### 4) Notes / tradeoffs
Anything worth calling out (edge cases, follow-ups, things intentionally not changed).

### 5) Copy/paste PR reply (final block)
End with a GitHub‑ready reply containing:
- Summary of fixes
- Verification status
- Any remaining follow-ups
