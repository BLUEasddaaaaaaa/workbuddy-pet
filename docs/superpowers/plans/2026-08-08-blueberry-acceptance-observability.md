# Blueberry Acceptance Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a read-only state-controller snapshot only during explicit acceptance runs so Task 5 can collect authoritative Renderer evidence.

**Architecture:** The preload converts the exact environment flag into one boolean on the existing context-isolated `petAPI`. Renderer conditionally installs one immutable read-only facade that closes over the existing controller; production state flow remains unchanged.

**Tech Stack:** Electron contextBridge, Renderer JavaScript, Node.js built-in test runner, CDP runtime evaluation.

---

### Task 1: Add the gated read-only snapshot facade

**Files:**
- Modify: `preload.js`
- Modify: `src/renderer/renderer.js`
- Modify: `tests/js/electron-wiring.test.js`
- Create: `tests/js/acceptance-observability.test.js`

- [ ] Write failing tests proving the preload flag is false by default and true only for exact `BLUEBERRY_ACCEPTANCE=1`.
- [ ] Write a failing wiring test proving Renderer guards the facade with `acceptanceMode === true`, installs a non-writable/non-configurable property, exposes only `snapshot`, and does not expose the controller.
- [ ] Run the focused tests and confirm failure is caused by the missing observability interface.
- [ ] Add the minimal preload boolean and Renderer facade shown in the approved design.
- [ ] Run focused, complete JavaScript, and Python suites; run syntax and diff checks.
- [ ] Commit only the four authorized files with `feat: add acceptance-only state snapshots`.

### Task 2: Resume Task 5 runtime acceptance

**Files:**
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Create: `docs/iterations/evidence/v1.1.0-renderer-controller-acceptance-2026-08-08.md`

- [ ] Start the worktree with `BLUEBERRY_ACCEPTANCE=1` and CDP without installing it.
- [ ] Prove default-mode absence separately without replacing the installed application.
- [ ] Read `window.__blueberryDebug.snapshot()` through CDP at the required state and timing boundaries.
- [ ] Send the seven real Python fixtures in the fixed order twice and verify delivery, state order, holds, no restart, no stale replay, and sleeping wake.
- [ ] Stop the worktree process and confirm ports are released.
- [ ] Record only observed evidence and the confirmed MVP limitations.
- [ ] Commit the two authorized documentation files with `docs: record renderer controller acceptance`.

## Stop conditions

- Stop if the default mode exposes `window.__blueberryDebug`.
- Stop if the facade can mutate controller state or becomes a second state authority.
- Stop if CDP still cannot obtain the snapshot or any required runtime scenario fails.
- Do not build, install, publish, or touch `.superpowers/`.
