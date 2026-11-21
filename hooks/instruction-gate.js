#!/usr/bin/env node
// PreToolUse hook (Write|Edit|MultiEdit): the first time a session edits an AI
// instruction file without loading the instruction-edit skill, block the call
// once and say to load it. Later calls pass.
//
// Why: instruction files grow into journals, and a long file makes Claude skip
// the rules that matter. A written "keep it short" rule did not hold; a gate did.
//
// Fail-open: any error allows the call. Off-switch: INSTRUCTION_GATE=off.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const SKILL = "instruction-edit";
// CLAUDE.md, CLAUDE.local.md, AGENTS.md, .claude/rules/*.md, memory notes, SKILL.md.
const TARGET = /(^|\/)(CLAUDE(\.local)?\.md|AGENTS\.md|SKILL\.md)$|\/\.claude\/rules\/[^/]+\.md$|\/\.claude\/projects\/[^/]+\/memory\/[^/]+\.md$/i;

function main() {
  if (process.env.INSTRUCTION_GATE === "off") return;
  const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const file = String((input.tool_input || {}).file_path || "").replace(/\\/g, "/");
  if (!TARGET.test(file)) return;
  if (/\/node_modules\/|\/backups\//i.test(file)) return;

  // Already loaded in this session? (plain or plugin-prefixed skill name)
  const loaded = new RegExp(`"skill"\\s*:\\s*"(?:[\\w-]+:)?${SKILL}"`);
  try {
    if (input.transcript_path && loaded.test(fs.readFileSync(input.transcript_path, "utf8"))) return;
  } catch {}

  // Block only once per session, so a helper agent or a mismatch can never loop.
  const dir = path.join(os.tmpdir(), "headstart-instruction-gate");
  const marker = path.join(dir, String(input.session_id || "nosession").replace(/\W/g, ""));
  if (fs.existsSync(marker)) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(marker, "");

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `Load the ${SKILL} skill (Skill tool, "headstart:${SKILL}") before editing AI instruction files, then retry this call.`,
    },
  }));
}

try { main(); } catch { /* fail open */ }
