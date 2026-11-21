# Where this skill came from

- Source: https://github.com/mattpocock/skills (MIT license), commit `49dd158d1076134a641b33efb035946536778336` (2026-10-09).
- Upstream `grill-me` is a one-line pointer ("Call the Skill tool with grilling"). This folder joins the two: the `grill-me` name with the `grilling` body, unchanged.
- Local change to the frontmatter only (2026-10-15, and the skill name updated for this plugin): Upstream has `disable-model-invocation: true` (only `/grill-me` runs it). Here that line is removed and the description says when Claude starts it or suggests it, so Claude can raise it at the start of an unclear task.
- Vetted 2026-10-15: plain Markdown only. No scripts, packages, network calls or hooks. The upstream `agents/openai.yaml` files are Codex display metadata and were not copied.
- sha256 of the upstream files at that commit:
  - `skills/productivity/grill-me/SKILL.md`: `caaf8b8de1684f96e26b28f3c29189db5c89cce4b73e1c93d86164f66ef88637`
  - `skills/productivity/grilling/SKILL.md`: `befdff1e27a1dfe2a294d5871169ac1afe16d983911daa4f32627514a48c1e15`
- To update: diff upstream `skills/productivity/grilling/SKILL.md` at a newer commit against the body of `SKILL.md` here.
