# Headstart: notes for agents working on this repo

**Goal:** a public starter kit that gives a newcomer to Claude Code a year of learned habits in one install, plus a tour that teaches one thing at a time as they work.
**Not goals:** anything specific to one person, job or machine; multi-agent coordination; changing the user's permission mode, model or telemetry.
**Done when:** a person on a clean Windows PC pastes one line, answers the setup questions, and gets working guards and a first tour lesson.
**Quality bar:** `npm test` passes; no personal names, paths or client data anywhere; every third-party piece credited; every claim in the README checked.
**Budget:** version 1 is the core only. New scope goes in `docs/PARKED.md`.

## Layout

- This repo is both the marketplace (`.claude-plugin/marketplace.json`) and the plugin (`.claude-plugin/plugin.json`, source `./`).
- A plugin cannot ship permission rules or a profile, so `install/install.mjs` merges those. `install.ps1` and `install.sh` only fetch the repo and run it.
- `hooks/tour.js` handles pacing and the typed `tour ...` commands; lesson text is data in `tour/lessons.json`.

## Rules

- Run `npm test` after any change to `hooks/`, `tour/` or `install/`. Plain `node --test` hangs: it mistakes `hooks/test-guard.js` for a test file.
- Hooks never block on their own errors: wrap `main()` and fail open. Do not call `process.exit()` after writing output.
- The installer only adds. It never removes or rewrites what the user had, and it records what it added so `--uninstall` is exact.
- `skills/humanizer` and `skills/grill-me` are pinned copies: update them by diffing upstream, following their `PINNED.md` and `UPSTREAM.md`.
- Text a user reads uses everyday words and no em dashes. Tour lessons stay under 480 characters.
- The repo is `cole10429/headstart`. If it moves, change that name in README.md, install.ps1, install.sh and install/install.mjs together.

## Open items

The maintainer may keep personal notes in `PRIVATE-NOTES.md`, which `.gitignore` keeps out of the repo: read it first when it exists. Nothing personal goes in any tracked file.

- The one-line install from GitHub has not been run on a clean Windows yet (Windows Sandbox would do it).
- Not fixed from the outside review, for a later version: package-vet sends package names to public lookups even for private packages, and checks the latest release for version ranges; installer edge cases (a file changed while the plan is on screen, an install interrupted halfway); `--source` with a local path goes through a shell; test-guard can treat an old test as new in a one-branch clone; uninstall needs a fresh copy of the repo.
- Not yet watched live: setup, `new-project` and a tour lesson in a real chat.
- macOS and Linux install untested; needs a Mac.
