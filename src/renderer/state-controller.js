(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BlueberryStateController = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRIORITY = Object.freeze({
    attention: 5,
    happy: 4,
    working: 3,
    thinking: 2,
    idle: 1,
    'idle-reading': 1,
    'idle-thinking': 1,
    sleeping: 0,
  });
  const MIN_DISPLAY_MS = Object.freeze({
    idle: 0,
    'idle-reading': 5000,
    'idle-thinking': 5000,
    thinking: 2000,
    working: 1000,
    attention: 2000,
    happy: 2000,
    sleeping: 0,
  });
  const ONE_SHOT = new Set(['attention', 'happy']);
  const HOOK_STATES = new Set(['idle', 'thinking', 'working', 'attention', 'happy']);
  const PERSISTENT_STATES = new Set(['idle', 'thinking', 'working']);
  const IDLE_ACTIONS = new Set(['idle-reading', 'idle-thinking']);

  function createStateController(options) {
    const now = options.now;
    const setTimer = options.setTimer;
    const clearTimer = options.clearTimer;
    const applyVisual = options.applyVisual;
    const resetMouseIdle = options.resetMouseIdle;

    let logicalState = 'idle';
    let latestPersistentState = 'idle';
    let visibleState = null;
    let visibleSince = 0;
    let protectedUntil = 0;
    let pendingState = null;
    let timer = null;
    let disposed = false;

    function clearScheduledTimer() {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
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

    function scheduleDeadline() {
      clearScheduledTimer();
      const remaining = protectedUntil - now();
      if (remaining <= 0) return resolveDeadline();
      timer = setTimer(resolveDeadline, remaining);
    }

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

    function isProtected() {
      return now() < protectedUntil;
    }

    function request(candidate) {
      if (candidate === visibleState) return false;
      if (isProtected()) {
        keepPending(candidate);
        return false;
      }
      pendingState = null;
      return show(candidate);
    }

    function handleHookState(state) {
      if (disposed || !HOOK_STATES.has(state)) return false;

      if (visibleState === 'sleeping') {
        clearScheduledTimer();
        pendingState = null;
        logicalState = latestPersistentState;
        resetMouseIdle();
        if (PERSISTENT_STATES.has(state)) {
          logicalState = state;
          latestPersistentState = state;
        }
        return show(state);
      }

      if (logicalState === 'sleeping') {
        logicalState = latestPersistentState;
        if (pendingState === 'sleeping') pendingState = null;
        resetMouseIdle();
      }
      if (PERSISTENT_STATES.has(state)) {
        logicalState = state;
        latestPersistentState = state;
      }
      return request(state);
    }

    function handleMouseSleep() {
      if (disposed) return false;
      logicalState = 'sleeping';
      return request('sleeping');
    }

    function handleMouseActivity() {
      if (disposed || logicalState !== 'sleeping') return false;
      if (visibleState !== 'sleeping') {
        logicalState = latestPersistentState;
        if (pendingState === 'sleeping') pendingState = null;
        resetMouseIdle();
        return true;
      }
      clearScheduledTimer();
      pendingState = null;
      logicalState = 'idle';
      latestPersistentState = 'idle';
      return show('idle');
    }

    function requestIdleAction(state, duration = MIN_DISPLAY_MS[state]) {
      if (disposed || !IDLE_ACTIONS.has(state)) return false;
      if (logicalState !== 'idle' || visibleState !== 'idle') return false;
      const minimum = MIN_DISPLAY_MS[state];
      const requested = Number.isFinite(duration) ? duration : minimum;
      return show(state, Math.max(minimum, requested));
    }

    function snapshot() {
      return {
        logicalState,
        visibleState,
        visibleSince,
        protectedUntil,
        pendingState,
      };
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      clearScheduledTimer();
      pendingState = null;
    }

    show('idle');

    return {
      handleHookState,
      handleMouseSleep,
      handleMouseActivity,
      requestIdleAction,
      snapshot,
      dispose,
    };
  }

  return { createStateController };
}));
