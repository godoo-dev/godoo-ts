---

name: godoo-ts-capture
description: Capture, triage and retrieve godoo-ts work in its GitHub issues (requests, breakdowns, deferred observations, owner decisions), and route knowledge to its owner, including Odoo-server behaviour to Atlas intake. Writing godoo-ts docs uses godoo-ts-docs.
---

# Capture godoo-ts work

Work records live in public GitHub issues: **godoo-dev/godoo-ts**
(https://github.com/godoo-dev/godoo-ts/issues). Always pass
`-R godoo-dev/godoo-ts` to `gh`. Anyone can read them, so leave out private
paths, company or supplier names, credentials and private repository names.
Machine-specific bindings live in the ignored `.mafe-si.toml`. If GitHub is
unavailable, report it; do not pick another tracker.

## Route first

Classify what you have, then send it to its owner:

| Kind                                                         | Home                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Request, open decision, blocker, remaining work for godoo-ts | An issue here (below)                                              |
| How godoo-ts code behaves: config, errors, helpers, CLI      | This repository through [godoo-ts-docs](../godoo-ts-docs/SKILL.md) |
| What the Odoo server does, by version, edition or module     | Atlas intake (below)                                               |
| How an agent should use an MCP tool                          | [godoo-mcp-server](https://github.com/godoo-dev/godoo-mcp-server)  |
| Stateman planning, apply, adoption and target semantics      | [godoo-stateman](https://github.com/godoo-dev/godoo-stateman) docs |
| Python library behaviour                                     | [godoo-py](https://github.com/godoo-dev/godoo-py)                  |
| Synthesis or decisions spanning several components           | Godoo HQ, as links to the owners                                   |
| Maintainer procedure for this project                        | `.agents/skills/` here                                             |

Atlas holds only claims about Odoo itself. Behaviour of the godoo-ts client,
retired CLIs or MCP conventions is not an Atlas fact, even when it was learned
while checking Odoo.

Another project's records are written from that project's own session. For
anything not owned here, tell Marc in the current conversation what you found,
which owner it belongs to and why; use coordinate-projects for the handoff. Do
not write into another project's tracker or files from this session.

**Atlas intake.** When component work reveals Odoo-server behaviour, report the
behaviour, Odoo version and edition, modules involved and how it was observed
to Marc as an Atlas intake candidate. Keep any reflection here in this project's
words. Once Atlas assigns a fact ID, add the `atlas:<fact-id>` marker as
[godoo-ts-docs](../godoo-ts-docs/SKILL.md) describes. Fact IDs are public;
fact text and Atlas paths are not.

## Decide whether to write

Write an issue for an explicit request, an actionable follow-up, a blocker or an
owner decision. A handback, merge or passing check alone warrants no write. A
tiny settled change can live in its PR alone. Routine progress stays in the
session. Recording work does not schedule or authorize it.

## Find existing coverage

For a reference:

```sh
gh issue view NUMBER -R godoo-dev/godoo-ts --json number,title,state,stateReason,body,comments,labels,url
gh pr view NUMBER -R godoo-dev/godoo-ts --json number,title,state,body,url,mergeCommit
```

Without one, search open and closed records:

```sh
gh issue list -R godoo-dev/godoo-ts --state all --search 'TERMS' --limit 100 --json number,title,state,url
gh pr list -R godoo-dev/godoo-ts --state all --search 'TERMS' --limit 100 --json number,title,state,url
```

Read likely matches. Reuse an issue whose outcome matches; link related but
distinct ones. A merged PR shows merged source, not publication or runtime
acceptance.

## Create or update

Compose the body with reporting-for-humans: the problem or outcome, useful
evidence, uncertainty, remaining acceptance and the next actor. Keep the owner's
requirements separate from suggestions. Write the disposition (untriaged,
needs-info, deferred, accepted) in prose; an open issue alone decides none of
them. Keep existing labels; invent no labels, assignees, priorities or dates.

Run pre-post before each issue or PR create, edit or comment, and post through
its reviewed-posting helper with `repo` `github.com/godoo-dev/godoo-ts`.
Write once. Read the record again only if the tool reported an error, since the
write may have landed.

For larger work, keep one parent issue and add checklist items or linked issues
only for independently useful pieces. Separate real dependencies from ordering,
and proposals from agreed work.

A deferred observation during other work gets a short issue (context,
uncertainty, open decision), then return to the task.

## Handback and closure

When the outcome changes, an attempt fails, a blocker appears or the owner
decides, rewrite the issue body to the current state: outcome, live decisions,
remaining acceptance, next actor. Replace stale claims instead of appending a
journal. Comment only when discussion warrants attention.

Close only with triage or delivery authority:
`gh issue close NUMBER -R godoo-dev/godoo-ts --reason completed`, or
`--reason 'not planned'` for an authorized non-delivery. For duplicates, say
which issue supersedes it.

Report the issue URLs, what was created, updated or already covered, and any
gap or next actor.
