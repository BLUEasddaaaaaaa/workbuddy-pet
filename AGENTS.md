# Blueberry Project Rules

## Product semantics before animation mapping

- Do not treat a technical lifecycle event as a user-visible success signal without verifying its official meaning.
- Codex `Stop` means that a turn stopped; it does not prove that the user's task succeeded. Do not normally map `Stop` directly to a completion celebration. The fixed v1.1.0 mapping below is an explicit, temporary user-approved exception: v1.1.0 shows Happy for Stop, and v1.2.0 must revisit completion reliability.
- `SessionEnd` means that the main session ended; it does not prove task success.
- When an event is ambiguous, prefer a neutral visual state over a positive or negative judgment.

## Fixed v1.1.0 Codex-to-Blueberry mapping

- Keep the following mapping unchanged throughout v1.1.0. Revisit richer or more precise animation behavior only in a later explicitly approved iteration.

| Codex or local condition | Blueberry state | v1.1.0 behavior |
|---|---|---|
| `SessionStart` | `Idle` | The Codex conversation is active and Blueberry remains awake in standby. |
| `UserPromptSubmit` | `Thinking` | Codex received the user's task. |
| `PreToolUse` | `Working` | Codex started using a tool. |
| `PostToolUse` | `Working` | Codex finished one tool operation but may continue working; do not restart an unchanged Working animation. |
| `PermissionRequest` | `Attention` | The user needs to review an approval request. |
| `Stop` | `Happy` | For v1.1.0 only, treat Stop as the turn-completion celebration. Revisit completion reliability in v1.2.0. |
| `SessionEnd` | `Idle` | End Codex activity and return to awake standby; do not trigger sleep. |
| Local mouse inactivity timeout | `Sleeping` | Sleeping is driven by local mouse inactivity, not by a Codex Hook. |
| Local mouse movement after sleep | `Idle` | Wake Blueberry and return to awake standby. |

## Fixed v1.1.0 pending-state policy

- Keep at most one pending state. Never maintain a FIFO history of animations to replay.
- If there is no pending state, store the newly eligible state as the pending candidate while the current animation is protected.
- If a pending state already exists, replace it only when the new candidate has equal or higher priority. Discard a lower-priority candidate.
- Merge repeated occurrences of the same state; they must not restart the current animation or create another pending entry.
- When a persistent state's protection period ends, resolve from the latest confirmed logical state rather than blindly replaying the historical pending event.
- Apply the fixed one-shot and auto-return policy below. Do not invent additional one-shot states, return targets, or durations during implementation.

## Fixed v1.1.0 minimum-display timing

| Trigger or local condition | State | Minimum protected display | Additional rule |
|---|---|---:|---|
| `SessionStart` | `Idle` | 0 ms | Enter awake standby immediately. |
| `UserPromptSubmit` | `Thinking` | 2000 ms | Keep Thinking visible for at least two seconds. |
| `PreToolUse` | `Working` | 1000 ms | Keep Working visible for at least one second. |
| `PostToolUse` | `Working` | No new hold | Do not restart or extend an unchanged Working animation. |
| `PermissionRequest` | `Attention` | 3000 ms | Keep the approval cue visible for at least three seconds. |
| `Stop` | `Happy` | 4000 ms | Keep the v1.1.0 completion celebration visible for at least four seconds. |
| `SessionEnd` | `Idle` | 0 ms | Update the logical state to awake standby; any confirmed protected visual policy still applies. |
| Local mouse inactivity | `Sleeping` | Trigger after 60000 ms idle | Sleep is driven by mouse inactivity, not SessionEnd. |
| Local mouse movement after sleep | `Idle` | 0 ms | Wake immediately. |

- These minimum-display values are fixed for v1.1.0. The confirmed one-shot and auto-return rules are defined immediately below.

## Fixed v1.1.0 one-shot and auto-return policy

- `PermissionRequest -> Attention` is a one-shot visual. Once Attention has actually been visible for its confirmed 3000 ms protected duration, recompute and display the latest logical state.
- `Stop -> Happy` is a one-shot visual. Once Happy has actually been visible for its confirmed 4000 ms protected duration, recompute and display the latest logical state.
- Never hardcode the return target of either one-shot animation. Return to the latest logical state at completion time so an intervening Hook is respected and stale animation history is not replayed.
- Idle, Thinking, Working, and Sleeping are persistent states for v1.1.0. They do not auto-return merely because a timer elapsed.
- `PostToolUse` must not restart or extend an unchanged Working animation.
- `SessionEnd` updates the logical state to Idle and does not directly trigger Sleeping. Sleeping remains controlled by the local 60000 ms mouse-inactivity rule.
- These one-shot classifications and return rules are fixed for v1.1.0. State priority order is still unconfirmed and must be approved before implementation.

## Stop and ask when the product meaning is uncertain

- Stop implementation and ask the user before changing product meaning, success criteria, privacy boundaries, or the meaning of an animation.
- Stop and report evidence when an acceptance gate fails. Do not continue downstream tests and do not label the version complete.
- Stop and ask the user when the same area exposes repeated architecture conflicts, when three attempted fixes fail, or when the next fix would add a new authority/state source instead of resolving the existing one.
- Preserve the failing test, reproduction steps, logs, and current Git state while waiting for direction. Do not hide, weaken, or rewrite an acceptance requirement to obtain a pass.

## Mandatory user-confirmation stop

- When a requested change is not working after the first well-evidenced fix attempt, stop. Report the remaining failure and ask the user before attempting another fix.
- When a fix exposes a new architecture conflict, product-semantics question, or state-authority problem, stop immediately and ask the user. Do not continue with another patch based only on agent judgment.
- While waiting for confirmation, do not modify production code, add further fixes, run downstream acceptance or packaging, replace the installed application, or publish anything.
- Do not spawn or re-dispatch implementation, debugging, review, or acceptance subagents after the stop condition is reached unless the user explicitly approves the next action.
- A user request to “continue” authorizes only the currently agreed plan. It does not authorize an unbounded sequence of repairs when new problems change that plan.
- Never claim that a version is complete, nearly complete, accepted, or ready when a known required behavior is failing or has not been verified.

## Verification and release claims

- A successful HTTP response proves event acceptance, not visible animation success.
- Verify installed macOS builds against the exact worktree by byte-comparing critical `app.asar` files before and after installation.
- Prefer deterministic tests and CDP renderer inspection for animation state. Computer Use can generate Codex Tool Hooks and must not be the sole evidence for concurrent-state behavior.
- Do not call v1.1.0 complete or release-ready while a required automated, installed-runtime, single-conversation, or package-identity gate is failing. Multi-session behavior is outside the confirmed v1.1.0 scope.

## Context continuity

- Treat `docs/context.md` as the confirmed continuity ledger for critical project decisions, current state, known problems, prohibitions, and next steps.
- When system-provided history shows that conversation context was compacted, read `docs/context.md` before continuing the task.
- Before deciding a critical task definition—especially Hook semantics, version scope, acceptance criteria, architecture ownership, release state, or an explicit user prohibition—search `docs/context.md` for an existing confirmed definition.
- After detected context compaction, summarize any material new continuity information and show the exact proposed entry to the user. Append it to `docs/context.md` only after the user confirms it.
- Keep confirmed decisions, current observations, known problems, prohibitions, and next steps distinct. Never record an inference as a confirmed fact.
- Append new dated entries instead of silently overwriting history. Mark superseded decisions explicitly as deprecated and link them to the replacing decision.
