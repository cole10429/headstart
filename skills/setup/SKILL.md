---
name: setup
description: The Headstart first-run interview. Asks the user a few questions and writes the "About me" part of their Claude profile, then introduces the tour. Use when the user types /headstart:setup, asks to set up or redo their profile, or says Claude does not know them yet.
---

# Headstart setup

Goal: after about two minutes Claude knows who it is working with, and the user knows the tour exists. Keep it light. The user may never have used a coding tool.

## 1. Look before asking

Find these yourself, never ask:
- The profile file: `CLAUDE.md` in the Claude config folder (`~/.claude`, or `CLAUDE_CONFIG_DIR` when set). Read it.
- The operating system, and whether `git`, `node` and `gh` (the GitHub CLI) are installed (one read-only version check each). If `gh` is there, `gh auth status` tells you whether it is signed in.

Three cases for the profile file:
- It has `headstart:about-start`: normal. Go to step 2.
- It does not exist: copy `templates/profile.md` from this plugin (two folders above this skill's base directory) to that path, then go to step 2.
- It exists without the Headstart markers: the user had their own file. Do not replace it. Show them the Headstart sections in plain words and ask whether to add them below their own text; add only what they accept.

## 2. Interview

Ask these in one round, with the question tool if you have one, otherwise as a numbered list. Give a suggested answer for each so a short reply is enough. Skip any the file already answers.

1. What should I call you? (Optional. A first name or nickname is plenty.)
2. What will you mostly use Claude for? One line: the kind of work or projects.
3. How comfortable are you with computers and code? New to all of this, comfortable with computers but not code, or already write code.
4. How do you like answers? Short and plain, or detailed. Words, or pictures and tables where they help.
5. What tone suits you? Neutral and professional, friendly, or blunt with some humour.
6. Is there anything I must always ask about first, or never do?
7. Which Claude plan are you on? Pro, a standard Team seat, a premium Team seat, Max, or not sure. (A Team member can't see their own seat type; the person who runs the team can.)

Tell them once: keep passwords, account numbers and other people's private details out of the answers. The profile is a plain text file on this computer.

## 3. Write it

Replace everything between `<!-- headstart:about-start -->` and `<!-- headstart:about-end -->` with at most eight short lines built from the answers plus the facts from step 1 (operating system, whether git and node are present). Write rules Claude can act on, for example "New to code: explain terms, show where to click" in place of "beginner".

Then add `<!-- headstart:setup-done -->` on its own line directly under the about-end marker. The tour hook looks for it.

If the edit is refused by a permission rule, do not work around it: show the finished block and the file path so the user can paste it themselves.

## 4. Report

In this order, briefly:
1. What you now know about them: the lines you wrote, as written.
2. What the kit does without being asked, in three lines: it asks before deleting, pushing or publishing; it checks packages before installing; it stops and asks before changing an existing test.
3. Usage: on Pro, a standard Team seat or "not sure", suggest they type `/model opusplan` themselves: Opus plans, the cheaper Sonnet builds, and the allowance lasts much longer. On a premium seat or Max, mention it as an option. Never change the model for them.
4. GitHub: if `gh` is missing, offer to install it (`winget install --id GitHub.cli -e` on Windows) and run it only on their yes. If it is not signed in, the sign-in asks questions, so it cannot run in the chat: ask them to open a terminal (the Terminal pane in the desktop app, or a PowerShell or Terminal window), run `gh auth login --web`, follow the browser steps, then run `gh auth setup-git` so git and plugin updates can use that sign-in. The sign-in is theirs to do, never yours.
5. For a real project, `/headstart:new-project` sets up its notes, git and a first small slice.
6. The tour: from now on, at most one short "Tour:" note per session, when something relevant comes up. `tour off` stops it, `tour status` lists the lessons, `tour next` gives one now.

End by asking what they would like to work on.
