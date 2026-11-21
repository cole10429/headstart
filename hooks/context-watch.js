#!/usr/bin/env node
// UserPromptSubmit hook. Tells the model how big the conversation is once it
// passes 250k tokens, and again at each further 50k, so it offers a handoff at
// the next natural break. Says nothing below 250k or when the size band has not
// changed. Never blocks: any error exits 0 with no output.
//
// Why: this is about cost and speed, not running out of room. Every turn in a
// long conversation re-reads all of it. Off-switch: CONTEXT_WATCH=off.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const FIRST = 250000;
const STEP = 50000;
const TAIL_BYTES = 4 * 1024 * 1024;

function lastContextTokens(file) {
  const size = fs.statSync(file).size;
  const start = Math.max(0, size - TAIL_BYTES);
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  const lines = buf.toString("utf8").split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || !line.includes('"usage"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== "assistant" || o.isSidechain || !o.message || !o.message.usage) continue;
    const u = o.message.usage;
    return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  return 0;
}

function main() {
  if (process.env.CONTEXT_WATCH === "off") return;
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  if (!input.transcript_path || !input.session_id) return;
  const tokens = lastContextTokens(input.transcript_path);
  const band = tokens < FIRST ? 0 : 1 + Math.floor((tokens - FIRST) / STEP);

  const dir = path.join(os.tmpdir(), "headstart-context-watch");
  const stateFile = path.join(dir, String(input.session_id).replace(/[^A-Za-z0-9_-]/g, "_") + ".txt");
  let last = 0;
  try { last = Number(fs.readFileSync(stateFile, "utf8")) || 0; } catch {}
  if (band === last) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile, String(band));
  if (band < last) return; // context shrank (compact or clear): reset quietly

  const k = Math.round(tokens / 1000);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        `context-watch: this conversation is about ${k}k tokens, and every turn now re-reads all of it. ` +
        `At the next natural break, offer the user a handoff to a fresh session (the headstart:handoff skill) ` +
        `in one plain line saying why. Offer it; never run it unasked.`,
    },
  }));
}

try { main(); } catch {}
