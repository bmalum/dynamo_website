# Agent skills

`dynamo-elixir/` is a skill (SKILL.md with references) for coding agents that
work on projects using this library. Install by copying the folder into your
agent's skills directory, e.g. `.kiro/skills/dynamo-elixir/` or
`.claude/skills/dynamo-elixir/`, or fetch it from
https://elixir-dynamodb.dev/skills/dynamo-elixir/SKILL.md.

`references/cheatsheet.md` is a copy of `Agents.md`; regenerate with
`cp Agents.md skills/dynamo-elixir/references/cheatsheet.md` when it changes.

`dynamo-maintainer/` is for agents (and people) changing this library:
invariants, test tiers incl. the live AWS suite, how to add a feature end to
end, the release/Hex checklist, and the traps found during the 0.2 rewrite.
It is published alongside the user skill but is not meant for application code.
