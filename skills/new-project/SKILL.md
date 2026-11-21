---
name: new-project
description: Start a real project well, or bring an existing folder up to the same footing. Sets up git, a .gitignore, and the project's own notes file (goal, limits, rules, open items), wires in any reference repo, and agrees the first small slice. Use when the user types /headstart:new-project, or says they are starting, rebuilding or redesigning a project or app.
---

# New project

Goal: in about ten minutes the project has a home Claude reads every session, real data cannot end up in git, and the user has agreed one small first slice. No code is written in this skill.

## 1. Look before asking

Find these yourself, never ask:
- The project folder (the current one, unless the user named another). Whether it is a git repo, and its branch.
- An existing `CLAUDE.md` or `AGENTS.md` in it, and a `.gitignore`.
- Signs of the stack: `package.json`, `requirements.txt` or `pyproject.toml`, and so on.

An existing notes file is never replaced. Read it, then offer to add only the sections of `templates/project-CLAUDE.md` it lacks.

## 2. One round of questions

Ask in one round, numbered, each with a suggested answer so "yes" is enough. Skip any the folder already answers. For a big or vague idea, offer `/headstart:grill-me` first.

1. What is it, and who will use it? One or two lines.
2. What must the first usable version do? This becomes "Done when". Push it toward something small enough to try within a few sessions.
3. What is it not going to do, at least for now?
4. Budget: how many sessions or hours before you want to stop and look?
5. What needs your OK before it changes (prices, tax, legal wording), and what must customers never see?
6. Is there an older version or another repo to learn from? Where is it?

## 3. Set it up

Templates live in this plugin's `templates/` folder (two folders above this skill's base directory).

1. Not a git repo yet: `git init`, with `main` as the branch.
2. `.gitignore`: copy `templates/project-gitignore.txt`. If one exists, add only the lines it is missing. Do this before the first commit. In an existing repo, run `git ls-files` and tell the user about any private or data file already tracked: ignoring it now does not take it out of git.
3. Notes file: with none found in step 1, copy `templates/project-CLAUDE.md` to `CLAUDE.md` and fill it from the answers. With one found, add only the sections the user accepted to that same file. Leave a placeholder where there was no answer; never invent one. Keep it under about 150 lines.
4. Reference repo, if any: clone or copy it into a sibling folder named `<project>-reference`, never inside the project, so it can never be committed. Fill in the "Reference material" section. To let Claude read it in a session, the user types `/add-dir <path>`.
5. Commit only the notes file and `.gitignore`, with the message "Project notes and .gitignore". Never push. Pushing, and creating the GitHub repo, wait for the user's word.
6. Create a branch for the first slice, named after it.
7. Once the stack is known, check its tools are installed (one version check each, such as `node`, `python` or `gh`). For a missing one, say what it is for and offer the install command; run it only on the user's yes.

## 4. The first slice

Propose the smallest version of "Done when" that the user can try with their own hands, in three to five lines: what they will see, what is left out, how you will check it works. Suggest Plan mode for building it. Stop there and let the user decide when to start.

## 5. Report

A short table of what was created or changed, then the first slice as proposed, then any question still open.
