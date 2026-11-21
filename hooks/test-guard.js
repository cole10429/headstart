#!/usr/bin/env node
// PreToolUse hook (Edit|Write): ask the user before Claude changes an existing test,
// eval, fixture, snapshot or ground-truth file. New test files pass silently.
//
// Why: a test defines "done". Editing one to make it pass hides the failure
// instead of fixing it, and no other gate sees it (running the
// tests cannot tell a fixed bug from a weakened test).
//
// Own-branch files: a test file that git does not track yet,
// or that was added by a commit no other local branch holds, belongs to the
// work in progress on this branch, so editing it passes silently too, unless
// the edit removes assertions. Any git failure falls back to asking.
//
// Fail-open: any error allows the call. Off-switch: TEST_GUARD=off.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIR_RE = /(^|\/)(tests?|__tests__|specs?|evals?|fixtures|__snapshots__|golden|synthetic)\//i;
const FILE_RE = /(\.(test|spec|eval)\.[a-z0-9]+$)|(_test\.(py|go|dart|ps1)$)|(^test_[^/]*\.py$)|(\.snap$)|(^(truth|expected|golden)[^/]*\.json$)/i;
const ASSERT_RE = /\b(assert\w*|expect|should|toBe\w*|toEqual|toMatch\w*|toThrow|Should\s+-|Assert\.)/;

function count(text) {
  return (text || "").split("\n").filter((l) => ASSERT_RE.test(l)).length;
}

function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] }).trim();
}

// True when the file is this branch's own: untracked, or added by a commit that
// only the current local branch holds. False on any doubt.
function ownBranchFile(file) {
  try {
    const dir = path.dirname(file);
    try {
      git(dir, ["ls-files", "--error-unmatch", "--", file]);
    } catch {
      // Not tracked. Only "own" if we are inside a git work tree at all.
      return git(dir, ["rev-parse", "--is-inside-work-tree"]) === "true";
    }
    const branch = git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch || branch === "HEAD") return false; // detached
    const added = git(dir, ["log", "--diff-filter=A", "--format=%H", "-1", "--", file]);
    if (!added) return false;
    const holders = git(dir, ["branch", "--contains", added, "--format=%(refname:short)"])
      .split("\n").map((s) => s.trim()).filter(Boolean);
    return holders.length === 1 && holders[0] === branch;
  } catch {
    return false;
  }
}

function main() {
  if (process.env.TEST_GUARD === "off") return;
  let input;
  try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { return; }
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  const file = String(ti.file_path || "").replace(/\\/g, "/");
  if (!file || !/^(Edit|Write|MultiEdit)$/.test(tool || "")) return;

  const base = path.posix.basename(file);
  if (!DIR_RE.test(file) && !FILE_RE.test(base)) return;
  if (!fs.existsSync(file)) return; // a new test file is fine

  let before = 0, after = 0;
  if (tool === "Edit") { before = count(ti.old_string); after = count(ti.new_string); }
  else if (tool === "MultiEdit") {
    for (const e of ti.edits || []) { before += count(e.old_string); after += count(e.new_string); }
  } else {
    try { before = count(fs.readFileSync(file, "utf8")); } catch {}
    after = count(ti.content);
  }
  const removes = after < before;
  if (!removes && ownBranchFile(file)) return; // this branch's own test, nothing removed
  const delta = removes ? ` It removes ${before - after} assertion(s).` : "";

  const cwd = String(input.cwd || "").replace(/\\/g, "/");
  const shown = cwd && file.toLowerCase().startsWith(cwd.toLowerCase() + "/") ? file.slice(cwd.length + 1) : file;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason:
        `test-guard: Claude wants to change an existing test or truth file: ${shown}.${delta} ` +
        `Approve only if you asked for this test to change, or Claude explained in chat why the test itself was wrong.`,
    },
  }));
}

try { main(); } catch { /* fail open */ }
