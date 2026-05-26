# godoo-ts

This repo is a Layer-1 satellite of the godoo / Odoo Atlas initiative. The shared
umbrella context is imported (never copied) from the sibling spine repo, so a freshly
cloned godoo-ts is immediately umbrella-aware:

@../godoo-hq/UMBRELLA_CLAUDE.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**godoo-ts**

godoo-ts is the TypeScript library monorepo of the godoo / Odoo Atlas initiative. It
adopts the three core Odoo client libraries from the broader `odoo-toolbox` repo —
renaming them under the `@godoo-dev/` npm scope — and becomes their single canonical home,
published as the TypeScript surface of the Odoo Atlas core-3 library parity scope. It
is for TypeScript developers managing real Odoo ERP instances as code.

**Core Value:** The core-3 libraries — `@godoo-dev/client`, `@godoo-dev/introspection`, `@godoo-dev/testcontainers`
— are cleanly adopted from `odoo-toolbox`, renamed under `@godoo-dev/`, and published to a
single canonical TS home, with **no period of dual-maintenance** between the two repos.

### Constraints

- **Tech stack**: TypeScript (strict, no `any`); pnpm workspaces; tsdown builds; vitest test runner — chosen to modernize the inherited npm-workspace/tsc toolchain in one pass during adoption
- **License**: LGPL-3.0 — carried from `odoo-toolbox`; drives the public repo decision
- **Process**: `godoo-adoption` branch protocol — no dual-maintenance; code is removed from `odoo-toolbox` as godoo-ts confirms each package stable
- **Dependency**: the `@godoo-dev/client` rename must lead — every other package imports from it, so renaming any package before the client would force two passes of import-path updates
- **Coupling**: `@godoo-dev/client`'s integration test suite spins up real Odoo containers via `@godoo-dev/testcontainers`; the client cannot be fully validated until `testcontainers` is adopted
- **Reporting**: a single terminal report-back is appended to `godoo-hq/dev-log.md` — only when all six success outcomes are met; no periodic status updates
- **Umbrella wiring**: the generated `CLAUDE.md` must `@`-import `../godoo-hq/UMBRELLA_CLAUDE.md`
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
