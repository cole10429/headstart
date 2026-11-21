# Headstart

A starter kit for [Claude Code](https://code.claude.com/docs). It installs the habits one person arrived at after a year of daily use, so you can skip the year: safety rules that stop the expensive mistakes, a handful of skills, three "second opinion" helpers, and a tour that teaches one small thing at a time while you work.

You do not need to be a programmer to use it.

## Install

You need a Claude account. On Windows, the installer offers to install Claude Code's `claude` command if it is missing, which it is if you only have the desktop app; sign in to it once afterwards. On macOS or Linux, install Claude Code first ([how](https://code.claude.com/docs/en/quickstart)). The kit works the same in the desktop app's Code tab and in the terminal, since both read the same settings.

**Windows.** Open PowerShell and paste:

```powershell
irm https://raw.githubusercontent.com/cole10429/headstart/main/install.ps1 | iex
```

**macOS or Linux.** Open Terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/cole10429/headstart/main/install.sh | bash
```

The installer shows a plan and asks before it changes anything. Then open Claude Code and type:

```
/headstart:setup
```

Claude asks seven short questions and writes your profile. That is the whole setup.

Piping a script from the internet into your shell means trusting it. Both scripts are short; read [install.ps1](install.ps1) or [install.sh](install.sh) first if you like. To see the plan without changing anything, clone the repo and run `node install/install.mjs --dry-run`.

### Plugin only

If you want the skills, hooks and tour but no changes to your settings, run this inside Claude Code:

```
/plugin marketplace add cole10429/headstart
/plugin install headstart@headstart
```

## What the installer changes

Everything is inside your user folder, and everything is recorded so it can be taken back.

| What | Where | Detail |
|---|---|---|
| Installs the `headstart` plugin | Claude Code's plugin folder | Through Claude Code's own plugin command |
| Adds safety rules | `settings.json` in your Claude config folder | 31 block rules and 40 ask-first rules. A dated backup is made first. Nothing you already have is removed or changed |
| Keeps session history for 10 years | same file | Only if you have not set it yourself. The default deletes old sessions after 30 days |
| Creates your profile | `CLAUDE.md` in your Claude config folder | Only if you do not have one. An existing file is never overwritten |
| Adds two npm safety lines | `.npmrc` in your user folder | Only if npm is installed and supports them: skip install scripts, refuse releases under 7 days old |

It does not change your permission mode, your model, telemetry or anything else.

## What you get

### Safety that does not rely on Claude remembering

Written rules are guidance and sometimes get missed. These are enforced by the program itself.

| Guard | What it does |
|---|---|
| Secret files | Claude cannot open `.env` files, keys, tokens, files named "credentials", or the login files of GitHub and cloud tools |
| Destructive git | Force push, hard reset and "clean" commands are blocked |
| Ask first | Deleting folders, pushing to GitHub, merging a pull request and publishing a site always ask you |
| Package check | Before anything is installed from npm or PyPI, it is checked for known malware, how new it is, how many people use it (npm only) and whether it runs scripts. Red flags block the install. A bare `npm install` that only restores a project's existing packages is not checked |
| Test guard | If Claude wants to change an existing test, it has to ask. Changing the test is the easy way to make a failure disappear |
| Commit checks | Claude cannot skip a project's own pre-commit checks |
| Instruction files | The first time in a session Claude edits your rules files, it is stopped once and told to load the skill that keeps them short |
| Long conversations | Past about 250k tokens Claude offers to hand off to a fresh session, since every turn re-reads the whole conversation |

The git, delete and publish rules and the commit and package checks cover both of Claude's command tools, Bash and PowerShell (on by default on Windows). They match the usual ways of writing each command; a command hidden inside a script file is not seen, which is why the profile also asks for a list of targets before anything is removed.

### Skills

Type `/` in Claude Code to see them.

| Skill | Use it when |
|---|---|
| `/headstart:setup` | First run, or to redo your profile |
| `/headstart:tour` | You want to see or steer the lessons |
| `/headstart:new-project` | Starting or rebuilding a real project. Sets up git, a `.gitignore` that keeps private data out, the project's notes (goal, limits, rules) and an agreed first small slice. Can link an older repo to learn from |
| `/headstart:grill-me` | Before building something. Claude interviews you until you both mean the same thing, with a suggested answer for every question |
| `/headstart:handoff` | Ending a session. Open items go into the project's own notes so the next session can pick up |
| `/headstart:humanizer` | Text another person will read. Removes the habits that make writing sound like AI |
| `/headstart:package-vet` | Claude uses this itself before suggesting a package |
| `/headstart:instruction-edit` | Claude uses this itself when editing rules files |
| `/headstart:windows-shell` | Claude uses this itself on Windows, where the command line has traps |

### Helpers

| Helper | What it does |
|---|---|
| `fact-check` | Tries to disprove each claim against its source. It is given the claims but not Claude's conclusion, so it cannot just agree |
| `second-check` | Recalculates a number from the inputs without seeing the first answer |
| `reviewer` | Reviews a finished change against what it was meant to do, runs the tests and tries to break it, without seeing the builder's own report |

Say "fact-check that", "second-check that number" or "review this". All three run on Sonnet, which costs less than the main session.

### Your profile

A short file (about 50 lines) of standing instructions: answer first, then proof, then decisions; check facts and say how; ask before anything risky; "done" means you saw it work. `/headstart:setup` adds a few lines about you. It is yours to edit. [See the template](templates/profile.md).

## Making your plan last

Your plan's allowance refills every five hours, with a weekly cap on top, and the Claude app and Claude Code share it. On Pro or a standard Team seat it runs out quickly on the default model. The kit helps in four ways:

- `/headstart:setup` asks which plan you are on and, on a smaller plan, suggests typing `/model opusplan`: Opus does the planning, the cheaper Sonnet does the building. The kit never changes your model itself.
- The helpers run on Sonnet, and the profile tells Claude to send reading and searching to the smallest model.
- The kit itself adds about 1,300 tokens to each session (measured with `claude plugin details`). The hooks cost nothing, and the large skills load only when used.
- The tour's limits lesson shows `/usage`, which lists what used the most and can fix some of it.

## The tour

Claude Code has a lot of features, and reading about all of them on day one does not stick. The tour waits for the moment a feature matters, then adds a note of four lines or fewer after the work is done.

- At most one lesson per session and two per day.
- Each lesson appears once.
- 19 lessons, in roughly the order Anthropic's own beginner course teaches them.

| Lesson | Appears when |
|---|---|
| How to ask | Your first session (or the next one, if the first offered setup) |
| Passwords and keys | You mention a password, key or card number |
| When it keeps getting it wrong | Your second correction in one session |
| Say what done looks like | A very short "build me X" request |
| Plan before big changes | You describe a large job |
| Making it remember | You say "remember" or "from now on" |
| What the approval cards mean | Claude first runs a command |
| Undo and seeing changes | Claude first edits a file |
| Save points with git | Claude first commits |
| Installing other people's code | Claude first installs a package |
| Done means you saw it work | You ask "is it done?" |
| Checking facts | Claude first searches the web |
| Helper agents | Claude first uses a helper |
| Skills | Claude first loads a skill |
| Text other people will read | You ask for an email, letter or post |
| Connecting your apps | You mention your email, calendar or files |
| Your usage limits | An early session, at your first message |
| Fresh sessions | Your fourth session |
| See how you really work | Your tenth session |

Type these as a message at any time:

| Message | Effect |
|---|---|
| `tour status` | What you have seen and what is left |
| `tour next` | Give me the next lesson now |
| `tour more` | More on the last lesson |
| `tour off` / `tour on` | Stop or restart |
| `tour reset` | Start again |

Lessons are plain text in [tour/lessons.json](tour/lessons.json). Change them, reorder them or add your own.

## Turning things off

Each guard has a switch, set as an environment variable:

| Variable | Turns off |
|---|---|
| `HEADSTART_TOUR=off` | The tour |
| `TEST_GUARD=off` | The test guard |
| `INSTRUCTION_GATE=off` | The instruction-file gate |
| `CONTEXT_WATCH=off` | The long-conversation notice |

To remove a settings rule, delete its line from `settings.json`.

## Update and uninstall

Update, from a terminal:

```
claude plugin marketplace update headstart
claude plugin update headstart@headstart
```

Uninstall: clone this repo and run

```
node install/install.mjs --uninstall
```

It removes the rules and npm lines the installer added and uninstalls the plugin. Your profile, your tour progress and the dated backups stay where they are.

## Requirements and what has been tested

- A current Claude Code, Node.js 18 or newer (the guards are small Node scripts), Git. The GitHub CLI (`gh`) is optional and lets Claude work with GitHub. On Windows the installer offers to install any of the last three that are missing.
- Tested on Windows 11 with Claude Code 2.1.327 and Node 24. `npm test` runs 21 automated checks that need no network and no packages. `npm run test:install` does a real install and uninstall in a throwaway folder, leaving your own setup alone.
- The macOS and Linux installer is written but has not been run on a real Mac. If you try it, please open an issue with what happened.

## Why these choices

[docs/WHY.md](docs/WHY.md) gives the reason behind each rule, including what was tried and dropped. [docs/PARKED.md](docs/PARKED.md) lists what was left out of this version on purpose.

## Credits

The humanizer skill is by Siqi Chen, grill-me is by Matt Pocock, and the commit-check guard comes from Affaan Mustafa's everything-claude-code. All MIT. Details in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

This kit is not made or endorsed by Anthropic. It is one person's setup, shared in case it helps.

## License

[MIT](LICENSE)
