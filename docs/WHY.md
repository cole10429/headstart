# Why the kit is built this way

Each choice below came from something that went wrong in real use, or from Anthropic's own guidance. Numbers are from the author's own session logs over about a year of daily use. They are one person's experience, not a study.

## The rules that earn their place

| Choice | What prompted it |
|---|---|
| Rules that must always hold live in hooks and permission rules, not in the profile | Three separate written rules (keep notes short, update the docs, watch conversation size) were ignored within days. Each started working the day it became a hook. Anthropic says the same: the profile is for guidelines, hooks are for zero-exception rules |
| "Done" means seen working | In an audit of 1,260 turns, "done" was claimed 19 times when it was not |
| Ask before changing an existing test | A test defines "done". Weakening it hides the failure. The first version of the guard asked too often (175 times in a month, mostly for tests the same branch had just written), so it now stays quiet for those |
| Vet packages: 7-day release age, no install scripts, malware database | A run of supply-chain worms in npm. Bad releases are usually caught within days, so waiting a week avoids most of them |
| Block reads of key, token and credentials files | An incident where a malicious package read the login files of developer tools |
| Ask before push, merge and deploy | "Don't push yet" had to be typed into prompts over and over |
| Ask before recursive deletes | A delete built from an empty variable removes far more than intended, and no hook can see deletes inside a script |
| Session history kept for 10 years | The default 30-day cleanup deleted 59 past sessions that were still wanted |
| The profile stays short, with a gate on editing it | Instruction files grow into journals. A cleanup lasted a day before long lines crept back. Anthropic's target is under 200 lines per file |
| Offer a handoff past about 250k tokens | In one week 25 sessions passed that size, and a written reminder had not stopped it. This is about cost and speed: every turn re-reads the conversation. It is not about running out of room |
| Open items live in the project's notes | Twice, a handoff left the open items only in a side note, and the next session never saw them |
| Helpers get inputs, never the expected answer | A reviewer handed the conclusion tends to agree with it |
| Answer, then proof, then decisions | Long replies buried the one thing that needed a decision |
| Each decision stands alone, with a pick | Short-hand questions were unanswerable without scrolling back |
| One plain line before an approval card | Approval cards cut long commands off, so the card alone could not be judged |
| Helpers run on Sonnet, reading and searching on Haiku, and `opusplan` is suggested on smaller plans | A standard Team seat has 1.25 times the Pro allowance, and Claude Code starts every plan on Opus. Anthropic's cost guide says Sonnet handles most coding work for less |
| A reviewer that never sees the builder's report | In a test of twelve rebuilds, one independent review caught about 60% of the defects. A reviewer told the work is finished tends to agree |
| New projects start with a notes file, a `.gitignore` and one small slice | A plan written down before the first commit is the cheapest place to change direction, and real data committed once stays in the history |
| Scratch files are cleaned up by the session that made them | 84 leftover temp items from 30 helper runs in one cleanup |

## Where this kit follows Anthropic

- The tour runs in roughly the order of the Claude Code 101 course: asking well, planning, permissions, checking work, context, memory, helpers, skills, connectors.
- Never use "bypass permissions" on a normal computer. Anthropic documents it for sealed-off containers only.
- After two corrections that did not work, clear and write a better request.
- Give Claude a way to check its own work.
- Read a plugin before installing it. That includes this one.

## Where it differs, and why

- Anthropic's beginner course starts with no profile file and adds lines as you go. This kit starts you with about 50 lines, because they are the lines that took a year to arrive at. Delete any that do not suit you.
- Anthropic's current guidance is that you no longer need to manage conversation size aggressively. The kit agrees and only speaks up at 250k tokens, as a cost tip.
- The kit does not change your permission mode. The tour explains the modes and leaves the choice to you.

## Tried and dropped

So you can skip the same experiments:

- Large "framework" plugins that add dozens of skills and rewrite how Claude works. Measured over a few weeks they added prompts and redirects without a result that could be pointed to.
- A memory server running beside Claude. The built-in memory plus a short profile did the job with less to maintain.
- Connectors left switched on "in case". The ones never called were removed; each one costs room in every conversation.
- Raising the default thinking effort for everything. Medium by default, raised by hand for hard problems, gave the same results for less.
- A hook that blocks all deletes. It cannot see deletes inside scripts, so it gave false comfort. Ask-first rules plus a checklist replaced it.
- Blanket "allow" rules for whole tools. A blanket allow skips the safety check for everything that tool can do. Narrow rules for the exact commands replaced them.
- Collecting tips. The setup is reviewed only when the same failure shows up twice in real work, or a release changes a default.
