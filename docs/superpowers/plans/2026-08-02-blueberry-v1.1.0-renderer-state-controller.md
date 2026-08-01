# Blueberry v1.1.0 Renderer State Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Blueberry's competing Renderer timers and state policies with one deterministic Renderer-side controller implementing the confirmed B timing scheme.

**Architecture:** Python normalizes Hooks and Electron Main validates, deduplicates, and forwards semantic events. A pure Renderer controller becomes the only visible-state authority; DOM code synchronously renders its decisions. The controller records `visibleSince` when it applies a visual and uses an absolute `protectedUntil` deadline with an injected clock for deterministic tests.

**Tech Stack:** Electron, browser JavaScript UMD module, Node.js built-in test runner, injected fake clock, existing Python Hook adapter.

---

## Files and responsibilities

| File | Action | Responsibility |
|---|---|---|
| `src/renderer/state-controller.js` | Create | Priority, protection, one pending state, one-shot return, sleep/wake, logical and visible state |
| `tests/js/state-controller.test.js` | Create | Fake-clock transition specification |
| `src/renderer/renderer.js` | Modify | DOM visual adapter and input forwarding only |
| `src/renderer/index.html` | Modify | Load the new controller |
| `src/main/event-router.js` | Modify | Change `session.ended` mapping to Idle |
| `tests/js/event-router.test.js` | Modify | Lock `SessionEnd -> Idle` |
| `tests/js/electron-wiring.test.js` | Modify | Prove one controller and no competing state timers |
| `src/renderer/completion-state-policy.js` | Delete | Retire contradictory post-Happy authority |
| `tests/js/completion-state-policy.test.js` | Delete | Replace with controller tests |
| `docs/iterations/v1.1.0-codex-hooks.md` | Modify | Record result and MVP limits |
| `docs/iterations/evidence/v1.1.0-renderer-controller-acceptance-2026-08-02.md` | Create | Preserve measured acceptance evidence |

## Fixed contract

```js
const controller = window.BlueberryStateController.createStateController({
  now: () => performance.now(),
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: (timer) => clearTimeout(timer),
  applyVisual: (state) => renderVisualState(state),
  resetMouseIdle: () => { lastMouseMoveTime = performance.now(); },
});

controller.handleHookState('thinking');
controller.handleMouseSleep();
controller.handleMouseActivity();
controller.requestIdleAction('idle-reading', 5000);
controller.snapshot();
controller.dispose();
```

Public states are Idle 1, Thinking 2, Working 3, Happy 4, Attention 5, and Sleeping 0. `idle-reading` and `idle-thinking` are internal Idle-priority presentation variants so existing autonomous animations do not become a second state authority.

Minimum display times are Thinking 2000 ms, Working 1000 ms, Attention 2000 ms, Happy 2000 ms, Idle 0 ms, and Sleeping 0 ms. Existing autonomous idle actions retain their 5000 ms minimum. Attention and Happy are one-shot states.

## Test matrix

| ID | Input sequence | Required result |
|---|---|---|
| C01 | Construct controller | Logical and visible state are Idle |
| C02 | Thinking | Visible for at least 2000 ms |
| C03 | Thinking, then Working at +500 ms | Working waits until +2000 ms |
| C04 | Lower pending, then equal/higher pending | Equal/higher replaces the one pending state |
| C05 | Higher pending, then lower pending | Lower candidate is discarded |
| C06 | Working repeated | No visual restart or deadline extension |
| C07 | PostToolUse produces unchanged Working | Same result as C06 |
| C08 | Working, Attention during hold | Attention starts only after Working reaches 1000 ms |
| C09 | Attention starts after waiting | Its 2000 ms starts at actual Renderer application |
| C10 | Attention visible, then Happy | Happy cannot interrupt and is lower-priority pending |
| C11 | Attention visible, then Working | Logical state updates without interruption |
| C12 | Attention completes | Latest logical state displays |
| C13 | Happy, then SessionEnd/Idle | Happy completes and returns to Idle |
| C14 | Timer callback is late | Hold grows longer but never shorter; transition happens once |
| C15 | Timer callback is invoked early | Remaining absolute time is rescheduled |
| C16 | Any valid Hook while Sleeping | Immediate wake to the Hook state |
| C17 | Hook wake | Mouse-idle reset runs once |
| C18 | Mouse movement while Sleeping | Immediate Idle |
| C19 | Mouse sleep request | Sleeping displays when unprotected |
| C20 | Mouse sleep during a protected state | It follows the single-pending priority rule |
| C21 | Idle action outside Idle | Request rejected |
| C22 | Hook during protected idle action | It waits; protection cannot be bypassed |
| C23 | Dispose | Timer cleared and later inputs ignored |
| W01 | `session.ended` | Router returns Idle |
| W02 | Renderer IPC state | Goes through one controller instance |
| W03 | Legacy policy/timers | Absent from active Renderer wiring |

### Task 1: Correct SessionEnd semantics

**Files:**
- Modify: `src/main/event-router.js:4-12`
- Modify: `tests/js/event-router.test.js:9-22`

- [ ] **Step 1: Change the test first**

Set only this expected entry:

```js
'session.ended': 'idle',
```

- [ ] **Step 2: Prove the old implementation fails**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --test tests/js/event-router.test.js
```

Expected: FAIL showing actual `sleeping` versus expected `idle`.

- [ ] **Step 3: Make the minimal implementation change**

In `EVENT_TO_STATE`, replace:

```js
'session.ended': 'sleeping',
```

with:

```js
'session.ended': 'idle',
```

- [ ] **Step 4: Rerun the focused test**

Run Step 2 again. Expected: all router tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/event-router.js tests/js/event-router.test.js
git commit -m "fix: map Codex session end to idle"
```

### Task 2: Implement the pure state controller test-first

**Files:**
- Create: `src/renderer/state-controller.js`
- Create: `tests/js/state-controller.test.js`

- [ ] **Step 1: Create a deterministic fake clock**

Start the test file with:

```js
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createStateController } = require('../../src/renderer/state-controller');

function createFakeClock(start = 0) {
  let current = start;
  let nextId = 1;
  const timers = new Map();
  function runDue() {
    while (true) {
      const due = [...timers.entries()]
        .filter(([, value]) => value.at <= current)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0]);
      if (!due.length) return;
      const [id, value] = due[0];
      timers.delete(id);
      value.callback();
    }
  }
  return {
    now: () => current,
    setTimer(callback, delay) {
      const id = nextId++;
      timers.set(id, { at: current + Math.max(0, delay), callback });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) { current += ms; runDue(); },
    invokeFirstEarly() {
      const first = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) return;
      timers.delete(first[0]);
      first[1].callback();
    },
    pendingCount: () => timers.size,
  };
}

function createHarness() {
  const clock = createFakeClock();
  const visuals = [];
  let resets = 0;
  const controller = createStateController({
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    applyVisual(state) { visuals.push({ state, at: clock.now() }); },
    resetMouseIdle() { resets += 1; },
  });
  return { controller, clock, visuals, resets: () => resets };
}
```

- [ ] **Step 2: Write C01-C15 before implementation**

Use explicit snapshots and complete visual sequences. These core tests are mandatory:

```js
test('working waits for thinking and starts its hold when actually shown', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  clock.advance(500);
  controller.handleHookState('working');
  assert.equal(controller.snapshot().visibleState, 'thinking');
  assert.equal(controller.snapshot().pendingState, 'working');
  clock.advance(1499);
  assert.equal(controller.snapshot().visibleState, 'thinking');
  clock.advance(1);
  assert.deepEqual(controller.snapshot(), {
    logicalState: 'working', visibleState: 'working', visibleSince: 2000,
    protectedUntil: 3000, pendingState: null,
  });
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking', 'working']);
});

test('repeated working does not restart its visual or deadline', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('working');
  clock.advance(600);
  controller.handleHookState('working');
  assert.equal(controller.snapshot().visibleSince, 0);
  assert.equal(controller.snapshot().protectedUntil, 1000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'working']);
});

test('attention starts its own two seconds only when shown', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('working');
  clock.advance(250);
  controller.handleHookState('attention');
  clock.advance(750);
  assert.equal(controller.snapshot().visibleState, 'attention');
  assert.equal(controller.snapshot().visibleSince, 1000);
  assert.equal(controller.snapshot().protectedUntil, 3000);
});

test('one-shot returns to latest logical state', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('working');
  clock.advance(1000);
  controller.handleHookState('attention');
  clock.advance(500);
  controller.handleHookState('working');
  clock.advance(1500);
  assert.equal(controller.snapshot().visibleState, 'working');
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'working', 'attention', 'working']);
});

test('early callback reschedules the absolute remainder', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  clock.advance(500);
  clock.invokeFirstEarly();
  assert.equal(controller.snapshot().visibleState, 'thinking');
  clock.advance(1500);
  assert.equal(controller.snapshot().visibleState, 'working');
});
```

Add separately named tests for the remaining C01-C15 rows. Do not combine pending replacement and lower-priority discard into one assertion.

- [ ] **Step 3: Write C16-C23 before implementation**

```js
test('every active Hook wakes sleeping and resets idle time', async (t) => {
  for (const state of ['idle', 'thinking', 'working', 'attention', 'happy']) {
    await t.test(state, () => {
      const h = createHarness();
      h.controller.handleMouseSleep();
      h.controller.handleHookState(state);
      assert.equal(h.controller.snapshot().visibleState, state);
      assert.equal(h.resets(), 1);
    });
  }
});

test('mouse movement wakes sleeping to idle', () => {
  const { controller } = createHarness();
  controller.handleMouseSleep();
  controller.handleMouseActivity();
  assert.equal(controller.snapshot().visibleState, 'idle');
});

test('idle action is accepted only from visible logical idle', () => {
  const { controller } = createHarness();
  assert.equal(controller.requestIdleAction('idle-reading', 5000), true);
  controller.handleHookState('working');
  assert.equal(controller.requestIdleAction('idle-thinking', 5000), false);
});

test('dispose clears timers and ignores later input', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  controller.dispose();
  assert.equal(clock.pendingCount(), 0);
  controller.handleHookState('attention');
  clock.advance(5000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking']);
});
```

- [ ] **Step 4: Run the test and prove it fails because the module is absent**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --test tests/js/state-controller.test.js
```

Expected: FAIL with `Cannot find module '../../src/renderer/state-controller'`.

- [ ] **Step 5: Implement `state-controller.js`**

Use a UMD wrapper so Node tests receive `module.exports` and the browser receives `window.BlueberryStateController`. Define exactly these constants and private fields:

```js
const PRIORITY = Object.freeze({
  attention: 5, happy: 4, working: 3, thinking: 2,
  idle: 1, 'idle-reading': 1, 'idle-thinking': 1, sleeping: 0,
});
const MIN_DISPLAY_MS = Object.freeze({
  idle: 0, 'idle-reading': 5000, 'idle-thinking': 5000,
  thinking: 2000, working: 1000, attention: 2000, happy: 2000, sleeping: 0,
});
const ONE_SHOT = new Set(['attention', 'happy']);

let logicalState = 'idle';
let visibleState = null;
let visibleSince = 0;
let protectedUntil = 0;
let pendingState = null;
let timer = null;
let disposed = false;
```

Implement transitions with these exact rules:

```js
function show(state, duration = MIN_DISPLAY_MS[state]) {
  if (disposed || state === visibleState) return false;
  applyVisual(state);
  visibleState = state;
  visibleSince = now();
  protectedUntil = visibleSince + duration;
  scheduleDeadline();
  return true;
}

function keepPending(candidate) {
  if (candidate === visibleState || candidate === pendingState) return;
  if (pendingState === null || PRIORITY[candidate] >= PRIORITY[pendingState]) {
    pendingState = candidate;
  }
}

function scheduleDeadline() {
  clearScheduledTimer();
  const remaining = protectedUntil - now();
  if (remaining <= 0) return resolveDeadline();
  timer = setTimer(resolveDeadline, remaining);
}

function resolveDeadline() {
  timer = null;
  const remaining = protectedUntil - now();
  if (remaining > 0) {
    timer = setTimer(resolveDeadline, remaining);
    return;
  }
  const queued = pendingState;
  pendingState = null;
  if (queued && ONE_SHOT.has(queued)) show(queued);
  else show(logicalState);
}
```

`handleHookState(state)` updates `logicalState` only for persistent states. If currently Sleeping, it clears pending/timers, resets mouse idle, and immediately calls `show(state)`. Otherwise it merges an unchanged visible state or uses the protected/pending path. `handleMouseSleep()` sets logical Sleeping. `handleMouseActivity()` wakes Sleeping to logical and visible Idle. `requestIdleAction()` accepts only `idle-reading`/`idle-thinking` while both logical and visible states are Idle. `snapshot()` returns copies of the five public fields. `dispose()` clears the timer and ignores later inputs.

- [ ] **Step 6: Run all C01-C23 tests**

Run Step 4 again. Expected: all controller tests PASS. If the first evidence-based implementation does not pass, preserve the failing test and stop under `AGENTS.md`.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/state-controller.js tests/js/state-controller.test.js
git commit -m "feat: add deterministic renderer state controller"
```

### Task 3: Integrate the controller and remove legacy authorities

**Files:**
- Modify: `src/renderer/index.html:72-73`
- Modify: `src/renderer/renderer.js:145-493,674-692`
- Delete: `src/renderer/completion-state-policy.js`
- Delete: `tests/js/completion-state-policy.test.js`
- Modify: `tests/js/electron-wiring.test.js`

- [ ] **Step 1: Write failing wiring guards**

```js
test('renderer delegates external states to one controller', () => {
  const renderer = read('src/renderer/renderer.js');
  const html = read('src/renderer/index.html');
  assert.match(html, /<script src="state-controller\.js"><\/script>/);
  assert.doesNotMatch(html, /completion-state-policy\.js/);
  assert.match(renderer, /createStateController\(/);
  assert.match(renderer, /controller\.handleHookState\(state\)/);
  assert.doesNotMatch(renderer, /completionStatePolicy/);
  assert.doesNotMatch(renderer, /happyTimer|workingTimer|attentionTimer/);
  assert.doesNotMatch(renderer, /function triggerHappy|function triggerWorking/);
  assert.doesNotMatch(renderer, /function triggerAttention|function triggerExternalState/);
});
```

- [ ] **Step 2: Run and observe failure**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --test tests/js/electron-wiring.test.js
```

Expected: FAIL because legacy functions and timers still exist.

- [ ] **Step 3: Load the new script**

Replace the two final script tags with:

```html
<script src="state-controller.js"></script>
<script src="renderer.js"></script>
```

- [ ] **Step 4: Replace state-specific Renderer transitions with one adapter**

Remove `happyTimer`, `workingTimer`, `attentionTimer`, `completionStatePolicy`, `triggerHappy`, `triggerWorking`, `triggerAttention`, and `triggerExternalState`. Preserve `hideAllActionGifs()` and `playCompletionSound()`. Add one synchronous `renderVisualState(state)` that:

1. clears only presentation timers;
2. hides every action image and removes every state CSS class;
3. shows exactly one matching visual;
4. plays completion sound only on entry to Happy;
5. never creates a state-return timer.

Instantiate exactly one controller:

```js
var controller = window.BlueberryStateController.createStateController({
  now: function () { return performance.now(); },
  setTimer: function (callback, delay) { return setTimeout(callback, delay); },
  clearTimer: function (timer) { clearTimeout(timer); },
  applyVisual: renderVisualState,
  resetMouseIdle: function () { lastMouseMoveTime = performance.now(); },
});
```

- [ ] **Step 5: Route every state-producing input through it**

```js
window.petAPI.onTriggerState(function (state) {
  controller.handleHookState(state);
});
```

Mouse displacement calls `controller.handleMouseActivity()`. The 60-second inactivity check calls `controller.handleMouseSleep()`. Random read/think calls `requestIdleAction('idle-reading', duration)` or `requestIdleAction('idle-thinking', duration)`. `checkIdleActions()` reads `controller.snapshot().visibleState` and runs only from Idle.

- [ ] **Step 6: Delete the retired policy and test**

Delete `src/renderer/completion-state-policy.js` and `tests/js/completion-state-policy.test.js`. Git makes this recoverable.

- [ ] **Step 7: Run focused tests**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" node --test tests/js/state-controller.test.js tests/js/event-router.test.js tests/js/electron-wiring.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/index.html src/renderer/renderer.js src/renderer/completion-state-policy.js tests/js/completion-state-policy.test.js tests/js/electron-wiring.test.js
git commit -m "refactor: centralize Blueberry visible state"
```

### Task 4: Lock the seven B-scheme risk treatments

**Files:**
- Modify: `tests/js/state-controller.test.js`
- Modify: `tests/js/electron-wiring.test.js`

- [ ] **Step 1: Add late-timer and stale-history sequences**

```js
test('late timer applies a transition once and starts the next hold when shown', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  clock.advance(2500);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking', 'working']);
  assert.equal(controller.snapshot().visibleSince, 2500);
  assert.equal(controller.snapshot().protectedUntil, 3500);
});

test('stale pending history is never replayed', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  controller.handleHookState('idle');
  controller.handleHookState('attention');
  controller.handleHookState('happy');
  assert.equal(controller.snapshot().pendingState, 'attention');
  clock.advance(2000);
  clock.advance(2000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking', 'attention', 'idle']);
});
```

- [ ] **Step 2: Add static guards against new competing timers**

Assert that `renderer.js` contains none of `happyTimer`, `workingTimer`, `attentionTimer`, `ATTENTION_DURATION`, `WORKING_TIMEOUT`, or `completionStatePolicy`.

- [ ] **Step 3: Run the complete regression suites**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin:$PATH" npm test
```

Expected: every JavaScript and Python test PASS. On a failed first evidence-based implementation, stop and ask; do not patch repeatedly.

- [ ] **Step 4: Commit**

```bash
git add tests/js/state-controller.test.js tests/js/electron-wiring.test.js
git commit -m "test: lock Blueberry animation arbitration"
```

### Task 5: Simulated worktree acceptance and evidence

**Files:**
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Create: `docs/iterations/evidence/v1.1.0-renderer-controller-acceptance-2026-08-02.md`

- [ ] **Step 1: Start the worktree app without installing it**

```bash
PATH="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" npm start
```

Expected: the worktree app opens and listens on `127.0.0.1:18920`.

- [ ] **Step 2: Send the existing fixtures in this exact order**

```bash
PYTHON_BIN="/Users/molan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/session-start.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/user-prompt-submit.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/pre-tool-use.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/post-tool-use.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/permission-request.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/stop.json
"$PYTHON_BIN" hooks/codex_hook.py < tests/fixtures/codex/session-end.json
```

Expected semantic sequence: Idle, Thinking, Working, unchanged Working, Attention, Happy, logical Idle. HTTP 200 proves delivery only.

- [ ] **Step 3: Inspect controller snapshots at boundaries**

Use the established CDP inspection method and capture `controller.snapshot()` at Thinking +1999/+2000 ms, Working +999/+1000 ms, Attention actual +1999/+2000 ms, Happy actual +1999/+2000 ms, and Sleeping followed by a valid Hook. Millisecond assertions require snapshots; screenshots are supporting evidence only.

- [ ] **Step 4: Repeat the sequence once**

Expected: identical state order, no duplicate restart, no stale replay, and no protected animation interruption.

- [ ] **Step 5: Record evidence**

The evidence document must contain source branch/commit/worktree, exact automated counts, a scenario/expected/observed/result table, and these MVP limits:

- `Stop -> Happy` is temporary for v1.1.0.
- Permission resolution and repeated reminder are deferred to v1.2.0.
- First-pixel acknowledgement is not implemented.
- Renderer reload safely returns to Idle.
- This gate does not prove installed-package identity or release readiness.

- [ ] **Step 6: Commit evidence**

```bash
git add docs/iterations/v1.1.0-codex-hooks.md docs/iterations/evidence/v1.1.0-renderer-controller-acceptance-2026-08-02.md
git commit -m "docs: record renderer controller acceptance"
```

## Mandatory stop conditions

- Preserve the first failing test and stop if the first evidence-based implementation still fails.
- Stop if Python, Main, DOM code, or a legacy policy would gain independent visible-state authority.
- Do not weaken protection times, change priority, add a FIFO queue, or restore state-specific return timers to obtain a pass.
- Do not build, install, publish, or call v1.1.0 complete in this plan; installed-runtime and package-identity gates remain separate.
- Do not touch the user-owned untracked `.superpowers/` directory.
