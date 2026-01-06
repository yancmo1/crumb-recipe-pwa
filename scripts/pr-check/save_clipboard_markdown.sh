#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${PR_NUMBER:-}"
SHORT_TOPIC="${SHORT_TOPIC:-}"
OUT_DIR="${OUT_DIR:-docs/reviews}"

if [[ -z "${PR_NUMBER}" || -z "${SHORT_TOPIC}" ]]; then
  echo "ERROR: PR_NUMBER and SHORT_TOPIC must be set (from VS Code task inputs)." >&2
  exit 1
fi

timestamp() {
  date +"%Y%m%d-%H%M"
}

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr ' ' '-' \
    | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//'
}

choose_code_bin() {
  # Intentionally disabled: scripts must not auto-open artifacts.
  echo ""
}

clipboard_read() {
  if command -v pbpaste >/dev/null 2>&1; then
    pbpaste
    return 0
  fi
  if command -v wl-paste >/dev/null 2>&1; then
    wl-paste
    return 0
  fi
  if command -v xclip >/dev/null 2>&1; then
    xclip -selection clipboard -o
    return 0
  fi
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Get-Clipboard"
    return 0
  fi
  echo ""
  return 0
}

mkdir -p "$OUT_DIR"
ts="$(timestamp)"
topic_slug="$(slugify "$SHORT_TOPIC")"
review_filename="PR_REVIEW_${ts}_pr-${PR_NUMBER}_${topic_slug}.md"
review_path="${OUT_DIR}/${review_filename}"

content="$(clipboard_read || true)"

if [[ -z "${content//[[:space:]]/}" ]]; then
  cat > "$review_path" <<EOF
# PR Review Handoff — PR #${PR_NUMBER} — ${SHORT_TOPIC}
Saved: $(date +"%Y-%m-%d %H:%M")

## Clipboard was empty
Paste the PR review markdown here and re-run the task if needed.
EOF
else
  printf "%s\n" "$content" > "$review_path"
fi

echo "Saved clipboard markdown to: $review_path"

# Intentionally do not open files in an editor.
