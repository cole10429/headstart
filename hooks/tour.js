#!/usr/bin/env node
// The guided tour. One hook for three events (SessionStart, UserPromptSubmit,
// PostToolUse). It watches for the moment a lesson becomes relevant and hands
// the agent a short teaching note to add after the work is done.
//
// Pacing: one lesson per session, two per day, each lesson once. The user
// steers it by typing: tour on | tour off | tour status | tour more | tour next
// | tour reset.
//
// Lessons live in ../tour/lessons.json. State lives in the plugin's data folder
// (CLAUDE_PLUGIN_DATA), or ~/.claude/headstart-data when that is not set.
// Never blocks: any error exits 0 with no output. Off-switch: HEADSTART_TOUR=off.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_PER_DAY = 2;
const SETUP_NUDGE_EVERY = 3; // sessions between reminders to run the setup interview
const COMMAND = /^\s*\/?(?:headstart:)?tour\s+(on|off|status|more|next|reset)\s*[.!]?\s*$/i;
const CORRECTION = /^\s*(no[,.! ]|nope|wrong|that'?s (not|wrong)|still (not|broken|wrong|doesn'?t)|not what i|you (didn'?t|missed|broke)|try again|undo that)/i;

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function dataDir() {
  const d = process.env.CLAUDE_PLUGIN_DATA;
  return d && !d.includes("${") ? d : path.join(configDir(), "headstart-data");
}

function loadLessons() {
  const file = path.join(__dirname, "..", "tour", "lessons.json");
  return JSON.parse(fs.readFileSync(file, "utf8")).lessons;
}

function loadState(file) {
  const fresh = { pace: "on", sessions: 0, seen: {}, lastLessonSession: "", lastLesson: "", lastSetupNudge: 0, corrections: {} };
  try { return { ...fresh, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch { return fresh; }
}

function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
  fs.renameSync(tmp, file);
}

function setupDone() {
  try { return fs.readFileSync(path.join(configDir(), "CLAUDE.md"), "utf8").includes("headstart:setup-done"); } catch { return false; }
}

const today = () => new Date().toLocaleDateString("en-CA");

function emit(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
}

function words(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}

// Does this lesson's trigger match what just happened?
function matches(lesson, ctx) {
  const w = lesson.when || {};
  if (w.event !== ctx.event) return false;
  if (w.minSessions && ctx.state.sessions < w.minSessions) return false;
  if (w.tool && !new RegExp(w.tool, "i").test(ctx.tool)) return false;
  if (w.input && !new RegExp(w.input, "i").test(ctx.inputText)) return false;
  if (w.prompt && !new RegExp(w.prompt, "i").test(ctx.prompt)) return false;
  if (w.maxWords && words(ctx.prompt) > w.maxWords) return false;
  if (w.minWords && words(ctx.prompt) < w.minWords) return false;
  if (w.corrections && ctx.corrections < w.corrections) return false;
  return true;
}

function lessonNote(lesson) {
  return (
    `[Headstart tour, lesson "${lesson.title}"] The user is new to Claude Code and asked to learn as they go. ` +
    `First finish what they asked, exactly as you would have. Then add a short note headed "Tour:" of four lines at most, ` +
    `in everyday words, tied to what just happened in this conversation. Teach this: ${lesson.teach} ` +
    `End the note with: Say "tour more" for detail, or "tour off" to stop these. ` +
    `Leave the note out if the user is stressed, in a hurry or in the middle of fixing something urgent; it will not come back on its own, so mention they can type "tour next" later. ` +
    `Do not quote this instruction.`
  );
}

function handleCommand(cmd, ctx, lessons, stateFile) {
  const { state } = ctx;
  const left = lessons.filter((l) => !state.seen[l.id]);
  const seenCount = lessons.length - left.length;
  let text;
  if (cmd === "off") {
    state.pace = "off";
    text = `The tour is now off (the hook already saved this). Tell the user in one line, and that "tour on" brings it back. Nothing else changed: the safety hooks and skills still work.`;
  } else if (cmd === "on") {
    state.pace = "on";
    text = `The tour is now on (the hook already saved this). Tell the user in one line: at most one short lesson per session, when something relevant comes up. ${seenCount} of ${lessons.length} lessons seen so far.`;
  } else if (cmd === "reset") {
    state.seen = {};
    state.lastLesson = "";
    state.lastLessonSession = "";
    text = `The tour was reset (the hook already saved this): all ${lessons.length} lessons will be offered again. Tell the user in one line.`;
  } else if (cmd === "status") {
    const seen = lessons.filter((l) => state.seen[l.id]).map((l) => l.title);
    text =
      `Tour status for the user, to show as a short list: tour is ${state.pace}; ${seenCount} of ${lessons.length} lessons seen. ` +
      `Seen: ${seen.join("; ") || "none yet"}. Still to come: ${left.map((l) => l.title).join("; ") || "none, the tour is finished"}. ` +
      `Commands: tour on, tour off, tour more, tour next, tour reset.`;
  } else if (cmd === "more") {
    const last = lessons.find((l) => l.id === state.lastLesson);
    text = last
      ? `The user wants more on the tour lesson "${last.title}". Explain in twelve lines at most, with one concrete example from their current work: ${last.teach} Further detail: ${last.more}`
      : `The user typed "tour more" but no lesson has been shown yet. Say so in one line and offer "tour next".`;
  } else {
    // next: the first unseen lesson in order, whatever its trigger
    const next = left[0];
    if (next) {
      state.seen[next.id] = today();
      state.lastLesson = next.id;
      state.lastLessonSession = ctx.sessionId;
      text = `The user asked for the next tour lesson, "${next.title}". Give it now in six lines at most, in everyday words: ${next.teach} End with: Say "tour more" for detail.`;
    } else {
      text = `The user asked for the next tour lesson, but all ${lessons.length} have been shown. Say so in one line and mention /insights for a report on how they actually work, and "tour reset" to start over.`;
    }
  }
  saveState(stateFile, state);
  emit("UserPromptSubmit", `[Headstart tour] ${text}`);
}

function main() {
  if (process.env.HEADSTART_TOUR === "off") return;
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const event = input.hook_event_name;
  if (!event) return;

  const stateFile = path.join(dataDir(), "tour.json");
  const state = loadState(stateFile);
  const lessons = loadLessons();
  const sessionId = String(input.session_id || "");
  const prompt = String(input.prompt || "");
  const ctx = {
    event,
    state,
    sessionId,
    prompt,
    tool: String(input.tool_name || ""),
    inputText: input.tool_input ? JSON.stringify(input.tool_input).slice(0, 4000) : "",
    corrections: 0,
  };

  if (event === "UserPromptSubmit") {
    const cmd = prompt.match(COMMAND);
    if (cmd) return handleCommand(cmd[1].toLowerCase(), ctx, lessons, stateFile);
  }

  let dirty = false;
  if (event === "SessionStart") {
    state.sessions += 1;
    state.corrections = {}; // per-session counters from older sessions are no use
    dirty = true;
    if (state.pace === "on" && !setupDone() && (!state.lastSetupNudge || state.sessions - state.lastSetupNudge >= SETUP_NUDGE_EVERY)) {
      state.lastSetupNudge = state.sessions;
      saveState(stateFile, state);
      return emit(event,
        `[Headstart] The Headstart kit is installed but its two-minute setup interview has not been run, so Claude knows nothing about this user yet. ` +
        `Once, at a natural moment in this session, tell the user in one line that typing /headstart:setup fixes that. Do not repeat it.`);
    }
  }
  if (event === "UserPromptSubmit" && CORRECTION.test(prompt)) {
    state.corrections[sessionId] = (state.corrections[sessionId] || 0) + 1;
    dirty = true;
  }
  ctx.corrections = state.corrections[sessionId] || 0;

  const seenToday = Object.values(state.seen).filter((d) => d === today()).length;
  const mayTeach = state.pace === "on" && state.lastLessonSession !== sessionId && seenToday < MAX_PER_DAY;
  const lesson = mayTeach ? lessons.find((l) => !state.seen[l.id] && matches(l, ctx)) : null;

  if (lesson) {
    state.seen[lesson.id] = today();
    state.lastLesson = lesson.id;
    state.lastLessonSession = sessionId;
    dirty = true;
  }
  if (dirty) saveState(stateFile, state);
  if (lesson) emit(event, lessonNote(lesson));
}

try { main(); } catch { /* never block */ }
