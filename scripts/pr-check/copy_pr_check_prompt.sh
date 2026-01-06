#!/usr/bin/env bash
set -euo pipefail

PR_NUMBER="${PR_NUMBER:-}"
SHORT_TOPIC="${SHORT_TOPIC:-}"
TEMPLATE_PATH="${TEMPLATE_PATH:-.vscode/pr_check_prompt_template.md}"
OUT_DIR="${OUT_DIR:-docs/reviews}"

if [[ -z "${PR_NUMBER}" || -z "${SHORT_TOPIC}" ]]; then
  echo "ERROR: PR_NUMBER and SHORT_TOPIC must be set (from VS Code task inputs)." >&2
  exit 1
fi

timestamp() {
  date +"%Y%m%d-%H%M"
}

slugify() {
  # lowercase, spaces->-, strip non [a-z0-9-], collapse dashes
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | tr ' ' '-' \
    | sed -E 's/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-+//; s/-+$//'
}

choose_code_bin() {
  # Intentionally disabled: scripts must not auto-open artifacts.
  echo ""
}

clipboard_write() {
  local content="$1"
  if command -v pbcopy >/dev/null 2>&1; then
    printf "%s" "$content" | pbcopy
    return 0
  fi
  if command -v wl-copy >/dev/null 2>&1; then
    printf "%s" "$content" | wl-copy
    return 0
  fi
  if command -v xclip >/dev/null 2>&1; then
    printf "%s" "$content" | xclip -selection clipboard
    return 0
  fi
  if command -v clip.exe >/dev/null 2>&1; then
    # Git Bash on Windows
    printf "%s" "$content" | clip.exe
    return 0
  fi
  if command -v powershell.exe >/dev/null 2>&1; then
    printf "%s" "$content" | powershell.exe -NoProfile -Command "Set-Clipboard"
    return 0
  fi
  echo "WARN: No clipboard tool found; printing prompt to stdout." >&2
  printf "%s\n" "$content"
  return 0
}

mkdir -p "$OUT_DIR"

ts="$(timestamp)"
topic_slug="$(slugify "$SHORT_TOPIC")"

review_filename="PR_REVIEW_${ts}_pr-${PR_NUMBER}_${topic_slug}.md"
reply_filename="PR_REPLY_${ts}_pr-${PR_NUMBER}_${topic_slug}.md"
prompt_filename="PR_PROMPT_${ts}_pr-${PR_NUMBER}_${topic_slug}.md"

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "ERROR: Template not found at $TEMPLATE_PATH" >&2
  exit 1
fi

prompt="$(cat "$TEMPLATE_PATH")"
prompt="${prompt//'{{PR_NUMBER}}'/${PR_NUMBER}}"
prompt="${prompt//'{{SHORT_TOPIC}}'/${SHORT_TOPIC}}"
prompt="${prompt//'{{PROMPT_FILENAME}}'/${prompt_filename}}"
prompt="${prompt//'{{REVIEW_FILENAME}}'/${review_filename}}"
prompt="${prompt//'{{REPLY_FILENAME}}'/${reply_filename}}"

prompt_path="${OUT_DIR}/${prompt_filename}"
printf "%s\n" "$prompt" > "$prompt_path"

clipboard_write "$prompt"

echo "PR prompt written to: $prompt_path"
echo "Copied prompt to clipboard (best-effort)."

# Intentionally do not open files in an editor.
