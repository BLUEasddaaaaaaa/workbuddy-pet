'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACTIVE_EXPIRY_MS,
  MIN_DISPLAY_MS,
  STATE_PRIORITY,
  createStateCoordinator,
} = require('../../src/main/state-coordinator');


function createFakeClock() {
  let current = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimer(callback, delay) {
    const id = nextId++;
    timers.set(id, { callback, at: current + delay });
    return id;
  }

  function clearTimer(id) {
    timers.delete(id);
  }

  function tick(milliseconds) {
    const target = current + milliseconds;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      current = timer.at;
      timer.callback();
    }
    current = target;
  }

  return {
    now: () => current,
    setTimer,
    clearTimer,
    tick,
    timerCount: () => timers.size,
  };
}


function makeHarness() {
  const clock = createFakeClock();
  const emissions = [];
  const coordinator = createStateCoordinator({
    emitState: (state) => emissions.push({ state, at: clock.now() }),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  const accept = (eventType, sessionId, state) => coordinator.accept({ eventType, sessionId, state });
  return { accept, clock, coordinator, emissions };
}


test('exports the specified priorities and timing constants', () => {
  assert.deepEqual(STATE_PRIORITY, {
    sleeping: 0, idle: 1, thinking: 2, working: 3, happy: 4, attention: 5,
  });
  assert.deepEqual(MIN_DISPLAY_MS, {
    sleeping: 0, idle: 0, thinking: 1000, working: 1000, happy: 3000, attention: 3000,
  });
  assert.equal(ACTIVE_EXPIRY_MS, 30000);
});


test('repeated Working emits once without restarting its display hold', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'one', 'working');
  clock.tick(500);
  accept('tool.finished', 'one', 'working');
  assert.deepEqual(emissions, [{ state: 'working', at: 0 }]);
  clock.tick(500);
  accept('turn.finished', 'one', 'happy');
  assert.deepEqual(emissions.at(-1), { state: 'happy', at: 1000 });
  clock.tick(29500);
  assert.equal(emissions.at(-1).state, 'happy');
});


test('repeated Working refreshes its inactivity expiry from the latest event', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'one', 'working');
  clock.tick(500);
  accept('tool.finished', 'one', 'working');
  clock.tick(29500);
  assert.deepEqual(emissions, [{ state: 'working', at: 0 }]);
  clock.tick(500);
  assert.deepEqual(emissions.at(-1), { state: 'idle', at: 30500 });
});


test('Working waits until Thinking has displayed for 1000ms', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('turn.prompt_submitted', 'one', 'thinking');
  clock.tick(200);
  accept('tool.started', 'one', 'working');
  assert.deepEqual(emissions, [{ state: 'thinking', at: 0 }]);
  clock.tick(799);
  assert.equal(emissions.length, 1);
  clock.tick(1);
  assert.deepEqual(emissions.at(-1), { state: 'working', at: 1000 });
});


test('Attention immediately interrupts Working during its hold', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'one', 'working');
  clock.tick(100);
  accept('permission.requested', 'one', 'attention');
  assert.deepEqual(emissions, [
    { state: 'working', at: 0 },
    { state: 'attention', at: 100 },
  ]);
});


test('Attention holds for 3000ms before yielding to Working', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('permission.requested', 'one', 'attention');
  clock.tick(250);
  accept('tool.started', 'one', 'working');
  clock.tick(2749);
  assert.deepEqual(emissions, [{ state: 'attention', at: 0 }]);
  clock.tick(1);
  assert.deepEqual(emissions.at(-1), { state: 'working', at: 3000 });
});


test('Happy is not urgent and waits for the current Working hold', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'worker', 'working');
  clock.tick(250);
  accept('turn.finished', 'finisher', 'happy');
  assert.deepEqual(emissions, [{ state: 'working', at: 0 }]);
  clock.tick(749);
  assert.equal(emissions.length, 1);
  clock.tick(1);
  assert.deepEqual(emissions.at(-1), { state: 'happy', at: 1000 });
});


test('another session Working cannot replace current Attention until Attention advances', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('permission.requested', 'attention-session', 'attention');
  accept('tool.started', 'worker', 'working');
  clock.tick(3000);
  assert.deepEqual(emissions, [{ state: 'attention', at: 0 }]);
  accept('session.ended', 'attention-session', 'sleeping');
  assert.deepEqual(emissions.at(-1), { state: 'working', at: 3000 });
});


test('Happy holds for 3000ms against non-Attention candidates', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('turn.finished', 'one', 'happy');
  clock.tick(100);
  accept('tool.started', 'one', 'working');
  clock.tick(2899);
  assert.deepEqual(emissions, [{ state: 'happy', at: 0 }]);
  clock.tick(1);
  assert.deepEqual(emissions.at(-1), { state: 'working', at: 3000 });
});


test('Attention interrupts Happy immediately', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('turn.finished', 'one', 'happy');
  clock.tick(100);
  accept('permission.requested', 'one', 'attention');
  assert.deepEqual(emissions.at(-1), { state: 'attention', at: 100 });
});


test('ending one of two sessions reveals the remaining session state', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('session.started', 'worker', 'idle');
  accept('tool.started', 'worker', 'working');
  accept('permission.requested', 'other', 'attention');
  clock.tick(3000);
  accept('session.ended', 'other', 'sleeping');
  assert.deepEqual(emissions.at(-1), { state: 'working', at: 3000 });
});


test('ending the most recently updated of tied sessions preserves the equivalent live state', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'older', 'working');
  clock.tick(100);
  accept('tool.started', 'newer', 'working');
  clock.tick(900);
  accept('session.ended', 'newer', 'sleeping');
  assert.deepEqual(emissions, [{ state: 'working', at: 0 }]);
  accept('session.ended', 'older', 'sleeping');
  assert.deepEqual(emissions.at(-1), { state: 'sleeping', at: 1000 });
});


test('ending the final session emits Sleeping', () => {
  const { accept, emissions } = makeHarness();
  accept('session.started', 'one', 'idle');
  accept('session.ended', 'one', 'sleeping');
  assert.deepEqual(emissions.map(({ state }) => state), ['idle', 'sleeping']);
});


test('hold expiry recomputes and does not replay a stale pending candidate', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('turn.finished', 'one', 'happy');
  clock.tick(100);
  accept('tool.started', 'two', 'working');
  clock.tick(100);
  accept('session.ended', 'two', 'sleeping');
  clock.tick(2800);
  assert.deepEqual(emissions, [{ state: 'happy', at: 0 }]);
});


test('Thinking and Working expire after 30000ms of inactivity and resolve to Idle', async (t) => {
  for (const [eventType, state] of [['turn.prompt_submitted', 'thinking'], ['tool.started', 'working']]) {
    await t.test(state, () => {
      const { accept, clock, emissions } = makeHarness();
      accept(eventType, 'one', state);
      clock.tick(29999);
      assert.equal(emissions.at(-1).state, state);
      clock.tick(1);
      assert.deepEqual(emissions.at(-1), { state: 'idle', at: 30000 });
    });
  }
});


test('Attention does not expire after 30000ms and changes only on a session event', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('permission.requested', 'one', 'attention');
  clock.tick(60000);
  assert.deepEqual(emissions, [{ state: 'attention', at: 0 }]);
  accept('session.ended', 'one', 'sleeping');
  assert.deepEqual(emissions.at(-1), { state: 'sleeping', at: 60000 });
});


test('expired active session is removed and cannot survive as a phantom Idle session', () => {
  const { accept, clock, emissions } = makeHarness();
  accept('tool.started', 'stale', 'working');
  clock.tick(100);
  accept('permission.requested', 'live', 'attention');
  clock.tick(29900);
  assert.equal(emissions.at(-1).state, 'attention');
  accept('session.ended', 'live', 'sleeping');
  assert.deepEqual(emissions.at(-1), { state: 'sleeping', at: 30000 });
});


test('malformed coordination input is rejected without throwing', () => {
  const { coordinator, emissions } = makeHarness();
  for (const value of [null, undefined, {}, { eventType: 3, sessionId: 'x', state: 'idle' },
    { eventType: 'session.started', sessionId: '', state: 'idle' },
    { eventType: 'tool.started', sessionId: 'x', state: 'bogus' }]) {
    assert.doesNotThrow(() => coordinator.accept(value));
    assert.equal(coordinator.accept(value).ok, false);
  }
  assert.deepEqual(emissions, []);
});


test('dispose clears all timers, blocks later emissions, and is idempotent', () => {
  const { accept, clock, coordinator, emissions } = makeHarness();
  accept('turn.finished', 'one', 'happy');
  accept('tool.started', 'two', 'working');
  assert.ok(clock.timerCount() > 0);
  coordinator.dispose();
  coordinator.dispose();
  assert.equal(clock.timerCount(), 0);
  clock.tick(60000);
  assert.equal(coordinator.accept({ eventType: 'session.started', sessionId: 'three', state: 'idle' }).ok, false);
  assert.deepEqual(emissions, [{ state: 'happy', at: 0 }]);
});
