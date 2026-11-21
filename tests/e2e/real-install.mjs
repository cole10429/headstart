// End-to-end check: a real install into a throwaway Claude config folder, using
// Claude Code's own plugin command, then an uninstall. Your real setup is not
// touched: CLAUDE_CONFIG_DIR points everything at a temp folder that is deleted
// at the end. Needs Claude Code on PATH. Run with: npm run test:install
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headstart-e2e-"));
const env = { ...process.env, CLAUDE_CONFIG_DIR: dir };
const installer = path.join(root, "install", "install.mjs");

function step(title, cmd, args) {
  const r = cmd === "claude"
    ? spawnSync(["claude", ...args].join(" "), { encoding: "utf8", env, shell: true })
    : spawnSync(cmd, args, { encoding: "utf8", env });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  console.log(`\n--- ${title}\n${out}`);
  return { status: r.status, out };
}

try {
  console.log(`Throwaway config folder: ${dir}`);

  const inst = step("install", process.execPath, [installer, "--source", root, "--yes", "--no-npmrc"]);
  assert.equal(inst.status, 0, "installer failed");

  const list = step("claude plugin list", "claude", ["plugin", "list"]);
  assert.match(list.out, /headstart@headstart/, "plugin is not listed as installed");
  assert.match(list.out, /Status:.*enabled/, "plugin status line missing");
  assert.doesNotMatch(list.out, /disabled/, "plugin was installed but is disabled");

  const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"));
  assert.ok(settings.permissions.deny.includes("Read(**/*credentials*)"), "deny rules missing");
  assert.ok(settings.permissions.ask.includes("Bash(git push:*)"), "ask rules missing");
  assert.equal(settings.cleanupPeriodDays, 3650);
  assert.match(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), /headstart:about-start/);
  console.log("\n--- settings and profile: as expected");

  const again = step("install a second time", process.execPath, [installer, "--source", root, "--yes", "--no-npmrc"]);
  assert.equal(again.status, 0, "second install failed");
  assert.doesNotMatch(step("claude plugin list after second install", "claude", ["plugin", "list"]).out, /disabled/);

  const undo = step("uninstall", process.execPath, [installer, "--uninstall", "--yes"]);
  assert.equal(undo.status, 0, "uninstall failed");
  const after = step("claude plugin list after uninstall", "claude", ["plugin", "list"]);
  assert.doesNotMatch(after.out, /headstart@headstart/, "plugin is still installed");
  const restored = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8"));
  assert.deepEqual(restored.permissions.deny, []);
  assert.deepEqual(restored.permissions.ask, []);

  console.log("\nPASS: real install, re-install and uninstall all worked in the throwaway folder.");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`Deleted ${dir}`);
}
