# Blueberry State Arbitration Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Blueberry to the stable pre-arbitration implementation while preserving project rules and the evidence needed for the next design.

**Architecture:** Reverse only the state-arbitration production and test commits in a new, recoverable Git history. Keep documentation, add a confirmed project context ledger, and do not rebuild, install, publish, or change the user-owned `.superpowers/` directory.

**Tech Stack:** Git, Electron, Node.js tests, Python tests, Markdown

---

### Task 1: Record context-management policy

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/context.md`

- [x] Add rules requiring agents to read `docs/context.md` after detected context compaction and before resolving critical project definitions.
- [x] Add the requirement that proposed context summaries must be shown to the user and confirmed before they are appended.
- [x] Write the exact project summary approved by the user, separating decisions, current findings, rules, and next steps.

### Task 2: Restore the stable implementation

**Files:**
- Restore production and test files changed by commits `0e025bc` through `2a5f208` to their state at `43e5d52`.
- Preserve: `AGENTS.md`, `docs/context.md`, iteration documents, plans, specifications, and acceptance evidence.
- Ignore: `.superpowers/`

- [x] Remove the uncommitted failing `state-coordinator` test change approved for removal.
- [x] Revert only the state-arbitration code and test commits, in reverse dependency order, using new revert commits so all removed work remains recoverable from Git history.
- [x] Confirm that production and test files match the stable baseline and that documentation remains present.

### Task 3: Mark the historical record accurately

**Files:**
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Modify: `docs/iterations/evidence/v1.1.0-state-arbitration-acceptance.md`

- [x] Add a short notice that the state-arbitration implementation was withdrawn after failed acceptance and remains historical evidence rather than current behavior.
- [x] Do not describe v1.1.0 as complete, accepted, installed, or release-ready.

### Task 4: Verify and commit

**Files:**
- Test: existing JavaScript and Python test suites

- [x] Run the stable JavaScript test command from `package.json` and require an exit code of zero.
- [x] Run the existing Python test suite and require an exit code of zero.
- [x] Inspect `git diff`, ensure `.superpowers/` is untouched, and ensure state-arbitration production/test files match `43e5d52`.
- [x] Commit the documentation/context changes separately from the generated revert commits.
- [x] Stop after reporting results; do not build, install, publish, or begin the replacement design.
