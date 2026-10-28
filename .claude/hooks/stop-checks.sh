#!/usr/bin/env bash
# Stop hook: before Claude finishes a turn, run type-check, lint and tests if source or config changed.
# Exit 0 = let it stop; exit 2 = block, with the reason on stderr fed back to Claude.
set -u

input="$(cat)"
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

# Docs, plans and the changelog can't break the build, so changes to only those stay silent.
changed="$(git status --porcelain | cut -c4- | grep -vE '(^|/)[^/]*\.md$|^docs/|^tasks/' || true)"
[ -z "$changed" ] && exit 0

for check in typecheck lint test; do
  if ! output="$(npm run -s "$check" 2>&1)"; then
    # Block once per stop. On the repeat stop Claude has already seen the failure, and blocking
    # again would loop forever on anything it can't fix (an unrelated test, npm missing).
    if printf '%s' "$input" | grep -qE '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
      exit 0
    fi
    printf 'npm run %s failed on uncommitted changes. Fix it, or tell the user why it cannot be fixed now:\n%s\n' \
      "$check" "$(printf '%s' "$output" | tail -n 40)" >&2
    exit 2
  fi
done
exit 0
