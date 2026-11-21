#!/usr/bin/env node
// Headstart installer. Works on Windows, macOS and Linux; needs Node 18+.
//
//   node install/install.mjs                 install (asks before changing anything)
//   node install/install.mjs --dry-run       show what would change, change nothing
//   node install/install.mjs --uninstall     take back what the installer added
//
// Options: --yes (no question), --source <owner/repo or folder> (where the plugin
// comes from), --no-plugin, --no-settings, --no-profile, --no-npmrc.
//
// What it changes, all inside your user folder:
//   1. Installs the "headstart" plugin through Claude Code's own plugin command.
//   2. Adds safety rules to Claude's settings.json (a dated backup is made first).
//   3. Creates the profile file CLAUDE.md only if you do not have one.
//   4. Adds two safety lines to ~/.npmrc, if npm is installed and supports them.
// It records exactly what it added in headstart-install.json so --uninstall can
// remove those things and nothing else.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The GitHub repo this kit is published from. Changed once when the repo is created.
export const DEFAULT_SOURCE = "cole10429/headstart";
const PLUGIN = "headstart";
const MARKETPLACE = "headstart";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

export function configDir(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
}

function quote(a) {
  return /[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

function run(cmd, args, opts = {}) {
  const line = [cmd, ...args.map(quote)].join(" ");
  const r = spawnSync(line, { shell: true, encoding: "utf8", ...opts });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim(), line };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function backup(file, manifest) {
  if (!fs.existsSync(file)) return;
  const copy = `${file}.headstart-backup-${stamp()}`;
  fs.copyFileSync(file, copy);
  manifest.backups.push(copy);
}

// Pure: returns the merged settings and what was added. Never removes or
// reorders anything the user already had.
export function mergeSettings(current, template) {
  const next = JSON.parse(JSON.stringify(current || {}));
  const added = { deny: [], ask: [], cleanupPeriodDays: false };
  next.permissions = next.permissions || {};
  for (const key of ["deny", "ask"]) {
    const have = Array.isArray(next.permissions[key]) ? next.permissions[key] : [];
    const allow = Array.isArray(next.permissions.allow) ? next.permissions.allow : [];
    for (const rule of template.permissions[key]) {
      // An "ask" rule the user already allows or denies outright is left alone.
      if (have.includes(rule)) continue;
      if (key === "ask" && (allow.includes(rule) || (next.permissions.deny || []).includes(rule))) continue;
      have.push(rule);
      added[key].push(rule);
    }
    next.permissions[key] = have;
  }
  if (next.cleanupPeriodDays === undefined) {
    next.cleanupPeriodDays = template.cleanupPeriodDays;
    added.cleanupPeriodDays = true;
  }
  return { next, added };
}

// Pure: takes back exactly what a manifest says was added.
export function unmergeSettings(current, added) {
  const next = JSON.parse(JSON.stringify(current || {}));
  for (const key of ["deny", "ask"]) {
    const list = next.permissions && next.permissions[key];
    if (Array.isArray(list)) next.permissions[key] = list.filter((r) => !(added[key] || []).includes(r));
  }
  // Only take back the value the installer set; a value the user changed since is theirs.
  if (added.cleanupPeriodDays && next.cleanupPeriodDays === 3650) delete next.cleanupPeriodDays;
  return next;
}

const NPMRC_HEADER = "# Added by Headstart: supply-chain guard. Remove these lines to undo.";
const NPMRC_LINES = {
  "ignore-scripts": "ignore-scripts=true",
  "min-release-age": "min-release-age=7",
};

// Pure: returns the new .npmrc text and which keys were added.
export function mergeNpmrc(text, supportedKeys) {
  const have = new Set((text || "").split(/\r?\n/).map((l) => l.split("=")[0].trim()).filter((k) => k && !k.startsWith("#") && !k.startsWith(";")));
  const add = Object.keys(NPMRC_LINES).filter((k) => supportedKeys.includes(k) && !have.has(k));
  if (!add.length) return { text: text || "", added: [] };
  const base = text && !text.endsWith("\n") ? text + "\n" : text || "";
  return { text: `${base}${NPMRC_HEADER}\n${add.map((k) => NPMRC_LINES[k]).join("\n")}\n`, added: add };
}

export function unmergeNpmrc(text, added) {
  const drop = new Set([NPMRC_HEADER, ...added.map((k) => NPMRC_LINES[k])]);
  return (text || "").split(/\r?\n/).filter((l) => !drop.has(l.trim())).join("\n");
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
}

function parseArgs(argv) {
  const o = { dryRun: false, uninstall: false, yes: false, plugin: true, settings: true, profile: true, npmrc: true, source: DEFAULT_SOURCE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--uninstall") o.uninstall = true;
    else if (a === "--yes" || a === "-y") o.yes = true;
    else if (a === "--no-plugin") o.plugin = false;
    else if (a === "--no-settings") o.settings = false;
    else if (a === "--no-profile") o.profile = false;
    else if (a === "--no-npmrc") o.npmrc = false;
    else if (a === "--source") o.source = argv[++i];
    else if (a === "--help" || a === "-h") o.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return o;
}

function npmSupportedKeys() {
  const r = run("npm", ["config", "ls", "-l"]);
  if (!r.ok) return null; // npm not installed
  return Object.keys(NPMRC_LINES).filter((k) => new RegExp(`^;?\\s*${k}\\s*=`, "m").test(r.out));
}

async function install(o) {
  const dir = configDir();
  const settingsFile = path.join(dir, "settings.json");
  const profileFile = path.join(dir, "CLAUDE.md");
  const manifestFile = path.join(dir, "headstart-install.json");
  const npmrcFile = path.join(os.homedir(), ".npmrc");
  const say = (s) => console.log(s);

  say(`\nHeadstart installer${o.dryRun ? " (dry run: nothing will change)" : ""}`);
  say(`Claude config folder: ${dir}\n`);

  // 1. What is on this computer
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 18) throw new Error(`Node ${process.versions.node} is too old. Install the current LTS from https://nodejs.org and run this again.`);
  const claude = run("claude", ["--version"]);
  if (o.plugin && !claude.ok) {
    throw new Error(
      "Claude Code was not found. Install it first, then run this again:\n" +
      "  Windows (PowerShell):  irm https://claude.ai/install.ps1 | iex\n" +
      "  macOS or Linux:        curl -fsSL https://claude.ai/install.sh | bash");
  }
  if (!run("git", ["--version"]).ok) say("Note: git was not found. Claude works without it, but you lose save points. https://git-scm.com/downloads\n");
  if (!run("gh", ["--version"]).ok) say("Note: the GitHub CLI (gh) was not found. Claude needs it to work with GitHub. https://cli.github.com\n");

  // 2. Work out the plan
  const template = readJson(path.join(repoRoot, "templates", "settings-safety.json"));
  let settings = {};
  if (o.settings && fs.existsSync(settingsFile)) {
    try { settings = readJson(settingsFile); } catch (e) {
      throw new Error(`Could not read ${settingsFile} (${e.message}). Fix or move that file first; nothing was changed.`);
    }
  }
  const merged = o.settings ? mergeSettings(settings, template) : null;
  const makeProfile = o.profile && !fs.existsSync(profileFile);
  const supported = o.npmrc ? npmSupportedKeys() : null;
  const npmrcText = fs.existsSync(npmrcFile) ? fs.readFileSync(npmrcFile, "utf8") : "";
  const npmrc = supported ? mergeNpmrc(npmrcText, supported) : { text: npmrcText, added: [] };

  say("Plan:");
  if (o.plugin) say(`  1. Install the "${PLUGIN}" plugin from ${o.source}`);
  if (merged) say(`  2. Settings: add ${merged.added.deny.length} block rules and ${merged.added.ask.length} ask-first rules` +
    (merged.added.cleanupPeriodDays ? ", keep session history for 10 years" : "") + ". Nothing you already have is removed.");
  if (o.profile) say(makeProfile ? "  3. Profile: create CLAUDE.md from the Headstart template" : "  3. Profile: you already have a CLAUDE.md, so it is left alone (/headstart:setup can add to it with your OK)");
  if (o.npmrc) say(supported === null ? "  4. npm: not installed, skipped" : npmrc.added.length ? `  4. npm: add ${npmrc.added.join(" and ")} to ${npmrcFile}` : "  4. npm: safety lines already present or not supported by this npm, skipped");
  say("");

  if (o.dryRun) return say("Dry run finished. Nothing was changed.");
  if (!o.yes) {
    const a = await ask("Go ahead? [Y/n] ");
    if (a && a !== "y" && a !== "yes") return say("Stopped. Nothing was changed.");
  }

  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : { added: { deny: [], ask: [], cleanupPeriodDays: false }, npmrc: [], profileCreated: false, backups: [], marketplaceAdded: false, pluginAdded: false };
  manifest.version = "0.1.0";
  manifest.installedAt = new Date().toISOString();
  fs.mkdirSync(dir, { recursive: true });

  if (o.plugin) {
    const add = run("claude", ["plugin", "marketplace", "add", o.source]);
    if (!add.ok && !/already/i.test(add.out)) throw new Error(`Could not add the plugin source.\n${add.out}`);
    if (!add.ok) run("claude", ["plugin", "marketplace", "update", MARKETPLACE]);
    if (add.ok) manifest.marketplaceAdded = true; // uninstall removes only what this installer added
    const inst = run("claude", ["plugin", "install", `${PLUGIN}@${MARKETPLACE}`, "--scope", "user"]);
    if (inst.ok && !/already installed/i.test(inst.out)) manifest.pluginAdded = true;
    if (!inst.ok && !/already installed/i.test(inst.out)) throw new Error(`Could not install the plugin.\n${inst.out}`);
    say("  done: plugin installed");
  }
  if (o.settings) {
    // Read the file again: installing the plugin just wrote "enabled" into it,
    // and saving the copy read earlier would wipe that out.
    const now = mergeSettings(fs.existsSync(settingsFile) ? readJson(settingsFile) : {}, template);
    if (now.added.deny.length || now.added.ask.length || now.added.cleanupPeriodDays) {
      backup(settingsFile, manifest);
      fs.writeFileSync(settingsFile, JSON.stringify(now.next, null, 2) + "\n");
      manifest.added.deny = [...new Set([...manifest.added.deny, ...now.added.deny])];
      manifest.added.ask = [...new Set([...manifest.added.ask, ...now.added.ask])];
      manifest.added.cleanupPeriodDays = manifest.added.cleanupPeriodDays || now.added.cleanupPeriodDays;
      say("  done: settings updated");
    }
  }
  if (makeProfile) {
    fs.copyFileSync(path.join(repoRoot, "templates", "profile.md"), profileFile);
    manifest.profileCreated = true;
    say("  done: profile created");
  }
  if (npmrc.added.length) {
    backup(npmrcFile, manifest);
    fs.writeFileSync(npmrcFile, npmrc.text);
    manifest.npmrc = [...new Set([...manifest.npmrc, ...npmrc.added])];
    say("  done: npm safety lines added");
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

  say("\nInstalled. Next: open Claude Code (restart it if it is open) and type  /headstart:setup");
  say("To undo everything the installer added:  node install/install.mjs --uninstall  (from a copy of this repo)");
}

async function uninstall(o) {
  const dir = configDir();
  const settingsFile = path.join(dir, "settings.json");
  const manifestFile = path.join(dir, "headstart-install.json");
  const npmrcFile = path.join(os.homedir(), ".npmrc");
  if (!fs.existsSync(manifestFile)) return console.log(`No install record found at ${manifestFile}. Nothing to undo.`);
  const manifest = readJson(manifestFile);

  console.log("\nHeadstart uninstall. This will:");
  console.log(`  - remove ${manifest.added.deny.length} block rules and ${manifest.added.ask.length} ask-first rules the installer added`);
  if (manifest.npmrc.length) console.log(`  - remove the npm lines it added (${manifest.npmrc.join(", ")})`);
  const removePlugin = o.plugin && manifest.pluginAdded !== false;
  const removeMarketplace = o.plugin && manifest.marketplaceAdded !== false;
  if (removePlugin) console.log(`  - uninstall the "${PLUGIN}" plugin`);
  if (manifest.added.cleanupPeriodDays) console.log("  - remove the 10-year session history setting, if it is still the value the installer set");
  console.log("  - leave your profile (CLAUDE.md), your tour progress and the dated backups where they are\n");
  if (o.dryRun) return console.log("Dry run finished. Nothing was changed.");
  if (!o.yes) {
    const a = await ask("Go ahead? [Y/n] ");
    if (a && a !== "y" && a !== "yes") return console.log("Stopped. Nothing was changed.");
  }

  if (fs.existsSync(settingsFile)) {
    fs.copyFileSync(settingsFile, `${settingsFile}.headstart-backup-${stamp()}`);
    fs.writeFileSync(settingsFile, JSON.stringify(unmergeSettings(readJson(settingsFile), manifest.added), null, 2) + "\n");
  }
  if (manifest.npmrc.length && fs.existsSync(npmrcFile)) {
    fs.writeFileSync(npmrcFile, unmergeNpmrc(fs.readFileSync(npmrcFile, "utf8"), manifest.npmrc));
  }
  const failed = [];
  if (removePlugin && !run("claude", ["plugin", "uninstall", `${PLUGIN}@${MARKETPLACE}`]).ok) failed.push("plugin");
  if (removeMarketplace && !run("claude", ["plugin", "marketplace", "remove", MARKETPLACE]).ok) failed.push("plugin source");
  if (failed.length) {
    console.log(`Settings and npm lines removed, but Claude Code could not remove the ${failed.join(" and ")}. ` +
      `Run  claude plugin uninstall ${PLUGIN}@${MARKETPLACE}  and  claude plugin marketplace remove ${MARKETPLACE}  yourself.`);
    return;
  }
  fs.rmSync(manifestFile);
  console.log("Removed. Your profile file and backups were left in place.");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.help) console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 18).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    else await (o.uninstall ? uninstall(o) : install(o));
  } catch (e) {
    console.error(`\nStopped: ${e.message}`);
    process.exit(1);
  }
}
