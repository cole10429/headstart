---
name: package-vet
description: Vet a third-party package (npm, pip, uv, npx) before proposing, installing or upgrading it, and scan an existing project for known-malicious packages. Use before suggesting any new dependency or version bump, when the package-vet hook blocks an install, when a package needs its install script re-enabled, and when the user asks "am I clean" after a supply-chain incident.
---

# Package vetting

Guards this kit sets up (don't weaken them without the user's OK):
- `~/.npmrc`, when the installer was allowed to set it: `ignore-scripts=true`, `min-release-age=7`.
- The `package-vet` hook on every shell command. A red flag denies the install; a clean result asks the user with the evidence. If it cannot reach the registry it asks with "could not verify", never allows silently.

## Before proposing a package

Do this before you mention the package to the user, not after they say yes. Scope: package-manager installs (npm, pip, uv, npx). Tools copied from an established GitHub repo skip the age and download gates; still check the source and verify published checksums.

1. **Need it?** The standard library, an existing dependency, or 20 lines of code beats a new package.
2. **Right name?** Confirm the exact name from the official docs or repo. Typosquats differ by one letter.
3. **Check the registry** (read-only):
   - npm: `npm view <pkg> time --json`, `npm view <pkg>@<ver> scripts`, downloads from `https://api.npmjs.org/downloads/point/last-week/<pkg>`.
   - PyPI: `https://pypi.org/pypi/<pkg>/json`.
   - OSV: `POST https://api.osv.dev/v1/query` with `{"package":{"name":"<pkg>","ecosystem":"npm"|"PyPI"},"version":"<ver>"}`. Any `MAL-` id means malware.
4. **Red flags** (any one means stop and tell the user): a malware or unpatched advisory, a release under 7 days old, a package under 90 days old, under 1,000 weekly downloads, an install script, a git or URL source, a recent maintainer change.
5. **Propose** it with the exact pinned version, publish date, downloads, advisories (0 or the list) and whether it runs install scripts. Say in one plain line what the package is for.

## When a package needs its install script

Vet it first. Then allow only that one package: `npm rebuild <pkg> --ignore-scripts=false`. The hook blocks this, so give the user the command to run themselves and explain why the package needs it.

## Scan an existing project ("am I clean?")

Run read-only from the project root:
1. `npm audit signatures` (registry signatures match) and `npm audit`.
2. Compare every lockfile entry against the incident's published bad-version list (primary sources: the maintainer's issue, OSV, Socket, Snyk, Datadog). Prove the matcher by testing one version you know is there.
3. Look for payload files the advisory names in `node_modules`, and for planted `.claude/` or `.vscode/tasks.json` files in the repo.
4. List packages with `preinstall`, `install` or `postinstall` scripts and read each one.
5. Check the user's GitHub repo list for repos they did not create, and the DNS cache for the advisory's domains.
6. Report scope: what was scanned and what was not. A hit means: stop, run nothing in that project, tell the user; passwords and keys get changed from a different, clean computer.
