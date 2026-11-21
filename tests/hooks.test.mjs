// Runs each hook the way Claude Code does: JSON on stdin, decision on stdout.
// No network. Run from the repo root with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hook = (name) => path.join(root, "hooks", name);

function runHook(name, input, env = {}) {
  const r = spawnSync(process.execPath, [hook(name)], {
    input: JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch {}
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json, out: json && json.hookSpecificOutput };
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headstart-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

test("block-no-verify: blocks skipped git checks, allows normal git", () => {
  assert.equal(runHook("block-no-verify.js", bash('git commit --no-verify -m "x"')).status, 2);
  assert.equal(runHook("block-no-verify.js", bash('git commit -n -m "x"')).status, 2);
  assert.equal(runHook("block-no-verify.js", bash("git -c core.hooksPath=/dev/null commit -m x")).status, 2);
  assert.equal(runHook("block-no-verify.js", bash('git commit -m "x"')).status, 0);
  assert.equal(runHook("block-no-verify.js", bash('git commit -m "x" && grep -n foo file.txt')).status, 0);
  assert.equal(runHook("block-no-verify.js", bash("ls -la")).status, 0);
});

test("test-guard: asks before changing an existing test, silent otherwise", (t) => {
  const dir = tempDir(t);
  fs.mkdirSync(path.join(dir, "tests"));
  const existing = path.join(dir, "tests", "math.test.js");
  fs.writeFileSync(existing, "expect(add(1, 2)).toBe(3);\nexpect(add(2, 2)).toBe(4);\n");

  const edit = runHook("test-guard.js", {
    tool_name: "Edit", cwd: dir,
    tool_input: { file_path: existing, old_string: "expect(add(2, 2)).toBe(4);", new_string: "" },
  });
  assert.equal(edit.out.permissionDecision, "ask");
  assert.match(edit.out.permissionDecisionReason, /removes 1 assertion/);
  assert.match(edit.out.permissionDecisionReason, /tests\/math\.test\.js/);

  const fresh = runHook("test-guard.js", {
    tool_name: "Write", cwd: dir,
    tool_input: { file_path: path.join(dir, "tests", "new.test.js"), content: "expect(1).toBe(1);" },
  });
  assert.equal(fresh.stdout, "");

  const normal = runHook("test-guard.js", {
    tool_name: "Edit", cwd: dir,
    tool_input: { file_path: path.join(dir, "app.js"), old_string: "a", new_string: "b" },
  });
  assert.equal(normal.stdout, "");

  const off = runHook("test-guard.js", {
    tool_name: "Edit", cwd: dir,
    tool_input: { file_path: existing, old_string: "expect(add(2, 2)).toBe(4);", new_string: "" },
  }, { TEST_GUARD: "off" });
  assert.equal(off.stdout, "");
});

test("instruction-gate: blocks the first instruction-file edit once, then passes", (t) => {
  const dir = tempDir(t);
  const session = "gate" + Date.now();
  const input = { session_id: session, tool_name: "Edit", tool_input: { file_path: path.join(dir, "CLAUDE.md") } };

  const first = runHook("instruction-gate.js", input);
  assert.equal(first.out.permissionDecision, "deny");
  assert.match(first.out.permissionDecisionReason, /instruction-edit/);
  assert.equal(runHook("instruction-gate.js", input).stdout, "", "second call in the same session passes");

  const other = runHook("instruction-gate.js", { session_id: session + "b", tool_name: "Edit", tool_input: { file_path: path.join(dir, "notes.md") } });
  assert.equal(other.stdout, "", "ordinary files are never gated");

  const transcript = path.join(dir, "t.jsonl");
  fs.writeFileSync(transcript, JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "headstart:instruction-edit" } }] } }) + "\n");
  const loaded = runHook("instruction-gate.js", { session_id: session + "c", transcript_path: transcript, tool_name: "Write", tool_input: { file_path: path.join(dir, "skills", "x", "SKILL.md") } });
  assert.equal(loaded.stdout, "", "passes when the skill was loaded in this session");

  for (const s of [session, session + "b", session + "c"]) {
    fs.rmSync(path.join(os.tmpdir(), "headstart-instruction-gate", s.replace(/\W/g, "")), { force: true });
  }
});

test("context-watch: speaks once past 250k tokens, silent below", (t) => {
  const dir = tempDir(t);
  const line = (tokens) => JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 10, cache_read_input_tokens: tokens, cache_creation_input_tokens: 0 } } }) + "\n";
  const small = path.join(dir, "small.jsonl");
  const big = path.join(dir, "big.jsonl");
  fs.writeFileSync(small, line(40000));
  fs.writeFileSync(big, line(301000));
  const id = "cw" + Date.now();

  assert.equal(runHook("context-watch.js", { session_id: id + "a", transcript_path: small }).stdout, "");
  const first = runHook("context-watch.js", { session_id: id + "b", transcript_path: big });
  assert.match(first.out.additionalContext, /about 301k tokens/);
  assert.match(first.out.additionalContext, /handoff/);
  assert.equal(runHook("context-watch.js", { session_id: id + "b", transcript_path: big }).stdout, "", "same size band stays quiet");

  for (const s of ["a", "b"]) fs.rmSync(path.join(os.tmpdir(), "headstart-context-watch", id + s + ".txt"), { force: true });
});

test("package-vet: ignores commands that install nothing new, blocks unverifiable sources (no network needed)", () => {
  assert.equal(runHook("package-vet.js", bash("ls -la")).stdout, "");
  assert.equal(runHook("package-vet.js", bash("npm install")).stdout, "", "lockfile install is not a new package");
  assert.equal(runHook("package-vet.js", bash("npm run build 2>&1")).stdout, "");
  const local = runHook("package-vet.js", bash("npm install ./some-folder"));
  assert.equal(local.out.permissionDecision, "deny");
  assert.match(local.out.permissionDecisionReason, /not checkable against the registry/);
  const scripts = runHook("package-vet.js", bash("npm rebuild --ignore-scripts=false"));
  assert.equal(scripts.out.permissionDecision, "deny");
  for (const r of [local, scripts]) assert.match(r.out.permissionDecisionReason, /Report these findings to the user/);
});

test("hooks.json: every command points at a hook file that exists", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, "hooks", "hooks.json"), "utf8"));
  const files = new Set();
  for (const groups of Object.values(cfg.hooks)) {
    for (const g of groups) for (const h of g.hooks) {
      const m = h.command.match(/^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([\w-]+\.js)"$/);
      assert.ok(m, `unexpected command shape: ${h.command}`);
      files.add(m[1]);
    }
  }
  for (const f of files) assert.ok(fs.existsSync(hook(f)), `${f} is missing`);
  assert.equal(files.size, 6);
});
