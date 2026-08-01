# Blueberry Project Context

This file contains user-confirmed continuity information. Agents must follow the context-management rules in `AGENTS.md` before reading from or appending to it.

## 2026-08-02: v1.1.0 State-Arbitration Rollback

### Confirmed decisions

- Blueberry v1.1.0 still aims to provide the minimum viable response loop between Codex Hooks and the desktop pet.
- Do not continue patching the current complex state-arbitration approach. Restore the code to the stable baseline from before that approach was introduced.
- Preserve `AGENTS.md`, iteration records, acceptance records, and failure evidence.
- A replacement design must have only one module with authority to decide the user-visible state.
- Codex `Stop` does not mean that the task succeeded and must not directly trigger Happy.

### Current findings

- State decisions became distributed across the main-process coordinator, renderer policy, legacy completion policy, and renderer timing logic.
- The new work improved event deduplication, session identity, and test coverage, but increased overall complexity.
- Known unresolved behavior included the final session returning to Idle instead of Sleeping and Happy appearing before task completion.
- The current version must not be described as v1.1.0 complete or release-ready.

### Working rules

- If the first evidence-based fix for the same problem still fails, stop patching and ask the user.
- Stop modifying code when product semantics or state-authority responsibilities conflict.
- Do not build, install, publish, or dispatch a subagent without the user's confirmation after a mandatory stop.
- After detected context compaction, read this file first. Show any proposed new context summary to the user and receive confirmation before appending it.

### Next step

- Complete the recoverable rollback and verify the stable baseline.
- Discuss a smaller v1.1.0 state design before writing replacement implementation code.
