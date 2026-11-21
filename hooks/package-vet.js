#!/usr/bin/env node
/**
 * PreToolUse Hook: vet third-party packages before any install.
 *
 * Catches npm/pnpm/yarn/bun installs, npx/dlx/bunx, pip/uv/pipx installs and
 * script re-enabling. For each named package it checks OSV advisories (incl.
 * known malware), release age, package age, install scripts and downloads.
 *
 * Output: "deny" when a red flag is found (the agent must report it to the user),
 * otherwise "ask" with the evidence so the user approves from the card.
 * Network failure never allows: it asks with "could not verify".
 * Procedure and manual checks: the package-vet skill in this plugin.
 */

'use strict';

const MIN_RELEASE_DAYS = 7;   // matches min-release-age in ~/.npmrc when the installer set it
const MIN_PACKAGE_DAYS = 90;  // brand-new package names = typosquat risk
const LOW_DOWNLOADS = 1000;   // npm weekly downloads
const TIMEOUT_MS = 8000;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; if (raw.length > 1e6) process.exit(0); });
process.stdin.on('end', () => { main().catch(() => process.exit(0)); });

function out(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  // No process.exit() here: it can cut off output that has not been flushed yet.
}

const strip = (t) => t.replace(/^['"]|['"]$/g, '');

// Drop redirects (2>&1, >/dev/null, 2> file, < in) so they aren't read as package names.
function dropRedirects(t) {
  const res = [];
  for (let i = 0; i < t.length; i++) {
    const m = t[i].match(/^(?:\d*|&)(?:>>?|<)(.*)$/);
    if (!m) { res.push(t[i]); continue; }
    if (!m[1]) i++; // bare operator: its target is the next token
  }
  return res;
}

// Split a command line into simple segments and tokens.
function segments(cmd) {
  return cmd.split(/&&|\|\||[;|\n]/).map((s) => dropRedirects(s.trim().split(/\s+/).map(strip).filter(Boolean))).filter((t) => t.length);
}

// Returns { eco, names[], notes[] } or null if the segment installs nothing new.
function parse(t) {
  let i = 0;
  while (i < t.length && /^(sudo|env|\w+=\S*|&|\.)$/.test(t[i])) i++;
  const bin = (t[i] || '').toLowerCase().replace(/\.(cmd|exe|ps1)$/, '').split(/[\\/]/).pop();
  const rest = t.slice(i + 1);
  const pos = (arr) => arr.filter((a) => !a.startsWith('-'));
  const notes = [];
  if (t.some((a) => /^--ignore-scripts=false$/i.test(a)) || (rest.includes('--ignore-scripts') && rest.includes('false'))) {
    notes.push('turns install scripts back on (--ignore-scripts=false)');
  }

  if (['npm', 'pnpm', 'yarn', 'bun'].includes(bin)) {
    const sub = rest[0];
    if (['i', 'install', 'add', 'isntall', 'in'].includes(sub)) {
      const names = pos(rest.slice(1));
      if (!names.length && !notes.length) return null; // lockfile install
      return { eco: 'npm', names, notes };
    }
    if (['up', 'update', 'upgrade'].includes(sub)) return { eco: 'npm', names: pos(rest.slice(1)), notes: notes.concat('updates versions beyond the lockfile') };
    if (['exec', 'x', 'dlx'].includes(sub)) return { eco: 'npm', names: pos(rest.slice(1)).slice(0, 1), notes };
    if (sub === 'rebuild' && notes.length) return { eco: 'npm', names: pos(rest.slice(1)), notes };
    return null;
  }
  if (['npx', 'bunx', 'pnpx'].includes(bin)) {
    // Only flags before the command belong to npx; after it (`next start -p 3000`) they are the command's own.
    const isPkgFlag = (k) => rest[k - 1] === '-p' || rest[k - 1] === '--package';
    const c = rest.findIndex((a, k) => !a.startsWith('-') && !isPkgFlag(k));
    const pk = rest.filter((a, k) => (c === -1 || k < c) && isPkgFlag(k));
    if (pk.length) return { eco: 'npm', names: pk, notes };
    return c === -1 ? null : { eco: 'npm', names: [rest[c]], notes, localBin: rest[c] };
  }
  // pip / python -m pip / uv pip / uv add / pipx
  let r = rest;
  let b = bin;
  if (/^(python3?|py)$/.test(b) && r[0] === '-m') { b = r[1]; r = r.slice(2); }
  if (b === 'uv' && r[0] === 'pip') { b = 'pip'; r = r.slice(1); }
  if (/^pip3?$/.test(b) && r[0] === 'install') {
    if (r.includes('-r') || r.includes('--requirement')) notes.push('installs from a requirements file (names not vetted individually)');
    const names = r.slice(1).filter((a, k, arr) => !a.startsWith('-') && !['-r', '--requirement', '-c', '-e'].includes(arr[k - 1]));
    return { eco: 'pypi', names, notes };
  }
  if (b === 'uv' && r[0] === 'add') return { eco: 'pypi', names: pos(r.slice(1)), notes };
  if (b === 'pipx' && ['install', 'run'].includes(r[0])) return { eco: 'pypi', names: pos(r.slice(1)).slice(0, 1), notes };
  return null;
}

async function get(url, opts) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (r.status === 404) return { notFound: true };
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(id); }
}

const days = (iso) => Math.floor((Date.now() - Date.parse(iso)) / 864e5);

function splitSpec(eco, spec) {
  if (eco === 'npm') {
    const at = spec.lastIndexOf('@');
    return at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, ''];
  }
  const m = spec.match(/^([A-Za-z0-9._-]+)(?:\[.*\])?(?:==([^,;]+))?/);
  return m ? [m[1], m[2] || ''] : [spec, ''];
}

async function osv(eco, name, version) {
  const body = { package: { name, ecosystem: eco === 'npm' ? 'npm' : 'PyPI' } };
  if (version) body.version = version;
  const r = await get('https://api.osv.dev/v1/query', { method: 'POST', body: JSON.stringify(body) });
  return (r.vulns || []).map((v) => v.id);
}

async function vet(eco, spec) {
  const red = [];
  const info = [];
  const isPath = /^(\.|\/|[A-Za-z]:|file:|git[+:]|https?:|github:)/.test(spec);
  const isGitShorthand = eco === 'npm' && spec.includes('/') && !spec.startsWith('@');
  if (isPath || isGitShorthand) {
    return { red: [`${spec}: local, git or URL source, not checkable against the registry`], info };
  }
  // Protocol specs (jsr:, npm:, catalog: ...) can still install: keep them blocked.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:.+/.test(spec)) {
    return { red: [`${spec}: non-registry source, not checkable against the registry`], info };
  }
  // A token that can't be a package name (e.g. a quoted text label like 'npx entries: ') installs nothing: skip it.
  const [name, want] = splitSpec(eco, spec);
  const validName = eco === 'npm'
    ? name.length <= 214 && /^(?:@[A-Za-z0-9~-][A-Za-z0-9._~-]*\/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*$/.test(name)
    : /^[A-Za-z0-9][A-Za-z0-9._-]*(\[[^\]]*\])?([<>=!~;,].*)?$/.test(spec);
  if (!validName) return { red, info };
  if (eco === 'npm') {
    const meta = await get('https://registry.npmjs.org/' + name.replace('/', '%2F'));
    if (meta.notFound) return { red: [`${name}: not found on npm (typo or squatted name?)`], info };
    const tags = meta['dist-tags'] || {};
    if (/^\d+\.\d+\.\d+/.test(want) && !(meta.versions && meta.versions[want])) {
      const ids = await osv(eco, name, want);
      return { red: [`${name}@${want}: version not on npm (unpublished, often because it was malicious)` + (ids.length ? `; advisories ${ids.slice(0, 5).join(', ')}` : '')], info };
    }
    // Bare name or "latest": npm's min-release-age installs the highest stable release old enough, not the tag.
    const semver = (x) => x.split('.').map(Number);
    const cmp = (a, b) => { const [p, q] = [semver(a), semver(b)]; return p[0] - q[0] || p[1] - q[1] || p[2] - q[2]; };
    const oldEnough = Object.keys(meta.versions || {})
      .filter((x) => /^\d+\.\d+\.\d+$/.test(x) && tags.latest && cmp(x, tags.latest) <= 0)
      .filter((x) => meta.time && meta.time[x] && days(meta.time[x]) >= MIN_RELEASE_DAYS)
      .sort(cmp).pop();
    const version = meta.versions && meta.versions[want] ? want
      : (oldEnough && (!want || want === 'latest') ? oldEnough : (tags[want] || tags.latest));
    const v = meta.versions[version] || {};
    const sc = v.scripts || {};
    const pub = meta.time && meta.time[version];
    const created = meta.time && meta.time.created;
    const dl = await get('https://api.npmjs.org/downloads/point/last-week/' + name).catch(() => ({}));
    const ids = await osv(eco, name, version);
    if (ids.length) red.push(`${name}@${version}: advisories ${ids.slice(0, 5).join(', ')}`);
    if (ids.some((i) => i.startsWith('MAL-'))) red.push(`${name}@${version}: flagged as MALWARE`);
    if (pub && days(pub) < MIN_RELEASE_DAYS) red.push(`${name}@${version}: released ${days(pub)} days ago (under ${MIN_RELEASE_DAYS})`);
    if (created && days(created) < MIN_PACKAGE_DAYS) red.push(`${name}: package first published ${days(created)} days ago`);
    const hooks = ['preinstall', 'install', 'postinstall'].filter((k) => sc[k]);
    if (hooks.length) info.push(`${name}@${version}: has ${hooks.join('/')} script (blocked by ignore-scripts unless re-enabled)`);
    if (typeof dl.downloads === 'number' && dl.downloads < LOW_DOWNLOADS) red.push(`${name}: only ${dl.downloads} downloads last week`);
    info.push(`${name}@${version}: released ${pub ? days(pub) + 'd ago' : '?'}, ${dl.downloads ?? '?'} downloads/wk, ${ids.length} advisories`);
  } else {
    const meta = await get(`https://pypi.org/pypi/${name}/json`);
    if (meta.notFound) return { red: [`${name}: not found on PyPI (typo or squatted name?)`], info };
    const version = want || meta.info.version;
    const files = (meta.releases && meta.releases[version]) || [];
    const pub = files[0] && files[0].upload_time_iso_8601;
    const first = Object.values(meta.releases || {}).flat().map((f) => f.upload_time_iso_8601).sort()[0];
    const ids = await osv(eco, name, version);
    if (ids.length) red.push(`${name}==${version}: advisories ${ids.slice(0, 5).join(', ')}`);
    if (ids.some((i) => i.startsWith('MAL-'))) red.push(`${name}==${version}: flagged as MALWARE`);
    if (pub && days(pub) < MIN_RELEASE_DAYS) red.push(`${name}==${version}: released ${days(pub)} days ago (under ${MIN_RELEASE_DAYS})`);
    if (first && days(first) < MIN_PACKAGE_DAYS) red.push(`${name}: project first published ${days(first)} days ago`);
    if (files.length && !files.some((f) => f.packagetype === 'bdist_wheel')) info.push(`${name}==${version}: source-only, runs setup code on install`);
    info.push(`${name}==${version}: released ${pub ? days(pub) + 'd ago' : '?'}, ${ids.length} advisories`);
  }
  return { red, info };
}

async function main() {
  const input = JSON.parse(raw || '{}');
  const cmd = input.tool_input && input.tool_input.command;
  if (typeof cmd !== 'string') process.exit(0);
  // npx of a tool already in the project's node_modules/.bin installs nothing (it was vetted when installed).
  const cdSeg = segments(cmd).filter((t) => t[0] === 'cd' && t[1]).pop();
  const dir = cdSeg ? cdSeg.slice(1).join(' ') : input.cwd || process.cwd();
  const isLocal = (name) => !/[@/\\]/.test(name.slice(1)) &&
    ['', '.cmd'].some((ext) => require('fs').existsSync(require('path').join(dir, 'node_modules', '.bin', name + ext)));
  const jobs = segments(cmd).map(parse).filter(Boolean)
    .filter((j) => !(j.localBin && !j.notes.length && isLocal(j.localBin)));
  if (!jobs.length) process.exit(0);

  const red = [];
  const info = [];
  for (const j of jobs) {
    red.push(...j.notes.map((n) => 'Command ' + n));
    for (const spec of j.names) {
      try {
        const r = await vet(j.eco, spec);
        red.push(...r.red);
        info.push(...r.info);
      } catch (e) {
        info.push(`${spec}: could not verify (${e.name === 'AbortError' ? 'timeout' : e.message})`);
      }
    }
  }
  if (!red.length && !info.length) process.exit(0); // every "name" was a non-package token
  const unverified = info.some((l) => l.includes('could not verify'));
  if (red.length) {
    return out('deny', 'package-vet blocked this install. Red flags:\n- ' + red.join('\n- ') +
      (info.length ? '\nOther findings:\n- ' + info.join('\n- ') : '') +
      '\nDo not retry another way. Report these findings to the user in plain words and let them decide.');
  }
  const report = 'package-vet: ' + (unverified ? 'some packages could NOT be verified.' : 'no red flags found.') +
    '\n- ' + info.join('\n- ') + '\nChecks: OSV advisories and malware, release age, package age, downloads, install scripts.';
  // A harness that sends turn_id (Codex) rejects "ask" and would fail open: block unverified, else pass the report as context.
  if (input.turn_id) {
    if (unverified) return out('deny', report + '\nCould not verify. Report to the user and let them decide.');
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: report + '\nTell the user these findings.' } }));
    return;
  }
  return out('ask', report);
}
