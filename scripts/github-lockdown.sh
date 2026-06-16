#!/usr/bin/env bash
# ============================================================================
# github-lockdown.sh — emergency GitHub access lockdown (post-compromise IR).
#
# After a machine compromise / token theft, this:
#   1. Removes ALL collaborators (and cancels pending invites) from repos YOU own
#   2. Removes YOU from repos owned by OTHERS (and declines pending invites)
#   3. (optional) Deletes ALL your SSH + GPG keys
#   4. (optional) Logs out the local gh CLI
# and prints the manual steps the GitHub API cannot do (kill sessions, revoke
# OAuth apps + PATs, change password — the real "log out everywhere").
#
# DRY-RUN by default. Nothing changes until you pass --apply.
#
# Requires: gh (GitHub CLI), authenticated (`gh auth login`).
#
# Usage:
#   ./github-lockdown.sh                  # dry run — show what WOULD happen
#   ./github-lockdown.sh --apply          # remove collaborators (both directions)
#   ./github-lockdown.sh --apply --keys   # also delete all SSH + GPG keys
#   ./github-lockdown.sh --apply --logout # also `gh auth logout` at the end
#
# SAFER: run this from a CLEAN device after you've revoked the stolen token.
# ============================================================================
set -uo pipefail

APPLY=0; DEL_KEYS=0; DO_LOGOUT=0
for a in "$@"; do
  case "$a" in
    --apply)  APPLY=1 ;;
    --keys)   DEL_KEYS=1 ;;
    --logout) DO_LOGOUT=1 ;;
    -h|--help) sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $a"; exit 2 ;;
  esac
done

red(){ printf '\033[31m%s\033[0m\n' "$*"; }
grn(){ printf '\033[32m%s\033[0m\n' "$*"; }
ylw(){ printf '\033[33m%s\033[0m\n' "$*"; }
dim(){ printf '\033[2m%s\033[0m\n' "$*"; }
bold(){ printf '\033[1m%s\033[0m\n' "$*"; }

command -v gh >/dev/null 2>&1 || { red "GitHub CLI 'gh' not found — install from https://cli.github.com/"; exit 1; }
gh auth status >/dev/null 2>&1 || { red "Not authenticated. Run: gh auth login"; exit 1; }

ME="$(gh api user -q .login 2>/dev/null)"
[ -n "$ME" ] || { red "Could not resolve your GitHub login."; exit 1; }
echo
bold "GitHub lockdown"
grn  "  Authenticated as: $ME"
if [ "$APPLY" = 1 ]; then
  red "  MODE: APPLY — changes WILL be made"
  printf '  Type your username (%s) to confirm: ' "$ME"; read -r CONF
  [ "$CONF" = "$ME" ] || { red "  Confirmation failed. Aborting."; exit 1; }
else
  ylw "  MODE: DRY-RUN — no changes. Re-run with --apply to execute."
fi

# Run a destructive gh call, or just print it in dry-run mode.
act(){
  if [ "$APPLY" = 1 ]; then
    if gh "$@" >/dev/null 2>&1; then grn "      ✓ done"; else red "      ✗ failed (insufficient permission?)"; fi
  else
    dim "      [dry-run] gh $*"
  fi
}

# ── 1) Remove all collaborators from repos you OWN ──────────────────────────
echo; bold "1) Repos you OWN — remove every other collaborator + cancel invites"
OWNED="$(gh api 'user/repos?affiliation=owner&per_page=100' --paginate -q '.[].full_name' 2>/dev/null)"
[ -n "$OWNED" ] || dim "  (none)"
for repo in $OWNED; do
  echo "  ▸ $repo"
  COLLABS="$(gh api "repos/$repo/collaborators?affiliation=all&per_page=100" --paginate -q '.[].login' 2>/dev/null)"
  found=0
  for u in $COLLABS; do
    [ "$u" = "$ME" ] && continue
    found=1; ylw "    remove collaborator: $u"; act api -X DELETE "repos/$repo/collaborators/$u"
  done
  for id in $(gh api "repos/$repo/invitations?per_page=100" --paginate -q '.[].id' 2>/dev/null); do
    found=1; ylw "    cancel pending invite #$id"; act api -X DELETE "repos/$repo/invitations/$id"
  done
  [ "$found" = 0 ] && dim "    (no other collaborators / invites)"
done

# ── 2) Remove YOURSELF from repos owned by OTHERS ───────────────────────────
echo; bold "2) Repos owned by OTHERS — remove yourself + decline invites"
COLLAB_REPOS="$(gh api 'user/repos?affiliation=collaborator&per_page=100' --paginate -q '.[].full_name' 2>/dev/null)"
[ -n "$COLLAB_REPOS" ] || dim "  (none)"
for repo in $COLLAB_REPOS; do
  ylw "  ▸ $repo — leave"; act api -X DELETE "repos/$repo/collaborators/$ME"
done
for id in $(gh api '/user/repository_invitations?per_page=100' --paginate -q '.[].id' 2>/dev/null); do
  ylw "  decline incoming repo invitation #$id"; act api -X DELETE "user/repository_invitations/$id"
done

# ── 3) (optional) Delete all SSH + GPG keys ─────────────────────────────────
if [ "$DEL_KEYS" = 1 ]; then
  echo; bold "3) Delete ALL SSH + GPG keys"
  for id in $(gh api /user/keys -q '.[].id' 2>/dev/null); do
    ylw "  delete SSH key #$id"; act api -X DELETE "/user/keys/$id"
  done
  for id in $(gh api /user/gpg_keys -q '.[].id' 2>/dev/null); do
    ylw "  delete GPG key #$id"; act api -X DELETE "/user/gpg_keys/$id"
  done
else
  echo; dim "3) (skipped — pass --keys to also delete SSH + GPG keys)"
fi

# ── Manual steps the API can't do ───────────────────────────────────────────
echo
red "================ MANUAL STEPS (no API) — do these in a browser ================"
cat <<'EOF'
  These are the real "log out everywhere" / revoke-token actions:

  1. CHANGE YOUR PASSWORD  -> signs out every other web session.
       https://github.com/settings/admin
  2. Sessions -> "Sign out of all other sessions"
       https://github.com/settings/sessions
  3. Personal access tokens -> REVOKE ALL (a token-stealer uses these)
       https://github.com/settings/tokens
  4. Authorized OAuth Apps / GitHub Apps -> revoke anything unfamiliar
       https://github.com/settings/applications
  5. Password & authentication -> verify 2FA, regenerate recovery codes
       https://github.com/settings/security
  6. SSH & GPG keys -> confirm only YOUR keys remain
       https://github.com/settings/keys
EOF

if [ "$DO_LOGOUT" = 1 ]; then
  echo; ylw "Logging out local gh CLI..."
  if [ "$APPLY" = 1 ]; then gh auth logout 2>/dev/null && grn "  ✓ gh logged out"; else dim "  [dry-run] gh auth logout"; fi
fi

echo; grn "Done. (Dry-run = nothing changed.)"
