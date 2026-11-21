---
name: instruction-edit
description: Required before any edit to an AI instruction file (CLAUDE.md, CLAUDE.local.md, AGENTS.md, .claude/rules, memory notes, SKILL.md). Decides whether a line belongs, where it goes and how short it must be, then checks the size budget. A hook blocks those edits until this skill is loaded.
---

# Editing AI instruction files

Always-loaded files cost attention in every session, and long ones make Claude skip the rules that matter. The test for each line: would Claude make a mistake without it? If not, cut it. Default to editing or deleting an existing line, not adding one.

## 1. Does it earn a line?

All three must hold:
- **Not default.** Claude would get it wrong without it: a correction, the user's decision, a local fact. Not something Claude can work out from the code, the docs or common sense.
- **A rule or fact, not a story.** Dates, origins, evidence and reasons go in the project's docs or git log. A short maintainer note can sit in a block-level `<!-- -->` comment, which is stripped before loading.
- **Not already there.** Search the target file and everything it imports. Reword the existing line instead of adding a near-duplicate; if the new line replaces one, delete the old.

## 2. Where does it go? (first match wins)

| Content | Home |
|---|---|
| Must happen every time, no exceptions | A hook or permission rule, not prose |
| A procedure, or only relevant to some tasks | A skill (loads on demand) |
| About the user, or true in every project | The profile: `CLAUDE.md` in the Claude config folder |
| One project | That project's `CLAUDE.md`; rules for some files only: `.claude/rules/*.md` with `paths:` |
| A project fact Claude learned in passing | That project's memory folder |

Instruction files form a tree. A root file holds rules plus pointers; detail lives in deeper files that load only when needed.
- A pointer names the file and when to read it: "Background, only when relevant: `background.md`".
- Don't `@import` detail: imports load at startup and save nothing.
- Don't create a file for one or two lines.

## 3. How to write it

- One line, imperative, "when X, do Y", about 30 words at most. Needing more means it is a skill.
- Specific and checkable, and name the replacement ("use named exports, not default exports").
- Plain wording. No capitals for emphasis and no stacked "always" or "never": piling on emphasis makes Claude over-apply the rule.
- No examples, file paths or numbers unless the rule is ambiguous without them.
- No descriptions of the project's layout: Claude reads the folder itself.

## 4. Check the budget, then report

Count the lines of every file you changed and compare:

| File | Budget |
|---|---|
| The profile (`CLAUDE.md` in the config folder) | 60 lines |
| A project `CLAUDE.md` | 150 lines |
| Everything loaded together in a session | under 200 lines (Anthropic's target per file is the same) |
| One memory note | 15 lines |

Over budget: cut or move something before adding. Then tell the user the before and after in plain words, the file and line, and the net line change (aim for zero or negative).

## 5. Leave it cleaner

While a file is open, fix what you see in the same pass: stale facts, duplicates, history, lines that contradict another file. Report each fix. A wrong fact found anywhere means searching every instruction file for it and fixing all copies together.
