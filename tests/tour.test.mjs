// The tour hook: pacing, triggers and the typed commands.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lessons = JSON.parse(fs.readFileSync(path.join(root, "tour", "lessons.json"), "utf8")).lessons;

function world(t, { setupDone = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headstart-tour-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = path.join(dir, "config");
  const data = path.join(dir, "data");
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, "CLAUDE.md"), setupDone ? "# profile\n<!-- headstart:setup-done -->\n" : "# profile\n");
  const env = { ...process.env, CLAUDE_CONFIG_DIR: config, CLAUDE_PLUGIN_DATA: data, HEADSTART_TOUR: "" };
  const fire = (input) => {
    const r = spawnSync(process.execPath, [path.join(root, "hooks", "tour.js")], { input: JSON.stringify(input), encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : "";
  };
  const state = () => JSON.parse(fs.readFileSync(path.join(data, "tour.json"), "utf8"));
  const setState = (patch) => fs.writeFileSync(path.join(data, "tour.json"), JSON.stringify({ ...state(), ...patch }));
  return { fire, state, setState };
}

const start = (id) => ({ hook_event_name: "SessionStart", session_id: id, source: "startup" });
const prompt = (id, text) => ({ hook_event_name: "UserPromptSubmit", session_id: id, prompt: text });
const tool = (id, name, input = {}) => ({ hook_event_name: "PostToolUse", session_id: id, tool_name: name, tool_input: input });

test("lessons.json is well formed", () => {
  const ids = new Set();
  for (const l of lessons) {
    assert.ok(l.id && l.title && l.teach && l.more && l.when && l.when.event, `lesson ${l.id} is missing a field`);
    assert.ok(!ids.has(l.id), `duplicate id ${l.id}`);
    ids.add(l.id);
    assert.ok(["SessionStart", "UserPromptSubmit", "PostToolUse"].includes(l.when.event));
    for (const key of ["tool", "input", "prompt"]) if (l.when[key]) new RegExp(l.when[key], "i");
    assert.ok(l.teach.length <= 480, `${l.id}: teach is ${l.teach.length} characters, keep it short`);
    assert.doesNotMatch(l.teach + l.more, /—/, `${l.id}: no em dashes`);
  }
  assert.ok(lessons.length >= 15);
});

test("before setup: nudges toward /headstart:setup, and not every session", (t) => {
  const w = world(t, { setupDone: false });
  assert.match(w.fire(start("s1")), /\/headstart:setup/);
  assert.match(w.fire(start("s2")), /lesson "How to ask"/, "lessons still flow when setup was skipped");
  assert.equal(w.fire(start("s3")), "");
  assert.match(w.fire(start("s4")), /\/headstart:setup/);
});

test("one lesson per session, two per day, each lesson once", (t) => {
  const w = world(t);
  assert.match(w.fire(start("a")), /lesson "How to ask"/);
  assert.equal(w.fire(tool("a", "Edit", { file_path: "x.txt" })), "", "second lesson in the same session is held back");

  assert.equal(w.fire(start("b")), "");
  assert.match(w.fire(tool("b", "Edit", { file_path: "x.txt" })), /lesson "Undo and seeing changes"/);

  assert.equal(w.fire(start("c")), "");
  assert.equal(w.fire(tool("c", "Bash", { command: "ls" })), "", "third lesson on the same day is held back");

  // Next day: pretend the earlier lessons were seen yesterday.
  w.setState({ seen: { welcome: "2000-01-01", checkpoints: "2000-01-01" } });
  assert.match(w.fire(tool("c", "Bash", { command: "ls" })), /lesson "What the approval cards mean"/);
  w.setState({ seen: { welcome: "2000-01-01", checkpoints: "2000-01-01", permissions: "2000-01-01" } });
  assert.match(w.fire(start("d")), /lesson "Fresh sessions"/, "the fourth session brings the session lesson");
  w.setState({ seen: { welcome: "2000-01-01", checkpoints: "2000-01-01", permissions: "2000-01-01", context: "2000-01-01" } });
  assert.equal(w.fire(start("e")), "");
  assert.equal(w.fire(tool("e", "Edit", { file_path: "y.txt" })), "", "a lesson already seen never repeats");
});

test("triggers match the moment", (t) => {
  const cases = [
    [prompt("x", "my api key is not working"), "Passwords and keys"],
    [prompt("x", "make a website"), "Say what done looks like"],
    [prompt("x", "from now on use British spelling"), "Making it remember"],
    [prompt("x", "write an email to my landlord about the leak in the kitchen ceiling please"), "Text other people will read"],
    [tool("x", "Bash", { command: "git commit -m first" }), "What the approval cards mean"],
    [tool("x", "WebSearch", { query: "q" }), "Checking facts"],
    [tool("x", "Agent", { prompt: "p" }), "Helper agents"],
    [tool("x", "Skill", { skill: "headstart:handoff" }), "Skills"],
  ];
  for (const [input, title] of cases) {
    const w = world(t);
    w.fire(start("warm"));
    w.setState({ seen: { welcome: "2000-01-01" } });
    assert.match(w.fire(input), new RegExp(`lesson "${title}"`), JSON.stringify(input));
  }
});

test("git and package lessons come after the general command lesson", (t) => {
  const w = world(t);
  w.fire(start("warm"));
  w.setState({ seen: { welcome: "2000-01-01", permissions: "2000-01-01" } });
  assert.match(w.fire(tool("g", "Bash", { command: "git commit -m first" })), /lesson "Save points with git"/);
  w.setState({ seen: { welcome: "2000-01-01", permissions: "2000-01-01", git: "2000-01-01" } });
  assert.match(w.fire(tool("p", "Bash", { command: "npm install left-pad" })), /lesson "Installing other people's code"/);
});

test("two corrections in one session bring the restart lesson", (t) => {
  const w = world(t);
  w.fire(start("warm"));
  w.setState({ seen: { welcome: "2000-01-01" } });
  assert.equal(w.fire(prompt("k", "no, that's wrong")), "");
  assert.match(w.fire(prompt("k", "still not working")), /lesson "When it keeps getting it wrong"/);
});

test("typed commands: off, on, status, next, more, reset", (t) => {
  const w = world(t);
  w.fire(start("a"));
  assert.match(w.fire(prompt("a", "tour off")), /tour is now off/);
  assert.equal(w.state().pace, "off");
  assert.equal(w.fire(tool("z", "Edit", {})), "", "no lessons while off");
  assert.match(w.fire(prompt("a", "Tour on.")), /tour is now on/);
  assert.match(w.fire(prompt("a", "tour status")), new RegExp(`1 of ${lessons.length} lessons seen`));
  assert.match(w.fire(prompt("a", "/headstart:tour next")), /next tour lesson, "Passwords and keys"/);
  assert.match(w.fire(prompt("a", "tour more")), /wants more on the tour lesson "Passwords and keys"/);
  assert.match(w.fire(prompt("a", "tour reset")), /reset/);
  assert.deepEqual(w.state().seen, {});
  assert.equal(w.fire(prompt("a", "take me on a tour of the code")), "", "ordinary sentences are not commands");
});

test("the limits lesson waits for the first message of a later session", (t) => {
  const w = world(t);
  w.fire(start("one"));
  w.setState({ seen: { welcome: "2000-01-01" } });
  assert.doesNotMatch(w.fire(prompt("one", "list the files here")), /Your usage limits/, "not in the first session");
  w.fire(start("two"));
  assert.match(w.fire(prompt("two", "list the files here")), /lesson "Your usage limits"/);
});

test("HEADSTART_TOUR=off silences everything", (t) => {
  const w = world(t);
  const r = spawnSync(process.execPath, [path.join(root, "hooks", "tour.js")], {
    input: JSON.stringify(start("a")), encoding: "utf8", env: { ...process.env, HEADSTART_TOUR: "off" },
  });
  assert.equal(r.stdout, "");
  assert.ok(w);
});
