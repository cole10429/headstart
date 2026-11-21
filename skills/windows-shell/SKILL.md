---
name: windows-shell
description: Use on Windows before (1) a PowerShell command that changes something or runs more than one line; (2) Windows command-line tools that take /switch arguments (wevtutil, netsh, findstr, tasklist); (3) commands that change system state (services, processes, registry, settings files); (4) handing a file from Git Bash to a Windows program (python, node, a browser); (5) any command in any shell that deletes or overwrites data; or (6) retrying a shell command that just failed. Not needed for read-only commands (ls, cat, grep, git status, a one-line Get-* query).
---

# Windows shell

On Windows, Claude Code usually runs commands in Git Bash, a Unix-style shell sitting on top of Windows. Most failures come from the seam between the two. The user's PC is a real working computer, not a sandbox: every failed guess costs time, and a changing command that half-works can do damage.

## Before any shell command

1. **Does it contain `$_`, `$env:`, `@{...}` or backticks inside a Bash-quoted string?** Git Bash will mangle it. Write a `.ps1` file and run it with `-File`.
2. **Does it change state** (files, services, processes, settings, registry)? Run a read-only probe first (`Test-Path`, `Get-*`, `ls`, `--dry-run`, `-WhatIf`). Say what you intend. Confirm with the user unless it is trivially reversible.
3. **Does the path have spaces or backslashes?** Quote it. Forward slashes in Git Bash (`/c/Users/name/...`), backslashes in PowerShell.
4. **About to retry a command that just failed?** Stop and read the error. Check the table below. Fix the cause, not the symptom.
5. **Could the file hold secrets?** Don't open `.env`, key, token or credentials files, and never print a secret value.

## Known gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Missing ')' in method call` or `Unexpected token` from inline PowerShell run through Bash | Git Bash consumes `$_` before PowerShell sees it | Write the PowerShell to a `.ps1` file and run `pwsh -NoProfile -File <path>` |
| `which powershell` finds version 5.1 when you wanted 7 | Both can be installed; `powershell` is the old one | Use `pwsh`. Check with `pwsh -v` before relying on version 7 features |
| `ConvertFrom-Json` fails on duplicated keys | PowerShell 5.1 treats keys that differ only by letter case as the same | `pwsh` 7 with `ConvertFrom-Json -AsHashtable` |
| A cmdlet says it requires elevation | It needs an administrator window | Skip it and say so. Never trigger an administrator prompt the user did not ask for |
| A Windows tool given `/q:...` or `/f:...` switches fails with exit 87 or "too many arguments" | Git Bash rewrites any argument starting with `/` as a file path | Prefix the command with `MSYS_NO_PATHCONV=1`. With it set, write `cmd /c`, never `cmd //c` (that opens a prompt that hangs) |
| A Windows program cannot find a file Bash just wrote to `/tmp/...` | `/tmp` in Git Bash is a virtual folder Windows programs cannot see | Write to a real Windows path (the project folder or `$TEMP`) |
| `Could not open file /proc/.../fd/...` from a Windows program | Bash process substitution `<(cmd)` passes a path only Bash tools understand | Pipe the data in, or write a temp file and pass its path |
| JSON with Windows paths fails with `Bad escaped character` | `printf` and heredocs in Git Bash turn `\\` into `\` | Write the JSON with the file-writing tool, then pass the file |
| `unexpected EOF` from a heredoc that writes a script | Backticks or `${...}` inside an unquoted heredoc are run by Bash before the file is written | Write the script with the file-writing tool, then run it |
| Python stops with `UnicodeEncodeError: 'charmap' codec` | Windows Python prints in an old code page with no emoji | Start the script with `import sys; sys.stdout.reconfigure(encoding="utf-8", errors="replace")`, or set `PYTHONIOENCODING=utf-8` |
| `python3 ...` hangs until the timeout | On Windows `python3` is often a Store shortcut that waits for input | Use `py` or the project's `.venv\Scripts\python.exe` |
| `grep: -P supports only unibyte and UTF-8 locales` | Git Bash's default locale is not UTF-8 | `LC_ALL=C.UTF-8 grep -P ...`. Never chain `\|\| echo none` on a grep: it cannot tell "no match" from "error" |
| Dollar amounts corrupted: "$250,000" written as "50,000" | Bash reads `$2` as an empty variable inside double quotes and unquoted heredocs | Write any text containing money with the file-writing tool or a quoted heredoc (`<<'EOF'`). Afterwards scan for amounts with a leading comma |
| An interactive program (`python -i`, a database shell) ignores further input | The command tool cannot keep typing into a running program | Restructure as a script that runs start to finish |
| An inline PowerShell command with `-ExecutionPolicy Bypass` is refused by the permission checker | Policy-bypass flags look like weakening security | For read-only questions use tools that need no bypass (`tasklist`, `netstat`, `netsh`, `wevtutil`). If PowerShell is truly needed, stop and give the user the command to run |
| Setting an environment variable to `$null` leaves it present but empty | PowerShell turns `$null` into an empty string for that call | Delete the registry value under `HKCU\Environment` directly, then verify with `reg query` |
| A block of administrator commands half-applied | The window was not elevated, and pasted lines run one by one, so a failure does not stop the rest | Wrap the block in `& { ... }` that first checks for administrator rights and returns with "NOT ADMIN", and end with one verify line per step |
| A headless browser "print to PDF" exits 0 but writes no file | Seen with Edge headless, and with Chrome when scripts are disabled by flag | Use Chrome with `--headless=new --no-pdf-header-footer --user-data-dir=<temp> --print-to-pdf=<absolute path>`. Always check the file exists and starts with `%PDF-` |

## Working on a live PC

- Probe, read, then change: check the thing exists, read its current state, write out the changing command and how to reverse it, confirm when the damage could be more than trivial, run it, then verify with another read.
- When investigating something system-wide, write one script that gathers everything in one run, not six separate commands.
- Ask before stopping services, ending processes, shutting down WSL or Docker, or deleting anything this session did not create.
- If a change cannot be undone in one step, talk to the user first.

## Commands that remove data (any shell)

- **Empty variables.** A typo upstream turns `rm -rf "$DIR/"` into `rm -rf "/"`. Bash: `set -u` and `"${DIR:?}"`. PowerShell: `Set-StrictMode -Version Latest` and `if (-not $Dir) { throw }` before `Remove-Item`.
- **Quote every path** and put `--` before paths in Bash (`rm -rf -- "$p"`).
- **No inline comments** on or inside the command: a `#` in the wrong place can cut it short or swallow a guard.
- **Arrays, not joined strings**, for a command with arguments (`"${args[@]}"`, PowerShell `@args`).
- **Stacked quoting.** Each layer (Bash, then PowerShell, then the program) eats quotes and `$`. Write the command to a script file, read it back, run the file.
- **Preview the exact targets** first (`ls`, `find ... -print`, or `-WhatIf`). Delete only what the preview listed.
- Reread the final command as it will run. Never improvise a delete.

## When you hit a new gotcha

Find the real cause, fix it, and offer the user a new row for this table (symptom, cause, fix). Leave out one-off bugs and anything specific to one project.
