---
name: godoo-ts-docs
description: Retrieve, author, consolidate and assess godoo-ts canonical API and target documentation; prepare proposed contract guidance before implementation and reconcile it after verification.
---

# Maintain godoo-ts documentation

Resolve this checkout from the skill's repository root and read AGENTS.md.
README.md provides navigation; packages/*/README.md own public package usage;
docs/development.md owns engineering and verification; docs/libraries.md owns
capability targets and explicit language differences. Public family orientation is
https://github.com/godoo-dev/.github/blob/main/profile/README.md; normal local work
requires no fetch. No HQ checkout or shared issue store is required.

## Retrieve or assess

Read an explicit reference first. Otherwise use `rg -n 'QUERY' README.md docs
packages --glob '*.md'`, read matches in context and inspect relevant source/tests
before claiming an API exists. Cite the actual file/section or public commit URL,
retaining dates, versions and evidence qualifications. Queries and report-only
freshness assessments make no content, configuration or observation-record edits.
Follow only the relationships useful to the question; report missing coverage.
Use explain-system when available for bounded mechanics or historical rationale;
current source alone does not establish why a decision was made.

## Author, move or reconcile

Search existing coverage and update its canonical home. Use technical-writing when
available for composition; otherwise write for the reader's task with exact APIs,
prerequisites and useful examples. Keep implemented behavior, proposed targets,
reported historical evidence, publication and runtime/consumer acceptance distinct.
Conflicting claims remain qualified until relevant evidence resolves them.

Before implementing a changed user/operator contract, prepare the smallest useful
proposed guide/example here. Label unavailable behavior proposed. After verification,
compare affected examples, setup and claims with actual results; remove proposed
labels only where justified and retain unmet targets. No-impact changes need no
docs edit. Delivery owns implementation and integration authority.

For moves/consolidation, inspect incoming filenames/headings/anchors using `rg`,
preserve meaningful differences and source qualifications, and repair in-scope
navigation. Combine equivalent content without duplicating canonical bodies.
Do not remove another project's material; report inaccessible/out-of-scope links.
Use public GitHub URLs for sibling documentation, never machine paths or private
company details. Machine-specific bindings belong in ignored `.mafe-si.toml`.
Documentation records no new deployment, publication or live-service authority.

Read the actual edited files back. Check links and anchors, inspect new untracked
files directly, and run `git diff --check`. Exercise changed runnable examples only
with applicable authorization and the existing verification procedure; otherwise
state the exact inspection/execution limit. A successful link/consistency check
proves only that property. For a stale-claim assessment without edit scope, report
the supported correction without applying it.

Use [godoo-ts-capture](../godoo-ts-capture/SKILL.md) only for a distinct request,
open decision or remaining work. Complete selected knowledge work here without
sending the same payload back to capture. Working research/evidence follows
owner-paths; do not add parallel planning journals to docs. Return changed canonical
locations, checked evidence and remaining limitations through this invocation.
