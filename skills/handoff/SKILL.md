---
name: handoff
description: End a session cleanly and continue in a fresh one. The project's own notes become the handoff, then the next session starts from a short pointer. Use when the user types /headstart:handoff or asks for a fresh or new session, to hand off, or to wrap up and continue later. Offer it when a task is done or the conversation has grown long; never run it unasked.
---

# Handoff

The project's own notes are the handoff, so the next session needs only a pointer. Chat, scratch files and memory are never the only copy of anything.

## 1. Find the home doc

The project's notes file for agents: `CLAUDE.md` (or `AGENTS.md` if the project uses that) in the project folder. Its "Open items" section is the handoff. If there is none, add `## Open items`, creating the file if needed. Never use the README for this: other people read READMEs. Work that belongs to no project (the user's own Claude setup) goes in a `## Open items` section at the end of the user's profile file, kept to a few lines.

## 2. Reconcile: rewrite, never append

Rewrite the section so it is what the next session needs right now:
- One line per item: what, where (file and line, or doc section), the next action, and who decides ("waiting on you" when it waits on the user).
- Remove finished items and merge duplicates. History belongs in git log, not here. More than about 15 lines means it has become a log: trim it.
- Bring in anything this session left only in chat, a scratch file or memory: decisions, gotchas, commands that matter.
- Facts that are not open items go in the doc's own sections (how to run and test, decisions made), not in Open items.

## 3. Clean up

- List what this session changed: `git status` in a git folder, plus what you remember creating elsewhere.
- Put back anything you changed only to test. Delete scratch files this session or its helpers made, by exact path. Ask before deleting anything else.

## 4. Commit

In a git folder, commit this session's own changes; running the handoff is the user's approval for that commit. Leave out files another session may have been editing: list those and ask. Never push. Not a git folder: skip this step and say so.

On a branch or worktree: the next session must start where the updated notes are. Start it from this branch, or ask the user to merge first. A fresh session on the main branch would read stale notes.

## 5. Start the next session

Write a brief of at most three lines: the folder; "Read <home doc>, Open items, first"; the next step and whether it waits on the user. Everything else is already in the doc.

If you have a tool that starts a new session, use it with that brief. Otherwise print the brief in one block for the user to paste into a new session.

## 6. Report

A short table of what was touched (each file or setting, committed or not), the commit id if there is one, and the one thing the next session will do first.
