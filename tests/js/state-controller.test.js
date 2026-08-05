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

test('C01 controller starts logically and visibly idle', () => {
  const { controller, visuals } = createHarness();
  assert.deepEqual(controller.snapshot(), {
    logicalState: 'idle', visibleState: 'idle', visibleSince: 0,
    protectedUntil: 0, pendingState: null,
  });
  assert.deepEqual(visuals, [{ state: 'idle', at: 0 }]);
});

test('C02 thinking remains visible for its full two-second minimum', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('idle');
  clock.advance(1999);
  assert.equal(controller.snapshot().visibleState, 'thinking');
  clock.advance(1);
  assert.equal(controller.snapshot().visibleState, 'idle');
});

test('C03 working waits for thinking and starts its hold when actually shown', () => {
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

test('C04 an equal or higher priority candidate replaces the single pending candidate', () => {
  const { controller } = createHarness();
  controller.handleHookState('thinking');
  controller.handleMouseSleep();
  assert.equal(controller.snapshot().pendingState, 'sleeping');
  controller.handleHookState('idle');
  assert.equal(controller.snapshot().pendingState, 'idle');
  controller.handleHookState('working');
  assert.equal(controller.snapshot().pendingState, 'working');
});

test('C05 a lower priority candidate is discarded when a higher pending candidate exists', () => {
  const { controller } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('attention');
  controller.handleHookState('working');
  assert.equal(controller.snapshot().pendingState, 'attention');
});

test('C06 repeated working does not restart its visual or deadline', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('working');
  clock.advance(600);
  controller.handleHookState('working');
  assert.equal(controller.snapshot().visibleSince, 0);
  assert.equal(controller.snapshot().protectedUntil, 1000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'working']);
});

test('C07 unchanged post-tool working merges without extending protection', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('working');
  clock.advance(999);
  controller.handleHookState('working');
  clock.advance(1);
  assert.equal(controller.snapshot().protectedUntil, 1000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'working']);
});

test('C08 attention waits until the working hold reaches one second', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('working');
  clock.advance(250);
  controller.handleHookState('attention');
  clock.advance(749);
  assert.equal(controller.snapshot().visibleState, 'working');
  clock.advance(1);
  assert.equal(controller.snapshot().visibleState, 'attention');
});

test('C09 attention starts its own two seconds only when shown', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('working');
  clock.advance(250);
  controller.handleHookState('attention');
  clock.advance(750);
  assert.equal(controller.snapshot().visibleState, 'attention');
  assert.equal(controller.snapshot().visibleSince, 1000);
  assert.equal(controller.snapshot().protectedUntil, 3000);
});

test('C10 happy cannot interrupt attention and remains the one pending state', () => {
  const { controller } = createHarness();
  controller.handleHookState('attention');
  controller.handleHookState('happy');
  assert.equal(controller.snapshot().visibleState, 'attention');
  assert.equal(controller.snapshot().pendingState, 'happy');
});

test('C11 working updates logical state without interrupting visible attention', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('attention');
  clock.advance(500);
  controller.handleHookState('working');
  assert.equal(controller.snapshot().logicalState, 'working');
  assert.equal(controller.snapshot().visibleState, 'attention');
});

test('C12 one-shot returns to latest logical state', () => {
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

test('C13 happy completes before returning to session-end idle', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('happy');
  clock.advance(500);
  controller.handleHookState('idle');
  clock.advance(1499);
  assert.equal(controller.snapshot().visibleState, 'happy');
  clock.advance(1);
  assert.equal(controller.snapshot().visibleState, 'idle');
});

test('C14 a late timer transitions once and starts the next hold when shown', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  clock.advance(2500);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking', 'working']);
  assert.equal(controller.snapshot().visibleSince, 2500);
  assert.equal(controller.snapshot().protectedUntil, 3500);
});

test('C15 an early callback reschedules the absolute remainder', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  clock.advance(500);
  clock.invokeFirstEarly();
  assert.equal(controller.snapshot().visibleState, 'thinking');
  assert.equal(clock.pendingCount(), 1);
  clock.advance(1499);
  assert.equal(controller.snapshot().visibleState, 'thinking');
  clock.advance(1);
  assert.equal(controller.snapshot().visibleState, 'working');
});

test('C16-C17 every valid hook wakes sleeping immediately and resets idle time once', async (t) => {
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

test('C18 mouse movement wakes sleeping to idle', () => {
  const { controller } = createHarness();
  controller.handleMouseSleep();
  controller.handleMouseActivity();
  assert.equal(controller.snapshot().logicalState, 'idle');
  assert.equal(controller.snapshot().visibleState, 'idle');
});

test('C19 mouse sleep displays sleeping immediately when unprotected', () => {
  const { controller } = createHarness();
  controller.handleMouseSleep();
  assert.equal(controller.snapshot().logicalState, 'sleeping');
  assert.equal(controller.snapshot().visibleState, 'sleeping');
});

test('C20 mouse sleep during protection follows the single-pending priority rule', () => {
  const { controller, clock } = createHarness();
  controller.handleHookState('thinking');
  controller.handleMouseSleep();
  assert.equal(controller.snapshot().visibleState, 'thinking');
  assert.equal(controller.snapshot().pendingState, 'sleeping');
  clock.advance(2000);
  assert.equal(controller.snapshot().visibleState, 'sleeping');
});

test('C21 idle action is rejected outside visible logical idle', () => {
  const { controller } = createHarness();
  controller.handleHookState('working');
  assert.equal(controller.requestIdleAction('idle-reading', 5000), false);
  assert.equal(controller.requestIdleAction('idle-thinking', 5000), false);
});

test('C22 hook during a protected idle action waits for its deadline', () => {
  const { controller, clock } = createHarness();
  assert.equal(controller.requestIdleAction('idle-reading', 5000), true);
  controller.handleHookState('working');
  clock.advance(4999);
  assert.equal(controller.snapshot().visibleState, 'idle-reading');
  clock.advance(1);
  assert.equal(controller.snapshot().visibleState, 'working');
  assert.equal(controller.snapshot().protectedUntil, 6000);
});

test('C23 dispose clears timers and ignores later input', () => {
  const { controller, clock, visuals } = createHarness();
  controller.handleHookState('thinking');
  controller.handleHookState('working');
  controller.dispose();
  assert.equal(clock.pendingCount(), 0);
  controller.handleHookState('attention');
  controller.handleMouseSleep();
  controller.handleMouseActivity();
  assert.equal(controller.requestIdleAction('idle-thinking', 5000), false);
  clock.advance(5000);
  assert.deepEqual(visuals.map((entry) => entry.state), ['idle', 'thinking']);
});
