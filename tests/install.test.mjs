// The installer: merging is additive, and uninstall takes back exactly what was added.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeSettings, unmergeSettings, mergeNpmrc, unmergeNpmrc } from "../install/install.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = JSON.parse(fs.readFileSync(path.join(root, "templates", "settings-safety.json"), "utf8"));

test("mergeSettings keeps everything the user had and adds only what is missing", () => {
  const mine = {
    model: "sonnet",
    cleanupPeriodDays: 30,
    permissions: { allow: ["Bash(git push:*)", "WebSearch"], deny: ["Read(.env)"], ask: ["Bash(my-thing:*)"], defaultMode: "plan" },
    hooks: { Stop: [] },
  };
  const { next, added } = mergeSettings(mine, template);
  assert.equal(next.model, "sonnet");
  assert.equal(next.cleanupPeriodDays, 30, "an existing value is not overwritten");
  assert.equal(added.cleanupPeriodDays, false);
  assert.equal(next.permissions.defaultMode, "plan");
  assert.deepEqual(next.permissions.allow, mine.permissions.allow);
  assert.deepEqual(next.hooks, { Stop: [] });
  assert.equal(next.permissions.deny.filter((r) => r === "Read(.env)").length, 1, "no duplicates");
  assert.ok(next.permissions.ask.includes("Bash(my-thing:*)"));
  assert.ok(!next.permissions.ask.includes("Bash(git push:*)"), "a rule the user already allows is left alone");
  assert.ok(next.permissions.ask.includes("Bash(rm -rf:*)"));
  assert.equal(added.deny.length, template.permissions.deny.length - 1);
});

test("merge then unmerge returns the original settings", () => {
  const mine = { permissions: { deny: ["Read(.env)"] }, theme: "dark" };
  const { next, added } = mergeSettings(mine, template);
  const back = unmergeSettings(next, added);
  assert.deepEqual(back.permissions.deny, ["Read(.env)"]);
  assert.deepEqual(back.permissions.ask, []);
  assert.equal(back.cleanupPeriodDays, undefined);
  assert.equal(back.theme, "dark");
});

test("mergeSettings on an empty file", () => {
  const { next, added } = mergeSettings({}, template);
  assert.equal(next.cleanupPeriodDays, 3650);
  assert.equal(added.deny.length, template.permissions.deny.length);
  assert.equal(added.ask.length, template.permissions.ask.length);
});

test("npmrc lines are added once, only when npm supports them, and removed cleanly", () => {
  const both = mergeNpmrc("registry=https://registry.npmjs.org/", ["ignore-scripts", "min-release-age"]);
  assert.deepEqual(both.added, ["ignore-scripts", "min-release-age"]);
  assert.match(both.text, /^registry=.*\n# Added by Headstart.*\nignore-scripts=true\nmin-release-age=7\n$/s);
  assert.deepEqual(mergeNpmrc(both.text, ["ignore-scripts", "min-release-age"]).added, [], "second run adds nothing");
  assert.deepEqual(mergeNpmrc("ignore-scripts=false\n", ["ignore-scripts"]).added, [], "the user's own choice wins");
  assert.deepEqual(mergeNpmrc("", ["ignore-scripts"]).added, ["ignore-scripts"], "old npm: only the supported key");
  assert.equal(unmergeNpmrc(both.text, both.added).trim(), "registry=https://registry.npmjs.org/");
});

test("full run in a throwaway config folder: install, re-install, uninstall", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headstart-install-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const settings = path.join(dir, "settings.json");
  fs.writeFileSync(settings, JSON.stringify({ model: "sonnet", permissions: { allow: ["WebSearch"] } }));
  const run = (...args) => spawnSync(process.execPath, [path.join(root, "install", "install.mjs"), "--no-plugin", "--no-npmrc", "--yes", ...args], {
    encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
  });

  const dry = run("--dry-run");
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Nothing was changed/);
  assert.ok(!fs.existsSync(path.join(dir, "CLAUDE.md")), "dry run writes nothing");

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const after = JSON.parse(fs.readFileSync(settings, "utf8"));
  assert.equal(after.model, "sonnet");
  assert.deepEqual(after.permissions.allow, ["WebSearch"]);
  assert.ok(after.permissions.deny.includes("Read(**/*credentials*)"));
  assert.match(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), /headstart:about-start/);
  assert.equal(fs.readdirSync(dir).filter((f) => f.startsWith("settings.json.headstart-backup-")).length, 1);

  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "my own profile\n");
  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8"), "my own profile\n", "an existing profile is never overwritten");
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, "utf8")), after, "running twice changes nothing more");

  const undo = run("--uninstall");
  assert.equal(undo.status, 0, undo.stderr);
  const restored = JSON.parse(fs.readFileSync(settings, "utf8"));
  assert.deepEqual(restored.permissions.deny, []);
  assert.deepEqual(restored.permissions.allow, ["WebSearch"]);
  assert.equal(restored.model, "sonnet");
  assert.ok(fs.existsSync(path.join(dir, "CLAUDE.md")), "the profile is the user's and stays");
  assert.ok(!fs.existsSync(path.join(dir, "headstart-install.json")));
});

test("a broken settings.json stops the install before anything changes", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headstart-install-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "settings.json"), "{ not json");
  const r = spawnSync(process.execPath, [path.join(root, "install", "install.mjs"), "--no-plugin", "--no-npmrc", "--yes"], {
    encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /nothing was changed/i);
  assert.equal(fs.readFileSync(path.join(dir, "settings.json"), "utf8"), "{ not json");
  assert.ok(!fs.existsSync(path.join(dir, "CLAUDE.md")));
});
