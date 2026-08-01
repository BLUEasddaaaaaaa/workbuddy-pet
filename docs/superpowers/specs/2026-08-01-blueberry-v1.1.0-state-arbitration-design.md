# Blueberry v1.1.0 State Arbitration Design

- **Status:** Approved direction; written specification pending user review
- **Date:** 2026-08-01
- **Target:** Apple Silicon macOS
- **Scope:** Stabilize the existing v1.1.0 Codex-to-Blueberry experience

## 1. Problem

The Codex Hook adapter and local HTTP event path are fast and reliable, but the visible animation is not. Two controlled runtime rounds showed that every Hook process returned successfully while Blueberry remained in Working. The current implementation discards `session_id`, reduces every event to one global state string, and restarts transient animation timers whenever another event arrives. Concurrent Codex activity can therefore overwrite Attention, Thinking, Happy, or Sleeping, and repeated Working events make the pet look interrupted or stuck.

This is a state-coordination defect after event delivery, not evidence that Codex Hooks are slow or missing.

## 2. Product Outcome

Blueberry should react promptly without appearing frantic. A user should be able to recognize the current highest-value Codex condition even when Hooks arrive quickly or more than one Codex task is active.

The v1.1.0 stabilization succeeds when:

- repeated events that resolve to the currently visible state do not restart its animation;
- short-lived important states remain visible for their minimum duration;
- lower-priority activity cannot immediately hide Permission or completion feedback;
- ending one session reveals the correct state of any remaining session;
- a quiet system eventually returns to Idle or Sleeping instead of remaining stuck;
- the existing privacy boundary and fail-open Hook behavior remain unchanged.

## 3. Chosen Approach

Use a lightweight, session-aware state coordinator. This is the smallest useful subset of the strategy observed in Clawd on Desk:

1. retain the current state of each Codex session;
2. choose the highest-priority candidate across active sessions;
3. deduplicate a candidate equal to the currently displayed state;
4. enforce a minimum display time;
5. retain at most one pending candidate;
6. recompute from current sessions when a session changes or a hold expires.

Blueberry will learn from the architecture but will not copy Clawd source code. Clawd is AGPL-3.0, while this design is an independent implementation limited to Blueberry's current requirements.

### Rejected alternatives

- **Renderer-only timer patches:** simpler initially, but they cannot resolve competing sessions because the renderer currently receives no session identity.
- **Full Clawd-style state engine:** handles more cases, but completion debouncing, theme-defined timing, many additional states, and a broader notification system are unnecessary for this stabilization.

## 4. Architecture and Responsibilities

### Event router

`src/main/event-router.js` continues to validate the privacy-safe canonical event and map its semantic `event_type` to a Blueberry visual state. Its successful result will retain the event identity needed by coordination: `eventType`, `sessionId`, and `state`. It will not forward prompts, commands, code, paths, tool input/output, transcripts, or final response content.

### State coordinator

A new focused module, `src/main/state-coordinator.js`, owns session state and transition policy. It exposes an interface equivalent to:

```js
const coordinator = createStateCoordinator({ emitState, now, setTimer, clearTimer });
coordinator.accept({ eventType, sessionId, state });
coordinator.dispose();
```

It stores only:

- one current state per session;
- the state and start time last emitted to the renderer;
- one pending state candidate;
- one minimum-display timer.

The module is independent of Electron and HTTP so its behavior can be tested deterministically.

### Event server and Electron wiring

`src/main/event-server.js` keeps validation, request-size limits, duplicate-event protection, and fail-open behavior. For canonical `/event` requests it sends the routed session-aware event to the coordinator. The legacy development-only `/state` endpoint remains a direct visual test path and does not create a durable Codex session.

The Electron main process owns one coordinator and sends only approved visual transitions to the renderer over the existing IPC channel. This keeps multi-session product policy out of DOM code.

Implementation review exposed a renderer-readiness race not explicit in the original design: the coordinator can approve a state before the renderer IPC delivery callback is attached. A focused readiness bridge therefore buffers only the latest approved state while detached and replays it exactly once after attachment. It is a delivery-lifecycle component, not another state authority; priority and holds remain in the coordinator, while presentation deduplication remains in the renderer.

### Renderer

The renderer remains responsible for presenting existing assets, completion sound, drag behavior, eye movement, and local idle behavior. It gains explicit same-state deduplication so receiving the same approved state twice cannot reset a GIF or timer.

The coordinator is the authority for external Codex transitions. Renderer safety timeouts may prevent a permanent stuck visual if the main process stops sending events, but they must not select between Codex sessions.

## 5. State Model

### Priority and initial timing

| State | Meaning | Priority | Minimum display |
|---|---|---:|---:|
| `attention` | Codex needs user permission | 5 | 3000 ms |
| `happy` | A turn completed | 4 | 3000 ms |
| `working` | A tool is active or just returned | 3 | 1000 ms |
| `thinking` | A prompt was submitted | 2 | 1000 ms |
| `idle` | Session exists but has no active work | 1 | 0 ms |
| `sleeping` | Session ended and no active session outranks it | 0 | 0 ms |

Priority expresses interruption value, not animation quality. Attention is above Happy because an approval request requires action; Happy is above ongoing background work so completion is perceptible.

### Session updates

| Semantic event | Session update |
|---|---|
| `session.started` | create or reset the session to Idle |
| `turn.prompt_submitted` | set the session to Thinking |
| `tool.started` | set the session to Working |
| `tool.finished` | keep the session Working for this MVP |
| `permission.requested` | set the session to Attention |
| `turn.finished` | set the session to Happy |
| `session.ended` | remove the session, then recompute from remaining sessions |

If no session remains after `session.ended`, the candidate is Sleeping. A later session event wakes Blueberry normally.

### Transition rules

1. Apply the incoming event to its session record.
2. Resolve the highest-priority state across current sessions. Equal priorities prefer the most recently updated session, but the renderer still receives only the visual state.
3. If the candidate equals the displayed state, do not emit or restart the minimum timer.
4. If the displayed state has satisfied its minimum duration, emit the candidate immediately.
5. If the minimum duration has not elapsed:
   - Attention is the only urgent state and may interrupt immediately because the user must act;
   - every other candidate waits, including a higher-priority Working candidate arriving during Thinking;
   - the single pending candidate is refreshed from the highest-priority live session state rather than appended to a queue.
6. When the hold expires, discard the stored candidate as an instruction and recompute from live sessions. This prevents stale queued animations.

Priority selects meaning across sessions; minimum display protects continuity over time. These are separate decisions. A lower-priority state never replaces a still-current higher-priority session merely because three seconds elapsed. It becomes visible only after the higher-priority session receives a resolving event or ends.

There is deliberately no unbounded animation queue. Blueberry represents current meaning, not a replay of every Hook.

## 6. Failure and Recovery

- An invalid or oversized event is rejected exactly as in the current server.
- A duplicate `event_id` remains ignored before it reaches coordination.
- If renderer IPC delivery throws, the HTTP request reports `state_delivery_failed`; the Python Hook still exits neutrally so Blueberry cannot block Codex.
- A session record in Thinking or Working has a 30-second inactivity expiry so a missing follow-up Hook cannot keep an active visual forever. Expiry removes that stale active record and resolves to the remaining sessions; when none remain, it emits Idle rather than pretending that a real `SessionEnd` was observed. Attention and Happy use their explicit transition rules and are not silently converted into a false session ending.
- `dispose()` clears coordinator timers during application shutdown and tests.
- Direct `/state` requests remain isolated from session arbitration and are documented as diagnostics, not proof of real concurrent behavior.

## 7. Testing and Acceptance

Implementation follows test-driven development.

### Automated policy tests

The new coordinator tests must prove:

- repeated Working does not emit twice or restart its hold;
- Working waits behind the minimum Thinking display;
- Attention immediately interrupts Working;
- Working cannot hide Attention before three seconds;
- Happy remains visible for three seconds unless Attention arrives;
- ending one of two sessions reveals the remaining session state;
- ending the final session produces Sleeping;
- a pending candidate is recomputed rather than replayed when the hold expires;
- session inactivity recovery cannot leave Working permanent;
- disposal clears scheduled timers.

Router and server contract tests must prove that `session_id` reaches the coordinator while forbidden payload content still does not.

### Renderer tests

Renderer policy tests must prove that the same approved state is a no-op and does not replay the completion sound or reset animation timers.

### Runtime acceptance

Repeat the earlier two controlled event rounds against the rebuilt installed application. Record event delivery latency and visible states at meaningful hold boundaries. Then run two overlapping simulated sessions and confirm that Attention and Happy remain observable while repeated tool events do not restart Working.

Acceptance requires all existing Node and Python tests, the new arbitration tests, packaging verification, and the runtime matrix to pass. The stable GitHub release remains on hold until this evidence is recorded.

## 8. Evolution After v1.1.0

The coordinator is intentionally extensible without being general-purpose. Later iterations may add:

- v1.2.0: error, notification, compaction, permission-reminder, and tool-specific states;
- v1.3.0: richer multi-window/multi-task presentation and subagent helpers;
- later versions: completion debounce, one-shot restoration rules, theme-defined timings, music awareness, water reminders, and break reminders.

Each addition must be justified by a user-visible problem and added through its own design review. The v1.1.0 coordinator should not pre-implement those behaviors.
