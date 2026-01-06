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

mkdir -p "$OUT_DIR"
ts="$(timestamp)"
topic_slug="$(slugify "$SHORT_TOPIC")"
reply_filename="PR_REPLY_${ts}_pr-${PR_NUMBER}_${topic_slug}.md"
reply_path="${OUT_DIR}/${reply_filename}"

created_at="$(date +"%Y-%m-%d %H:%M")"

if [[ ! -f "$reply_path" ]]; then
  cat > "$reply_path" <<EOF
# PR Reply Scratchpad — PR #${PR_NUMBER} — ${SHORT_TOPIC}
Created: ${created_at}

## Copy/paste PR reply

## Notes / Follow-ups
EOF
else
  # Ensure required sections exist
  grep -q '^## Copy/paste PR reply' "$reply_path" || printf "\n## Copy/paste PR reply\n" >> "$reply_path"
  grep -q '^## Notes / Follow-ups' "$reply_path" || printf "\n## Notes / Follow-ups\n" >> "$reply_path"
fi

echo "Reply file: $reply_path"

# Intentionally do not open files in an editor.
