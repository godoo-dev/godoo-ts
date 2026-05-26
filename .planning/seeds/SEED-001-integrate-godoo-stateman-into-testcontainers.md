---
id: SEED-001
status: dormant
planted: 2026-05-21
planted_during: Phase 03 — Publishing & Source-Repo Shedding (context-gathering)
trigger_when: when relevant
scope: unknown
---

# SEED-001: Integrate ../godoo-stateman (Python, WASM/Pyodide-capable) for testcontainers/test-harness and reduce @godoo/testcontainers scope to initialization only

## Why This Matters

_To be filled in. Run `/gsd:capture --seed --enrich SEED-001` to add context._

Initial framing from capture:
> godoo-stateman (Python) is going to be the canonical state manager. godoo-py is heading in the direction of using godoo-stateman for state/harness concerns and reducing the per-package surface to *initialization only*. Because godoo-stateman is expected to run under WASM (Pyodide), a TypeScript consumer (Node and/or browser) could in principle drive it the same way godoo-py will — meaning `@godoo/testcontainers` (and any future test-harness work) would shrink to "spin up the container, hand state ops to godoo-stateman", instead of carrying TS-side state-shaping logic.

## When to Surface

**Trigger:** when relevant

This seed will surface during `/gsd:new-milestone` when the milestone scope matches.

Likely real triggers (to confirm via `--enrich`):
- When `godoo-stateman` ships a stable Python API for state/harness ops
- When `godoo-stateman` confirms WASM/Pyodide build is publishable + consumable from Node
- When `godoo-py` lands its testcontainers-via-stateman pattern (the cross-language precedent)
- When `@godoo/testcontainers` accumulates state-shaping logic that duplicates stateman

## Scope Estimate

**Unknown** — run `/gsd:capture --seed --enrich SEED-001` to estimate effort.

## Breadcrumbs

- `C:\dev\godoo-dev\godoo-ts\packages\testcontainers\` — the package whose scope would shrink to initialization-only
- `C:\dev\godoo-dev\godoo-stateman\` (sibling satellite) — the Python state manager that would be embedded via WASM
- `C:\dev\godoo-dev\godoo-py\` (sibling satellite) — the cross-language precedent heading in this direction
- `..\godoo-hq\UMBRELLA_CLAUDE.md` — initiative topology table lists all three satellites
- Pyodide — https://pyodide.org — the WASM CPython runtime that would let godoo-stateman load inside Node/browser

## Notes

_Captured via one-shot seed capture. Enrich with trigger, why, and scope at your convenience._

Cross-cuts the godoo library family:
- TS satellite (`godoo-ts`): shrinks `@godoo/testcontainers` and possibly retires the in-house test-harness path
- Python satellite (`godoo-py`): drives the precedent
- State manager (`godoo-stateman`): becomes the shared core, must ship a Pyodide-loadable artifact

Out of scope for the current v1 milestone (which is the bounded adoption + rename + publish + retire-odoo-toolbox). This is post-v1 cross-satellite design work; it belongs to a future godoo-ts milestone or to a cross-cutting Layer-3 effort coordinated from `godoo-hq`.
