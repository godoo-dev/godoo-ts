---
name: godoo-ts-capture
description: Capture, triage and retrieve godoo-ts GitHub requests, work breakdowns and deferred observations; retain incoming requirements and reconcile consequential delivery outcomes without scheduling work.
---

# Capture godoo-ts work

Resolve this checkout from this skill's repository root and read AGENTS.md.
The canonical work repository is **godoo-dev/godoo-ts**:
https://github.com/godoo-dev/godoo-ts/issues. Always pass `-R godoo-dev/godoo-ts`
to `gh`; verify `gh repo view godoo-dev/godoo-ts --json nameWithOwner,url,visibility`
before writes. Public issue text, titles, links, labels and attachments must be
public-safe. Do not fall back to inherited shared intake when GitHub is unavailable.
Ignored `.mafe-si.toml` supplies local categories; machine paths and private
source mappings stay there or in owner-paths evidence, never tracked skills.

## Choose the home and recover coverage

First choose purpose and readers. Requests, open decisions, actionable blockers
and remaining acceptance belong in GitHub issues. API/engineering knowledge belongs
in README.md, package READMEs or docs/ through
[godoo-ts-docs](../godoo-ts-docs/SKILL.md). Supporting provisional designs and
private evidence use owner-paths unless the user or established discussion has
selected the issue itself. A substantive request should be retained early while
its supporting design evolves; do not dump the design packet into an issue just
for durability. A missing evidence home need not block self-contained work intake.
Routine narration remains in the session. Tiny settled changes can use their PR
without inventing an umbrella or a ticket for every step.

For an explicit reference, retrieve it first:

```sh
gh issue view NUMBER -R godoo-dev/godoo-ts --json number,title,state,stateReason,body,comments,labels,assignees,url,updatedAt
gh pr view NUMBER -R godoo-dev/godoo-ts --json number,title,state,body,url,mergeCommit,headRefOid
```

Without a reference, search the relevant terms across open AND closed records:

```sh
gh issue list -R godoo-dev/godoo-ts --state all --search 'TERMS' --limit 100 --json number,title,state,body,url
gh pr list -R godoo-dev/godoo-ts --state all --search 'TERMS' --limit 100 --json number,title,state,body,url
```

Read likely matches and linked evidence. Paginate (`gh api --paginate
repos/godoo-dev/godoo-ts/issues?state=all&per_page=100`) if limits could hide a
match. That API includes PRs. A merged PR alone does not prove current source,
publication or runtime acceptance; inspect the relevant branch/source when needed.
Reuse existing canonical coverage when the outcome and acceptance match; link
related but distinct obligations. Container lifetime and dependency-advisory triage
are distinct outcomes. Keep completed delivery closed unless new authority and
facts justify reopening. No local archive or source key belongs in public text.

## Source identity and uncertain receipts

For imported requests retain a stable opaque marker in the body:
`<!-- godoo-ts-source: sha256:HEX -->`. Compute HEX as SHA256 of the UTF-8 bytes
of the original provenance, a single newline, then the full original source_ref
(no trailing newline). If those do not exist, use the supplied stable source
namespace and identifier; preserve the exact preimage privately before writing.
The complete deduplication namespace is `(godoo-dev/godoo-ts, godoo-ts-source,
sha256 digest)`, across all issue states. Keep original-to-opaque identity mappings
only in private retained evidence. Distinct corrections use a new source identity
and link the original issue; retries reuse the original identity.

GitHub offers no atomic idempotency key for issue creation. Before creating or
retrying after a lost response, list all pages of issues (open and closed), compare
the exact marker in bodies, and read matching records. Search indexing alone is
insufficient. Multiple matches or concurrent intake with the same identity require
reconciliation; do not blindly create again. Preserve the receipt and readback.
Do not publish private company/supplier identities, local paths, thread IDs, raw
source keys or private attachments. Essential evidence must remain understandable
without access to the private original: summarize the observation, date, limits
and remaining check, and state when detailed evidence is private/unavailable.

## Retain and triage

Use reporting-for-humans when available with the selected purpose, audience,
destination, essential claims and qualifications. Otherwise write a self-contained
problem/outcome, useful evidence, uncertainty, remaining acceptance and next actor.
Preserve original attributed owner requirements and authority separately from
optional suggestions. Use ordinary prose for untriaged, needs-info, deferred or
accepted disposition; GitHub OPEN alone means none of those decisions. Preserve
existing labels when editing; do not invent labels, assignees, deadlines or priority.
Capture neither commits nor schedules implementation and transfers no holding.

Write the exact public-safe body to an external UTF-8 file, then use:

```sh
gh issue create -R godoo-dev/godoo-ts --title 'Concrete outcome' --body-file /absolute/body.md
gh issue edit NUMBER -R godoo-dev/godoo-ts --body-file /absolute/body.md
```

Re-read the canonical record, including metadata/comments. An access blocker must
retain its impact, qualified missing evidence and next actor/check; it does not
prove absent behavior. Publish only the selected public-safe material. If explicit
intent or established convention selects a detailed issue discussion, keep useful
tradeoffs/sources there without forcing a duplicate document. Preserve dated
proposals as proposals; reconcile a linked current decision summary when the
actual scope changes, such as evaluation versus production.

For larger requests, reuse the original issue and retain manageable pieces as
checklists or linked issues only when independently useful. Distinguish actual
dependencies from ordering and proposed from agreed work. Link canonical sibling
records rather than copying them. Piece completion does not establish integrated
acceptance. Retrieve the parent plus relevant remaining pieces and decisions on
resumption. Keep supplier delivery and consuming acceptance distinct.

For a deferred observation during another task: check coverage, briefly retain its
source/context, uncertainty and open decision, read back, then resume the task.
Read-only requests and warnings without a substantive observation create no issue.
Known technical uncertainty remains with TS; retain a qualified external dependency
and next actor when needed, then report it to Marc here. Do not contact agents,
launch work, relay messages or use comments as coordination traffic.

## Consequential handback and closure

At a changed outcome, failed attempt, new blocker or owner decision, retrieve the
active issue and known affected active summaries, including linked current design
discussions. Compose the body afresh: current outcome, still-relevant decision,
remaining acceptance and next actor/action. Replace stale current claims and
resolved detours; do not append an activity journal. Reconcile contradictory active
summaries against the authoritative current account within authorized scope.
Preserve dated closed deliveries and historical proposals. Routine progress with
unchanged meaning produces no write. A failure is not completion.

Comments are available with `gh issue comment NUMBER -R godoo-dev/godoo-ts
--body-file /absolute/comment.md`, only when actual discussion warrants attention
and the user has authorized the communication. No automatic notifications,
acknowledgment requests or migration chatter. Source corrections stay in the same
open PR; post-merge operational fixes follow existing source-before-operation
rules and separate operational authority, retaining linked unfinished acceptance.

Close only under actual triage/delivery authority, preserving the reason:
`gh issue close NUMBER -R godoo-dev/godoo-ts --reason completed` for established
completion, or `--reason 'not planned'` for an authorized non-delivery disposition.
Explain duplicate/superseded tracking in the body; do not claim the problem fixed.
Read back state/stateReason after any transition. No automatic reopening follows.

Return through the current invocation only: project, canonical URLs/identifiers,
created/updated/already-covered disposition, actual state, source marker, unresolved
gaps and next actor. No scheduler, mafe-pending dispatcher or outbound handoff is
implemented by this skill. If GitHub access fails, retain authorized private working
material and report the missing access; never silently select another tracker.
