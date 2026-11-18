---

name: godoo-ts-docs
description: Retrieve, author, move and assess godoo-ts knowledge (TSDoc, package READMEs, docs/), decide which surface a claim belongs on, and mark Odoo-behaviour dependencies with atlas fact IDs. Work records and routing of knowledge this project does not own use godoo-ts-capture.
---

# Maintain godoo-ts knowledge

The repository is public. Every edit is readable by anyone; keep private paths,
company details and credentials out of it. Machine-specific bindings live in the
ignored `.mafe-si.toml`.

## What this project owns

godoo-ts owns how its own code behaves: client configuration, transport and
errors, CRUD and service helper semantics, introspection and code generation,
testcontainers, the `odoo-introspect` CLI, package boundaries and the library
targets. Its tests are the proof. It does not own what the Odoo server does,
how an agent should use an MCP tool, Stateman planning or adoption semantics, or
cross-component synthesis. [godoo-ts-capture](../godoo-ts-capture/SKILL.md)
routes those to their owners.

Each claim has one canonical home. Elsewhere, cite the owner instead of
restating the claim as a second source.

## Surfaces

| Surface                | Holds                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Code comment           | Why non-obvious code exists, including a workaround for an Odoo behaviour |
| TSDoc on the export    | The caller's contract: arguments, results, errors, version limits         |
| `packages/*/README.md` | Package usage across several APIs, setup and examples                     |
| `docs/development.md`  | Engineering, checks, CI and release                                       |
| `docs/libraries.md`    | Capability targets and accepted TS/Python differences                     |
| `README.md`            | Navigation and a first example                                            |
| `.agents/skills/`      | Maintainer procedures only; never published to consumers                  |

Pick the narrowest surface whose reader needs the claim. When several readers
need it, write each reflection for its reader rather than copying text.

## Atlas markers

Odoo-server behaviour (by version, edition or module) is owned by Atlas, the
Godoo knowledge base of verified Odoo facts. Atlas fact IDs such as
`base/create-record-basic` are public; fact text, verification records and Atlas
file paths are not, so never copy them here. Write the reflection in this
project's own words.

When text here depends on Odoo behaviour that can change between versions, mark
the fact it depends on:

- TSDoc: `@see atlas:base/create-record-basic`
- Code comment: `// atlas: base/create-record-basic`
- Markdown: `<!-- atlas: base/create-record-basic -->`

Mark only version-sensitive dependencies, not every mention of Odoo. A marker
records a dependency, not that the text is still correct; this project's tests
remain the first signal of breakage. Use only fact IDs that exist. If the fact
does not exist yet, write the reflection without a marker and send the
behaviour to Atlas intake through capture; add the marker once the ID exists.

## Retrieve

Open an explicit reference first. Otherwise search:

```sh
rg -n 'QUERY' README.md docs packages --glob '*.md'
rg -n 'QUERY' packages/*/src
```

Read matches in context and inspect source and tests before saying an API exists.
Cite the file and section, or a public commit URL for history. Keep dates and
qualifications: source, tests, package contents, publication and runtime results
are separate evidence. Queries make no edits. Report missing coverage. Use
explain-system for mechanics or rationale that needs research.

## Author or revise

Search existing coverage and edit its canonical home. Use technical-writing for
composition. In the same change, fix or remove every statement the edit
contradicts. Name a new page for its lasting subject, not for the change that
produced it. Label proposed behaviour as proposed until the implementation is
verified, then reconcile examples and claims with the result.

Before implementing a changed user or operator contract, draft the smallest
useful guide or example. Delivery owns implementation.

## Move or consolidate

Check affected links and anchors with `rg` first. Merge only equivalent content;
keep conflicting claims distinct with their qualifications; repair navigation.
Use public GitHub URLs for sibling projects. Do not remove another project's
material.

## Assess freshness

Compare claims with current source, tests and configuration; report each as
supported, contradicted or unresolved. A correction needs edit scope.

## Check

`pnpm check` covers code and TSDoc compilation, not prose. For Markdown, run
`git diff --check` and confirm changed relative links and anchors resolve. Run changed examples through
[godoo-ts-verification](../godoo-ts-verification/SKILL.md) when they are
runnable.

Report the changed locations and anything left unresolved.
