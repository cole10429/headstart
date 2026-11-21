#!/usr/bin/env bash
# Headstart one-line installer for macOS and Linux. Not yet run on a real Mac:
# see the README. Read it before you run it.
#
#   curl -fsSL https://raw.githubusercontent.com/cole10429/headstart/main/install.sh | bash
#
# It checks for Claude Code, Git and Node, downloads this repo to a temporary
# folder, runs install/install.mjs (which shows a plan and asks before changing
# anything), then deletes the temporary folder.
set -euo pipefail

REPO="${HEADSTART_REPO:-cole10429/headstart}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 is not installed. $2" >&2
    exit 1
  fi
}

need claude "Install Claude Code first, sign in once, then run this again:  curl -fsSL https://claude.ai/install.sh | bash"
need git "Install it from https://git-scm.com/downloads and run this again."
need node "The safety hooks run on Node.js. Install the LTS from https://nodejs.org and run this again."
command -v gh >/dev/null 2>&1 || echo "Note: the GitHub CLI (gh) is not installed. Claude works without it; get it from https://cli.github.com to work with GitHub."

WORK="$(mktemp -d "${TMPDIR:-/tmp}/headstart-XXXXXXXX")"
cleanup() {
  case "${WORK:?}" in
    */headstart-*) rm -rf -- "$WORK" ;;
  esac
}
trap cleanup EXIT

git clone --depth 1 --quiet "https://github.com/${REPO}.git" "$WORK"
# The installer asks a question, so give it the keyboard even when this script is piped in.
node "$WORK/install/install.mjs" --source "$REPO" </dev/tty
