---
name: tour
description: The Headstart learn-as-you-go tour. Use when the user types /headstart:tour, asks what the tour is, how to turn lessons on or off, what lessons are left, or wants to learn the next thing about Claude Code.
---

# Headstart tour

The tour teaches one small thing at a time, at the moment it becomes relevant: the first time Claude edits a file, installs a package, uses a helper, and so on. A hook in this plugin watches for those moments and passes you a note that begins `[Headstart tour`. The lessons are in `tour/lessons.json` in this plugin (two folders above this skill's base directory).

## What the user can type

These are plain messages, handled by the hook before you see them. It saves the change and tells you what happened; relay that in one or two lines.

| They type | What happens |
|---|---|
| `tour status` | Lists lessons seen and still to come |
| `tour next` | Gives the next lesson now |
| `tour more` | More detail on the last lesson |
| `tour off` / `tour on` | Stops or restarts the lessons |
| `tour reset` | Offers every lesson again |

If the user ran `/headstart:tour` with no note from the hook in this turn, explain the tour in three lines and show the table. Ask them to type `tour status` as its own message.

## How to give a lesson

- Finish the work they asked for first. The lesson is a short note at the end, headed "Tour:".
- Four lines at most, everyday words, tied to what just happened in this conversation. One idea per lesson.
- Never more than one lesson in a reply, and none while the user is stressed or in a hurry.
- Do not turn a lesson into a quiz or homework.
- For features Anthropic already teaches well, point there: `/powerup` for interactive lessons, `/insights` for a report on their own sessions, and the free courses at https://academy.claude.com.
