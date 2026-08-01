# Blueberry v1.1.0 State Arbitration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Blueberry display stable, priority-aware Codex reactions across rapid and overlapping sessions without expanding the current animation set.

**Architecture:** Preserve validated session identity through the event router and HTTP server, then feed it into a pure main-process state coordinator. The coordinator owns per-session state, priority, minimum-display timing, one pending candidate, and stale-active recovery; the renderer remains a presentation layer and deduplicates repeated approved states.

**Tech Stack:** Electron 35, CommonJS JavaScript, Node.js `node:test`, Python 3 standard library Hook adapter, electron-builder, macOS arm64.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/main/event-router.js` | Validate canonical events and return privacy-safe coordination fields |
| `src/main/event-server.js` | Deliver routed events to coordination while preserving `/state` diagnostics |
| `src/main/state-coordinator.js` | Pure session arbitration, priority, holds, pending candidate, and expiry |
| `main.js` | Compose one coordinator with HTTP and Electron IPC; dispose it on shutdown |
| `src/renderer/external-state-policy.js` | Pure same-state presentation deduplication |
| `src/renderer/renderer.js` | Apply only approved visual transitions using existing assets |
| `src/renderer/index.html` | Load the renderer policy before `renderer.js` |
| `tests/js/*.test.js` | Contract, policy, integration, and regression tests |
| `docs/iterations/evidence/v1.1.0-state-arbitration-acceptance.md` | Quantified automated, runtime, and packaging evidence |

### Task 1: Preserve Session-Aware Events Through the HTTP Boundary

**Files:**
- Modify: `src/main/event-router.js`
- Modify: `src/main/event-server.js`
- Modify: `tests/js/event-router.test.js`
- Modify: `tests/js/event-server.test.js`

- [ ] **Step 1: Write failing router and server tests**

Update the successful router expectation to require only privacy-safe fields:

```js
assert.deepEqual(routeEvent(makeEvent('tool.started')), {
  ok: true,
  event: {
    eventType: 'tool.started',
    sessionId: 'thr_test',
    state: 'working',
  },
});
```

Change the event-server test callback to `onEvent`, collect routed events, and assert that `/event` delivers the object above while `/state` still calls `onState('attention')`. Add an assertion that neither callback object contains `metadata`, `turn_id`, `tool_use_id`, prompt, command, path, or tool output.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/js/event-router.test.js tests/js/event-server.test.js
```

Expected: FAIL because `routeEvent()` returns `{ ok, state }` and the server has no `onEvent` callback.

- [ ] **Step 3: Implement the minimal privacy-safe routed event**

Return this shape after validation:

```js
return {
  ok: true,
  event: {
    eventType: event.event_type,
    sessionId: event.session_id,
    state: EVENT_TO_STATE[event.event_type],
  },
};
```

In `createEventServer`, accept both callbacks:

```js
const deliverEvent = typeof onEvent === 'function' ? onEvent : () => {};
const deliverState = typeof onState === 'function' ? onState : () => {};
```

Use `deliverEvent(routed.event)` only for `/event`; retain `deliverState(payload.state)` only for `/state`. Keep response bodies compatible by returning `state: routed.event.state`.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test tests/js/event-router.test.js tests/js/event-server.test.js
npm test
```

Expected: focused tests PASS; full Node and Python suites PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/main/event-router.js src/main/event-server.js tests/js/event-router.test.js tests/js/event-server.test.js
git commit -m "refactor: preserve Codex session identity"
```

### Task 2: Implement the Pure State Coordinator

**Files:**
- Create: `src/main/state-coordinator.js`
- Create: `tests/js/state-coordinator.test.js`

- [ ] **Step 1: Write a deterministic fake clock and failing behavior tests**

The test helper must expose `now()`, injected `setTimer`/`clearTimer`, and `advance(ms)`. Use it to assert these independent behaviors:

```js
coordinator.accept({ eventType: 'tool.started', sessionId: 'a', state: 'working' });
coordinator.accept({ eventType: 'tool.finished', sessionId: 'a', state: 'working' });
assert.deepEqual(emitted, ['working']);
```

Also test: Thinking holds Working for 1000 ms; Attention is the only state that immediately interrupts a hold; Working never replaces a still-current Attention session merely because 3000 ms elapsed; Happy holds for 3000 ms unless Attention arrives; ending session `a` reveals session `b`; ending the final session emits Sleeping; hold expiry recomputes live state instead of replaying a stale pending candidate; Thinking/Working expire after 30000 ms and resolve to Idle; `dispose()` removes all timers.

- [ ] **Step 2: Run the coordinator test and verify RED**

Run:

```bash
node --test tests/js/state-coordinator.test.js
```

Expected: FAIL with `Cannot find module '../../src/main/state-coordinator'`.

- [ ] **Step 3: Implement constants and public API**

Create immutable policy tables:

```js
const STATE_PRIORITY = Object.freeze({
  sleeping: 0, idle: 1, thinking: 2, working: 3, happy: 4, attention: 5,
});
const MIN_DISPLAY_MS = Object.freeze({
  sleeping: 0, idle: 0, thinking: 1000, working: 1000, happy: 3000, attention: 3000,
});
const ACTIVE_EXPIRY_MS = 30000;
```

Export `createStateCoordinator`, `STATE_PRIORITY`, `MIN_DISPLAY_MS`, and `ACTIVE_EXPIRY_MS`. `accept(event)` updates or removes the session, resolves the candidate, applies interruption/hold rules, and emits only changed states. Store at most one pending candidate and recompute from the sessions when the hold ends. Expiry applies only to Thinking and Working and emits Idle when no live session remains. `dispose()` clears the hold and all per-session expiry timers.

- [ ] **Step 4: Run RED/GREEN cycles one behavior at a time**

After each minimal implementation increment, run:

```bash
node --test tests/js/state-coordinator.test.js
```

Expected final result: all coordinator tests PASS with no warnings or open handles.

- [ ] **Step 5: Run the complete regression suite**

```bash
npm test
```

Expected: all Node and Python tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/main/state-coordinator.js tests/js/state-coordinator.test.js
git commit -m "feat: coordinate Blueberry session states"
```

### Task 3: Integrate Coordination and Renderer Deduplication

**Files:**
- Modify: `main.js`
- Create: `src/renderer/external-state-policy.js`
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/renderer.js`
- Modify: `tests/js/electron-wiring.test.js`
- Create: `tests/js/external-state-policy.test.js`

- [ ] **Step 1: Write failing renderer-policy and wiring tests**

Require the new policy and prove same-state deduplication:

```js
const policy = createExternalStatePolicy();
assert.equal(policy.shouldApply('working'), true);
assert.equal(policy.shouldApply('working'), false);
assert.equal(policy.shouldApply('attention'), true);
assert.equal(policy.current(), 'attention');
```

Extend wiring assertions so `main.js` creates a coordinator, passes `onEvent` to the server, sends coordinator output through `trigger-state`, and disposes the coordinator during shutdown. Assert that `index.html` loads `external-state-policy.js` before `renderer.js` and that renderer state dispatch calls `shouldApply(state)` before any trigger function.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test tests/js/external-state-policy.test.js tests/js/electron-wiring.test.js
```

Expected: FAIL because the policy module and coordinator wiring are absent.

- [ ] **Step 3: Add the minimal renderer policy**

Follow the existing UMD pattern and expose:

```js
function createExternalStatePolicy() {
  let currentState = null;
  return {
    shouldApply(state) {
      if (state === currentState) return false;
      currentState = state;
      return true;
    },
    current() { return currentState; },
  };
}
```

Instantiate it once in `renderer.js`. At the beginning of `triggerExternalState(state)`, return immediately when `shouldApply(state)` is false. This prevents duplicate GIF resets and duplicate Happy sound.

- [ ] **Step 4: Compose the coordinator in Electron**

Create one coordinator after the window is ready:

```js
stateCoordinator = createStateCoordinator({ emitState: sendStateToRenderer });
httpServer = startEventServer({
  onEvent: (event) => stateCoordinator.accept(event),
  onState: sendStateToRenderer,
  logger: console,
});
```

Dispose the coordinator before quitting. Preserve `/state` as a direct diagnostic route and do not route it into durable sessions.

- [ ] **Step 5: Run focused and full regression tests**

```bash
node --test tests/js/external-state-policy.test.js tests/js/electron-wiring.test.js
npm test
```

Expected: all tests PASS; repeated Happy is proven not to replay presentation behavior.

- [ ] **Step 6: Commit Task 3**

```bash
git add main.js src/renderer/external-state-policy.js src/renderer/index.html src/renderer/renderer.js tests/js/electron-wiring.test.js tests/js/external-state-policy.test.js
git commit -m "feat: stabilize Blueberry animation transitions"
```

### Task 4: Quantified Acceptance, Packaging, and Iteration Records

**Files:**
- Create: `docs/iterations/evidence/v1.1.0-state-arbitration-acceptance.md`
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Modify: `docs/iterations/README.md`
- Modify: `/Users/molan/Documents/Codex/2026-07-30/zhe-ge/outputs/workbuddy/notes/blueberry-interview-notes.md`

- [ ] **Step 1: Run automated acceptance and record exact totals**

```bash
npm test
```

Record Node and Python pass counts. Acceptance is zero failures, zero unhandled rejections, and no timer-related open-handle warning.

- [ ] **Step 2: Run a deterministic two-session metric test**

Use the coordinator test harness or a small fixture runner to record these metrics:

| Metric | Required result |
|---|---|
| Same-state replay count | 0 additional emissions |
| Thinking minimum display | at least 1000 ms |
| Working minimum display | at least 1000 ms |
| Attention continuity | at least 3000 ms and until its session advances or ends |
| Happy minimum display | at least 3000 ms unless Attention arrives |
| Final-session end | Sleeping emitted |
| One-of-two session end | remaining session state emitted |
| Stale Thinking/Working recovery | Idle at 30000 ms |

- [ ] **Step 3: Build the arm64 macOS package**

```bash
npm run build:mac
```

Expected: electron-builder exits 0 and produces the Blueberry arm64 DMG/app artifacts. Signing/notarization remains out of scope and must be stated explicitly.

- [ ] **Step 4: Repeat runtime rounds against the installed build**

Run the original single-session sequence and an overlapping two-session sequence through the installed Python Hook adapter. Record per-event process latency and visible samples near 1-second and 3-second hold boundaries. Required results:

- Hook warm-path timing remains below 200 ms per event;
- Attention and Happy are observable for their required holds;
- repeated PreToolUse/PostToolUse does not visibly restart Working;
- SessionEnd for one session does not hide another active session;
- ending the final session reaches Sleeping;
- no round remains stuck in Working after its recovery boundary.

If Computer Use generates observer Hooks, label those samples and rely on deterministic overlapping-session fixtures for exact attribution.

- [ ] **Step 5: Update iteration and interview records**

Create the evidence document with commands, totals, timings, pass/fail matrix, limitations, and release recommendation. Change iteration status to stabilized only if all required results pass; otherwise keep it in progress and list the failing metric. Add an interview note explaining metric-driven root-cause isolation and the lightweight-versus-full-engine product trade-off.

Before replacing the installed application, extract the new worktree build's `app.asar` and byte-compare `renderer.js`, `external-state-policy.js`, `state-coordinator.js`, `renderer-state-bridge.js`, and `main.js` with the worktree. After installation, repeat the exact comparison against the installed `app.asar`. Stop acceptance immediately on any mismatch; HTTP success from an unproven artifact is not release evidence.

- [ ] **Step 6: Commit Task 4**

```bash
git add docs/iterations/evidence/v1.1.0-state-arbitration-acceptance.md docs/iterations/v1.1.0-codex-hooks.md docs/iterations/README.md
git commit -m "docs: verify Blueberry state arbitration"
```

The external interview record is stored beside the repository collection and is not included in the repository commit.
