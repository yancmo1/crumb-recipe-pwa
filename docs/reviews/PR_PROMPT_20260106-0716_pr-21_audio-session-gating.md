# PR Check (Review‑Only) — PR #21 — audio-session-gating

You are reviewing a pull request. **Review‑only mode: do not implement changes.**

## Authority docs (follow in priority order; use the first that exists)
1) .github/copilot-instructions.md
2) WORKSPACE_LIVING_DOC.md
3) CONTRIBUTING.md
4) docs/ARCHITECTURE.md
5) docs/DEV_RUNBOOK.md
6) README.md (fallback)

## Inputs
- PR number: 21
- Topic: audio-session-gating
- Prompt artifact: docs/reviews/PR_PROMPT_20260106-0716_pr-21_audio-session-gating.md

## Non‑negotiables for this review
- **No implementation.** Provide review findings and suggested edits only.
- **Evidence anchors required:** For every **High** or **Medium** item, include:
  - `Anchors: <file path>:<symbol>(...) (~Lx–Ly)`
  - If you cannot determine line ranges, still provide file + symbol and state: “line range unavailable.”
- **Decision discipline:** If tests were not run, do **not** say “LGTM/Approve” without listing explicit **must‑verify** manual steps.
- **When unsure:** state assumptions and what evidence would confirm them.

## Required output (use these exact headings, in this order)

### 1) Scope and intent
- 2–4 bullets describing what the PR is changing and why.

### 2) Risk inventory (choose what applies)
List risks and edge cases relevant to the PR. Choose from (and add PR‑specific items as needed):
- Lifecycle/observers & cleanup
- Concurrency & reentrancy
- Error handling & logging (avoid swallowed failures)
- State synchronization / single source of truth
- Backward compatibility / availability gating
- Performance / battery / memory
- Security / privacy / secrets
- Data integrity / migrations
- UI/UX regression risk
- Build/CI / target membership / packaging

### 3) Findings summary (High / Medium / Low)
Provide a short table‑like list, then details below.

### 4) Decision required (if applicable)
What decision the reviewer or author must make (e.g., acceptable fallback behavior, feature flag choice).

### 5) Required changes (blocking)
Each item must include:
- Why it matters (impact)
- Exact fix guidance
- **Anchors** (file + symbol + approx line range)

### 6) Approval criteria
A checklist of what must be true to approve (tests/verification included).
- ✅ UI conforms to `docs/design/STRIDELOG_DESIGN_SYSTEM_V1.md` (gradient, spacing, cards, typography, icons). If not, request changes and cite the exact section number from that file (e.g., §3.1, §4.2, §6.2).

### 7) File‑by‑file notes
For each touched file: intent, correctness, and any cleanup opportunities.

### 8) Concrete suggested edits
Show exact patches or code blocks as needed. Keep edits minimal and scoped.

### 9) Most likely future bugs (1–3)
For each:
- Symptom in production
- Root cause hypothesis
- Where you’d add guardrails (tests, asserts, logs, state model)

### 10) Copy/paste PR reply (final block)
End your response with a GitHub‑ready reply containing:
- Decision: Approve / Request changes / Block
- Risk: High / Medium / Low
- Required actions (3–8 bullets) or “No required changes”
- Must‑verify steps (if tests not run)

## Artifact instructions
- Create or provide the complete contents for:
  - docs/reviews/PR_REVIEW_20260106-0716_pr-21_audio-session-gating.md
- Your response must end with the **Copy/paste PR reply** block suitable for GitHub.
- Optional: I may paste that reply into:
  - docs/reviews/PR_REPLY_20260106-0716_pr-21_audio-session-gating.md
