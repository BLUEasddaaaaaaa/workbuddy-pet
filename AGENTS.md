# Blueberry Project Rules

## Product semantics before animation mapping

- Do not treat a technical lifecycle event as a user-visible success signal without verifying its official meaning.
- Codex `Stop` means that a turn stopped; it does not prove that the user's task succeeded. Never map `Stop` directly to a completion celebration unless a separately approved product rule supplies reliable success evidence.
- `SessionEnd` means that the main session ended; it does not prove task success.
- When an event is ambiguous, prefer a neutral visual state over a positive or negative judgment.

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
- Do not call v1.1.0 complete or release-ready while a required automated, installed-runtime, multi-session, or package-identity gate is failing.
